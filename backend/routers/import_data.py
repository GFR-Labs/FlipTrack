import csv
import io
from datetime import date
from fastapi import APIRouter, Depends, File, UploadFile, HTTPException
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select
from database import get_session
from models import Item, Sale, Expense

router = APIRouter(prefix="/api/import", tags=["import"])

VALID_STATUSES = {"In Stock", "Listed", "Sold"}


def _parse_date(val: str) -> date:
    val = val.strip()
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m-%d-%Y", "%d/%m/%Y"):
        try:
            return date.fromisoformat(val) if fmt == "%Y-%m-%d" else date.strptime(val, fmt)
        except ValueError:
            continue
    raise ValueError(f"Unrecognised date format: '{val}'")


def _normalise(row: dict) -> dict:
    """Lowercase and strip all keys so column name casing doesn't matter."""
    return {k.strip().lower().replace(" ", "_"): v.strip() for k, v in row.items()}


# ── Templates ────────────────────────────────────────────────────────────────

@router.get("/template/items")
def template_items():
    rows = [
        ["name", "purchase_price", "quantity", "status", "date_acquired", "notes"],
        ["Dell 512gb NVMe", "18.00", "1", "In Stock", "2026-01-15", "Pulled from old laptop"],
    ]
    output = io.StringIO()
    csv.writer(output).writerows(rows)
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="fliptrack_items_template.csv"'},
    )


@router.get("/template/sales")
def template_sales():
    rows = [
        ["item_name", "sale_price", "platform_fees", "shipping_cost", "sold_date"],
        ["Dell 512gb NVMe", "45.00", "4.50", "5.00", "2026-02-01"],
    ]
    output = io.StringIO()
    csv.writer(output).writerows(rows)
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="fliptrack_sales_template.csv"'},
    )


@router.get("/template/expenses")
def template_expenses():
    rows = [
        ["category", "amount", "date", "description"],
        ["Shipping Supplies", "12.50", "2026-01-10", "Bubble wrap roll"],
        ["eBay Fees", "8.00", "2026-01-31", "Monthly store fee"],
    ]
    output = io.StringIO()
    csv.writer(output).writerows(rows)
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="fliptrack_expenses_template.csv"'},
    )


# ── Import endpoints ─────────────────────────────────────────────────────────

@router.post("/items")
async def import_items(file: UploadFile = File(...), session: Session = Depends(get_session)):
    content = await file.read()
    text = content.decode("utf-8-sig")  # strip BOM if present
    reader = csv.DictReader(io.StringIO(text))

    imported, errors = 0, []

    for i, raw in enumerate(reader, 1):
        row = _normalise(raw)
        try:
            status = row.get("status", "In Stock")
            if status not in VALID_STATUSES:
                status = "In Stock"
            item = Item(
                name=row["name"],
                purchase_price=float(row["purchase_price"]),
                quantity=int(row.get("quantity") or 1),
                status=status,
                date_acquired=_parse_date(row["date_acquired"]),
                notes=row.get("notes") or None,
            )
            session.add(item)
            imported += 1
        except Exception as e:
            errors.append(f"Row {i}: {e}")

    session.commit()
    return {"imported": imported, "skipped": len(errors), "errors": errors}


@router.post("/sales")
async def import_sales(file: UploadFile = File(...), session: Session = Depends(get_session)):
    content = await file.read()
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))

    # Build a case-insensitive name → item map
    all_items = session.exec(select(Item)).all()
    item_map = {i.name.lower(): i for i in all_items}

    imported, errors = 0, []

    for i, raw in enumerate(reader, 1):
        row = _normalise(raw)
        try:
            item_name = row.get("item_name", "")
            item = item_map.get(item_name.lower())
            if not item:
                errors.append(f"Row {i}: item '{item_name}' not found — add it to inventory first")
                continue

            sale_price = float(row["sale_price"])
            platform_fees = float(row.get("platform_fees") or 0)
            shipping_cost = float(row.get("shipping_cost") or 0)
            net_profit = round(sale_price - platform_fees - shipping_cost - item.purchase_price, 2)

            sale = Sale(
                item_id=item.id,
                sale_price=sale_price,
                platform_fees=platform_fees,
                shipping_cost=shipping_cost,
                sold_date=_parse_date(row["sold_date"]),
                net_profit=net_profit,
            )
            session.add(sale)
            item.status = "Sold"
            session.add(item)
            imported += 1
        except Exception as e:
            errors.append(f"Row {i}: {e}")

    session.commit()
    return {"imported": imported, "skipped": len(errors), "errors": errors}


@router.post("/expenses")
async def import_expenses(file: UploadFile = File(...), session: Session = Depends(get_session)):
    content = await file.read()
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))

    imported, errors = 0, []

    for i, raw in enumerate(reader, 1):
        row = _normalise(raw)
        try:
            expense = Expense(
                category=row["category"],
                amount=float(row["amount"]),
                date=_parse_date(row["date"]),
                description=row.get("description") or None,
            )
            session.add(expense)
            imported += 1
        except Exception as e:
            errors.append(f"Row {i}: {e}")

    session.commit()
    return {"imported": imported, "skipped": len(errors), "errors": errors}
