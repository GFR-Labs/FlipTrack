import io
import re
import zipfile
from collections import defaultdict
from datetime import date
from pathlib import Path

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from sqlmodel import Session, select

from database import get_session
from models import Expense, Item, Receipt, Sale

RECEIPTS_DIR = Path("/data/receipts")
router = APIRouter(prefix="/api/business", tags=["business"])

# IRS standard mileage rates — keep in sync with frontend/src/pages/Expenses.jsx,
# which converts entered miles to dollars with these same rates.
MILEAGE_RATES = {2023: 0.655, 2024: 0.67, 2025: 0.70, 2026: 0.725}
LATEST_MILEAGE_YEAR = max(MILEAGE_RATES)


def _mileage_substantiation(exp) -> str:
    """Back-calculate miles from the stored dollar amount, as the app's edit
    form does, so the report shows the substantiation a CPA needs."""
    rate = MILEAGE_RATES.get(exp.date.year, MILEAGE_RATES[LATEST_MILEAGE_YEAR])
    miles = exp.amount / rate
    return f"{miles:,.1f} mi × ${rate:.3f}/mi ({exp.date.year} IRS rate)"


def _sale_cost(sale, items_map: dict) -> float:
    item = items_map.get(sale.item_id)
    return item.purchase_price if item else 0.0


def _sale_net(sale, items_map: dict) -> float:
    """Net profit derived from the row's own components, so every sheet foots
    even if a stored net_profit predates the recompute-on-edit fix."""
    return round(sale.sale_price - sale.platform_fees - sale.shipping_cost - _sale_cost(sale, items_map), 2)

# ── Palette (8-char ARGB — openpyxl requires FF alpha prefix) ────────────────
BG_HEADER   = "FF1F3864"
BG_SECTION  = "FF2F75B6"
BG_ALT      = "FFF2F7FC"
BG_TOTAL    = "FFDEEAF1"
BG_WHITE    = "FFFFFFFF"
BG_CAT      = "FFEBF3FB"
FG_WHITE    = "FFFFFFFF"
FG_DARK     = "FF1A1A2E"
FG_GREEN    = "FF375623"
FG_RED      = "FFC00000"
FG_SECTION  = "FF2F75B6"  # same blue as BG_SECTION — used as font colour on light bg


# ── Style helpers ─────────────────────────────────────────────────────────────

def _fill(hex_: str) -> PatternFill:
    return PatternFill("solid", fgColor=hex_)

def _font(bold=False, color=FG_DARK, size=11) -> Font:
    return Font(bold=bold, color=color, size=size, name="Calibri")

def _thin_border() -> Border:
    s = Side(style="thin", color="FFD9D9D9")
    return Border(left=s, right=s, top=s, bottom=s)

def _set_widths(ws, widths: list[float]):
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w

def _header_row(ws, row: int, headers: list[str]):
    for col, text in enumerate(headers, 1):
        c = ws.cell(row=row, column=col, value=text)
        c.font  = _font(bold=True, color=FG_WHITE)
        c.fill  = _fill(BG_HEADER)
        c.alignment = Alignment(horizontal="center", vertical="center")
        c.border = _thin_border()
    ws.row_dimensions[row].height = 22

def _money(ws, row: int, col: int, value: float, bold=False, color=FG_DARK, bg=BG_WHITE):
    c = ws.cell(row=row, column=col, value=value)
    c.number_format = '$#,##0.00'
    c.font   = _font(bold=bold, color=color)
    c.fill   = _fill(bg)
    c.border = _thin_border()
    return c

def _safe(s: str) -> str:
    return re.sub(r'[^\w\-]', '-', str(s))[:28].strip('-') or "untitled"

def _profit_color(value: float) -> str:
    if value > 0:  return FG_GREEN
    if value < 0:  return FG_RED
    return FG_DARK


# ── Sheet builders ────────────────────────────────────────────────────────────

def _summary_sheet(ws, start: date, end: date, sales, expenses, items_map: dict):
    ws.title = "Summary"
    ws.sheet_view.showGridLines = False

    # ── Title banner
    ws.merge_cells("A1:E1")
    c = ws["A1"]
    c.value = "FlipTrack  ·  Business Report"
    c.font  = _font(bold=True, color=FG_WHITE, size=15)
    c.fill  = _fill(BG_HEADER)
    c.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 34

    ws.merge_cells("A2:E2")
    c = ws["A2"]
    c.value = f"Period: {start.strftime('%B %d, %Y')}  —  {end.strftime('%B %d, %Y')}"
    c.font  = _font(color=FG_WHITE, size=11)
    c.fill  = _fill(BG_SECTION)
    c.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[2].height = 18
    ws.row_dimensions[3].height = 10

    gross    = sum(s.sale_price    for s in sales)
    plat     = sum(s.platform_fees for s in sales)
    ship     = sum(s.shipping_cost for s in sales)
    cogs     = sum(_sale_cost(s, items_map) for s in sales)
    net_s    = sum(_sale_net(s, items_map)  for s in sales)
    exp_tot  = sum(e.amount        for e in expenses)
    net_inc  = net_s - exp_tot

    def metric_row(r, label, value, is_total=False):
        bg = BG_TOTAL if is_total else BG_WHITE
        lc = ws.cell(row=r, column=2, value=label)
        lc.font  = _font(bold=is_total, color=FG_DARK)
        lc.fill  = _fill(bg)
        lc.alignment = Alignment(indent=1)
        lc.border = _thin_border()
        vc = ws.cell(row=r, column=3, value=value)
        vc.number_format = '$#,##0.00'
        vc.font  = _font(bold=is_total, color=_profit_color(value) if value is not None else FG_DARK)
        vc.fill  = _fill(bg)
        vc.border = _thin_border()
        ws.row_dimensions[r].height = 18

    def section_header(r, label):
        ws.merge_cells(f"B{r}:C{r}")
        c = ws.cell(row=r, column=2, value=label)
        c.font  = _font(bold=True, color=FG_WHITE, size=10)
        c.fill  = _fill(BG_SECTION)
        c.alignment = Alignment(indent=1)
        c.border = _thin_border()
        ws.row_dimensions[r].height = 18

    r = 4
    section_header(r, "INCOME"); r += 1
    metric_row(r, "Gross Revenue",       gross);  r += 1
    metric_row(r, "Platform Fees",       -plat);  r += 1
    metric_row(r, "Shipping Costs",      -ship);  r += 1
    metric_row(r, "Cost of Goods Sold",  -cogs);  r += 1
    metric_row(r, "Net Sales Profit",    net_s, is_total=True); r += 2

    section_header(r, "EXPENSES"); r += 1
    by_cat = defaultdict(float)
    for e in expenses:
        by_cat[e.category] += e.amount
    for cat, amt in sorted(by_cat.items()):
        metric_row(r, cat, -amt); r += 1
    metric_row(r, "Total Expenses", -exp_tot, is_total=True); r += 2

    section_header(r, "NET INCOME"); r += 1
    metric_row(r, "Net Income (after all expenses)", net_inc, is_total=True)

    ws.column_dimensions["A"].width = 2
    ws.column_dimensions["B"].width = 36
    ws.column_dimensions["C"].width = 18
    ws.column_dimensions["D"].width = 2


def _sales_sheet(ws, sales, items_map: dict, receipts_map: dict):
    ws.title = "Sales"
    ws.sheet_view.showGridLines = False

    headers = ["Sold Date", "Item", "Date Acquired", "Sale Price", "Platform Fees", "Shipping", "Purchase Cost", "Net Profit", "Receipt Files"]
    widths  = [14, 32, 15, 14, 16, 12, 16, 14, 44]
    _header_row(ws, 1, headers)

    for i, sale in enumerate(sorted(sales, key=lambda s: s.sold_date)):
        r    = i + 2
        bg   = BG_ALT if i % 2 else BG_WHITE
        item = items_map.get(sale.item_id)
        cost = _sale_cost(sale, items_map)
        net  = _sale_net(sale, items_map)
        receipts = ", ".join(
            receipts_map.get(("item", sale.item_id), [])
            + receipts_map.get(("sale", sale.id), [])
        )

        def cell(col, val, _r=r, _bg=bg):
            c = ws.cell(row=_r, column=col, value=val)
            c.fill   = _fill(_bg)
            c.border = _thin_border()
            return c

        c1 = cell(1, sale.sold_date); c1.number_format = "MMM DD, YYYY"; c1.alignment = Alignment(horizontal="center")
        cell(2, item.name if item else "Unknown (item deleted)").font = _font(color=FG_DARK)
        c3 = cell(3, item.date_acquired if item else None)
        c3.number_format = "MMM DD, YYYY"; c3.alignment = Alignment(horizontal="center")
        _money(ws, r, 4, sale.sale_price,    color=FG_DARK, bg=bg)
        _money(ws, r, 5, sale.platform_fees, color=FG_DARK, bg=bg)
        _money(ws, r, 6, sale.shipping_cost, color=FG_DARK, bg=bg)
        _money(ws, r, 7, cost,               color=FG_DARK, bg=bg)
        _money(ws, r, 8, net,                color=_profit_color(net), bg=bg)
        cell(9, receipts).font = _font(color="FF666666", size=9)

    # Totals
    tr = len(sales) + 2
    def total_cell(col, val, fmt=None):
        c = ws.cell(row=tr, column=col, value=val)
        c.font   = _font(bold=True, color=FG_DARK)
        c.fill   = _fill(BG_TOTAL)
        c.border = _thin_border()
        if fmt: c.number_format = fmt
        return c

    total_cell(1, "")
    total_cell(2, "TOTALS")
    total_cell(3, "")
    for col, attr in [(4, "sale_price"), (5, "platform_fees"), (6, "shipping_cost")]:
        total_cell(col, sum(getattr(s, attr) for s in sales), '$#,##0.00')
    # Include orphaned sales as $0.00 cost (consistent with per-row display)
    total_cell(7, sum(_sale_cost(s, items_map) for s in sales), '$#,##0.00')
    net_total = sum(_sale_net(s, items_map) for s in sales)
    c = total_cell(8, net_total, '$#,##0.00')
    c.font = _font(bold=True, color=_profit_color(net_total))
    total_cell(9, "")

    _set_widths(ws, widths)
    ws.freeze_panes = "A2"
    # Cover header + all data rows (exclude totals row from filter domain)
    ws.auto_filter.ref = f"A1:{get_column_letter(len(headers))}{tr - 1}"


def _expenses_sheet(ws, expenses, receipts_map: dict):
    ws.title = "Expenses"
    ws.sheet_view.showGridLines = False

    headers = ["Date", "Category", "Description", "Amount", "Receipt Files"]
    widths  = [14, 24, 42, 14, 44]
    _header_row(ws, 1, headers)

    by_cat = defaultdict(list)
    for e in sorted(expenses, key=lambda x: x.date):
        by_cat[e.category].append(e)

    row   = 2
    total = 0.0

    for cat in sorted(by_cat):
        # Category subheader stripe
        for col in range(1, 6):
            c = ws.cell(row=row, column=col)
            c.fill   = _fill(BG_CAT)
            c.border = _thin_border()
        ws.cell(row=row, column=1).value = ""
        ws.cell(row=row, column=2, value=cat).font = _font(bold=True, color=FG_SECTION, size=10)
        sub = sum(e.amount for e in by_cat[cat])
        sc  = ws.cell(row=row, column=4, value=sub)
        sc.number_format = '$#,##0.00'
        sc.font   = _font(bold=True, color=FG_RED)
        sc.fill   = _fill(BG_CAT)
        sc.border = _thin_border()
        ws.row_dimensions[row].height = 16
        row += 1

        for i, exp in enumerate(by_cat[cat]):
            bg       = BG_ALT if i % 2 else BG_WHITE
            receipts = ", ".join(receipts_map.get(("expense", exp.id), []))

            def ecell(col, val, _r=row, _bg=bg):
                c = ws.cell(row=_r, column=col, value=val)
                c.fill   = _fill(_bg)
                c.border = _thin_border()
                return c

            dc = ecell(1, exp.date); dc.number_format = "MMM DD, YYYY"; dc.alignment = Alignment(horizontal="center")
            ecell(2, exp.category).font  = _font(color=FG_DARK)
            desc = exp.description or ""
            if exp.category == "Mileage":
                detail = _mileage_substantiation(exp)
                desc = f"{desc} — {detail}" if desc else detail
            ecell(3, desc).font = _font(color="FF555555")
            ac = ecell(4, exp.amount); ac.number_format = '$#,##0.00'; ac.font = _font(color=FG_RED)
            ecell(5, receipts).font = _font(color="FF666666", size=9)
            total += exp.amount
            row += 1

    last_data_row = row - 1

    # Grand total
    for col in range(1, 6):
        c = ws.cell(row=row, column=col)
        c.fill   = _fill(BG_TOTAL)
        c.border = _thin_border()
    ws.cell(row=row, column=2, value="TOTAL EXPENSES").font = _font(bold=True, color=FG_DARK)
    tc = ws.cell(row=row, column=4, value=total)
    tc.number_format = '$#,##0.00'
    tc.font   = _font(bold=True, color=FG_RED)
    tc.fill   = _fill(BG_TOTAL)
    tc.border = _thin_border()

    _set_widths(ws, widths)
    ws.freeze_panes = "A2"
    # Cover header + all data rows (exclude grand total row from filter domain)
    ws.auto_filter.ref = f"A1:{get_column_letter(len(headers))}{last_data_row}"


def _inventory_sheet(ws, inventory_items, receipts_map: dict, as_of: date):
    """Unsold inventory with cost basis, for COGS/ending-inventory reconciliation."""
    ws.title = "Inventory on Hand"
    ws.sheet_view.showGridLines = False

    headers = [f"Item (as of {as_of.strftime('%b %d, %Y')})", "Status", "Qty", "Purchase Cost", "Date Acquired", "Receipt Files"]
    widths  = [36, 12, 8, 16, 15, 44]
    _header_row(ws, 1, headers)

    items = sorted(inventory_items, key=lambda i: i.date_acquired)
    total = 0.0
    for i, item in enumerate(items):
        r  = i + 2
        bg = BG_ALT if i % 2 else BG_WHITE

        def cell(col, val, _r=r, _bg=bg):
            c = ws.cell(row=_r, column=col, value=val)
            c.fill   = _fill(_bg)
            c.border = _thin_border()
            return c

        cell(1, item.name).font = _font(color=FG_DARK)
        sc = cell(2, item.status); sc.alignment = Alignment(horizontal="center")
        qc = cell(3, item.quantity); qc.alignment = Alignment(horizontal="center")
        _money(ws, r, 4, item.purchase_price, color=FG_DARK, bg=bg)
        dc = cell(5, item.date_acquired); dc.number_format = "MMM DD, YYYY"; dc.alignment = Alignment(horizontal="center")
        cell(6, ", ".join(receipts_map.get(("item", item.id), []))).font = _font(color="FF666666", size=9)
        total += item.purchase_price

    tr = len(items) + 2
    for col in range(1, 7):
        c = ws.cell(row=tr, column=col)
        c.fill   = _fill(BG_TOTAL)
        c.border = _thin_border()
    ws.cell(row=tr, column=1, value="TOTAL INVESTED IN INVENTORY").font = _font(bold=True, color=FG_DARK)
    tc = ws.cell(row=tr, column=4, value=total)
    tc.number_format = '$#,##0.00'
    tc.font   = _font(bold=True, color=FG_DARK)
    tc.fill   = _fill(BG_TOTAL)
    tc.border = _thin_border()

    _set_widths(ws, widths)
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:{get_column_letter(len(headers))}{max(tr - 1, 1)}"


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/export/zip")
def export_zip(
    start: date = Query(...),
    end:   date = Query(...),
    session: Session = Depends(get_session),
):
    sales    = session.exec(select(Sale).where(Sale.sold_date >= start, Sale.sold_date <= end)).all()
    expenses = session.exec(select(Expense).where(Expense.date >= start, Expense.date <= end)).all()

    # Items referenced by the filtered sales, plus current unsold inventory
    # (the latter feeds the "Inventory on Hand" sheet and its receipts).
    inventory_items = session.exec(select(Item).where(Item.status != "Sold")).all()
    sold_item_ids   = {s.item_id for s in sales}
    item_ids        = list(sold_item_ids | {i.id for i in inventory_items})
    items_map = (
        {i.id: i for i in session.exec(select(Item).where(Item.id.in_(item_ids))).all()}
        if item_ids else {}
    )

    expense_ids    = [e.id for e in expenses]
    expenses_by_id = {e.id: e for e in expenses}
    sale_ids       = [s.id for s in sales]
    sales_by_id    = {s.id: s for s in sales}

    raw_receipts: list[Receipt] = []
    if item_ids:
        raw_receipts += session.exec(
            select(Receipt).where(Receipt.entity_type == "item", Receipt.entity_id.in_(item_ids))
        ).all()
    if expense_ids:
        raw_receipts += session.exec(
            select(Receipt).where(Receipt.entity_type == "expense", Receipt.entity_id.in_(expense_ids))
        ).all()
    if sale_ids:
        raw_receipts += session.exec(
            select(Receipt).where(Receipt.entity_type == "sale", Receipt.entity_id.in_(sale_ids))
        ).all()

    # Build receipt maps
    receipts_map: dict[tuple, list[str]] = defaultdict(list)
    disk_files: list[tuple[Path, str]] = []

    for r in raw_receipts:
        if r.entity_type == "item":
            item  = items_map.get(r.entity_id)
            label = _safe(item.name) if item else "item"
        elif r.entity_type == "sale":
            sale  = sales_by_id.get(r.entity_id)
            item  = items_map.get(sale.item_id) if sale else None
            label = _safe(item.name) if item else "sale"
        else:
            exp   = expenses_by_id.get(r.entity_id)
            label = _safe(exp.description or exp.category) if exp else "expense"
        disk = RECEIPTS_DIR / r.filename
        if not disk.exists():
            # Surface the gap in the report instead of dropping the receipt silently
            receipts_map[(r.entity_type, r.entity_id)].append(f"[FILE MISSING: {r.original_name}]")
            continue
        ext      = Path(r.filename).suffix
        zip_name = f"receipts/{r.entity_type}_{r.entity_id}_{label}_{r.id}{ext}"
        receipts_map[(r.entity_type, r.entity_id)].append(zip_name)
        disk_files.append((disk, zip_name))

    # Build XLSX
    wb  = Workbook()
    ws1 = wb.active
    ws2 = wb.create_sheet()
    ws3 = wb.create_sheet()
    ws4 = wb.create_sheet()
    _summary_sheet(ws1, start, end, sales, expenses, items_map)
    _sales_sheet(ws2, sales, items_map, receipts_map)
    _expenses_sheet(ws3, expenses, receipts_map)
    _inventory_sheet(ws4, inventory_items, receipts_map, date.today())

    xlsx_buf = io.BytesIO()
    wb.save(xlsx_buf)
    xlsx_buf.seek(0)

    # Bundle into ZIP
    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(f"FlipTrack_Report_{start}_{end}.xlsx", xlsx_buf.read())
        for disk_path, zip_path in disk_files:
            zf.write(disk_path, zip_path)

    fname = f"fliptrack_cpa_{start}_{end}.zip"
    return StreamingResponse(
        iter([zip_buf.getvalue()]),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


@router.get("/summary")
def get_summary(
    start: date = Query(...),
    end:   date = Query(...),
    session: Session = Depends(get_session),
):
    sales    = session.exec(select(Sale).where(Sale.sold_date >= start, Sale.sold_date <= end)).all()
    expenses = session.exec(select(Expense).where(Expense.date >= start, Expense.date <= end)).all()

    item_ids  = list({s.item_id for s in sales})
    items_map = (
        {i.id: i for i in session.exec(select(Item).where(Item.id.in_(item_ids))).all()}
        if item_ids else {}
    )

    by_cat: dict[str, float] = defaultdict(float)
    for e in expenses:
        by_cat[e.category] += e.amount

    gross    = sum(s.sale_price    for s in sales)
    plat     = sum(s.platform_fees for s in sales)
    ship     = sum(s.shipping_cost for s in sales)
    cogs     = sum(_sale_cost(s, items_map) for s in sales)
    net_s    = sum(_sale_net(s, items_map)  for s in sales)
    exp_tot  = sum(e.amount        for e in expenses)

    return {
        "period":               {"start": str(start), "end": str(end)},
        "sales_count":          len(sales),
        "gross_revenue":        round(gross,   2),
        "total_fees":           round(plat + ship, 2),
        "platform_fees":        round(plat,    2),
        "shipping_costs":       round(ship,    2),
        "cost_of_goods_sold":   round(cogs,    2),
        "net_sales_profit":     round(net_s,   2),
        "total_expenses":       round(exp_tot, 2),
        "net_income":           round(net_s - exp_tot, 2),
        "expenses_by_category": {k: round(v, 2) for k, v in sorted(by_cat.items())},
    }
