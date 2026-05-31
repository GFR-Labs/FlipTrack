import csv
import io
from datetime import date
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select
from database import get_session
from models import Sale, Expense, Item

router = APIRouter(prefix="/api/business", tags=["business"])


@router.get("/export/csv")
def export_csv(
    start: date = Query(...),
    end: date = Query(...),
    session: Session = Depends(get_session),
):
    sales = session.exec(
        select(Sale).where(Sale.sold_date >= start, Sale.sold_date <= end)
    ).all()
    expenses = session.exec(
        select(Expense).where(Expense.date >= start, Expense.date <= end)
    ).all()

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(["FlipTrack CPA Export"])
    writer.writerow([f"Period: {start} to {end}"])
    writer.writerow([])

    # Income section
    writer.writerow(["=== INCOME ==="])
    writer.writerow(["Date", "Item", "Platform", "Sale Price", "Platform Fees", "Shipping Cost", "Net Profit"])
    total_revenue = 0.0
    total_net = 0.0
    for sale in sales:
        item = session.get(Item, sale.item_id)
        item_name = item.name if item else "Unknown"
        writer.writerow([
            sale.sold_date,
            item_name,
            "",
            f"{sale.sale_price:.2f}",
            f"{sale.platform_fees:.2f}",
            f"{sale.shipping_cost:.2f}",
            f"{sale.net_profit:.2f}",
        ])
        total_revenue += sale.sale_price
        total_net += sale.net_profit

    writer.writerow(["", "", "TOTALS", f"{total_revenue:.2f}", "", "", f"{total_net:.2f}"])
    writer.writerow([])

    # Expenses section
    writer.writerow(["=== EXPENSES ==="])
    writer.writerow(["Date", "Category", "Description", "Amount"])
    total_expenses = 0.0
    # Group by category
    from collections import defaultdict
    by_cat: dict[str, list] = defaultdict(list)
    for exp in expenses:
        by_cat[exp.category].append(exp)

    for cat, exps in sorted(by_cat.items()):
        for exp in exps:
            writer.writerow([exp.date, exp.category, exp.description or "", f"{exp.amount:.2f}"])
            total_expenses += exp.amount

    writer.writerow(["", "", "TOTAL EXPENSES", f"{total_expenses:.2f}"])
    writer.writerow([])

    # Summary
    writer.writerow(["=== SUMMARY ==="])
    writer.writerow(["Gross Revenue", f"{total_revenue:.2f}"])
    writer.writerow(["Total Expenses", f"{total_expenses:.2f}"])
    writer.writerow(["Net Income", f"{total_net - total_expenses:.2f}"])

    output.seek(0)
    filename = f"fliptrack_export_{start}_{end}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/summary")
def get_summary(
    start: date = Query(...),
    end: date = Query(...),
    session: Session = Depends(get_session),
):
    sales = session.exec(
        select(Sale).where(Sale.sold_date >= start, Sale.sold_date <= end)
    ).all()
    expenses = session.exec(
        select(Expense).where(Expense.date >= start, Expense.date <= end)
    ).all()

    from collections import defaultdict
    expense_by_cat: dict[str, float] = defaultdict(float)
    for exp in expenses:
        expense_by_cat[exp.category] += exp.amount

    total_revenue = sum(s.sale_price for s in sales)
    total_fees = sum(s.platform_fees + s.shipping_cost for s in sales)
    total_net_sales = sum(s.net_profit for s in sales)
    total_expenses = sum(e.amount for e in expenses)

    return {
        "period": {"start": str(start), "end": str(end)},
        "sales_count": len(sales),
        "gross_revenue": round(total_revenue, 2),
        "total_fees": round(total_fees, 2),
        "net_sales_profit": round(total_net_sales, 2),
        "total_expenses": round(total_expenses, 2),
        "net_income": round(total_net_sales - total_expenses, 2),
        "expenses_by_category": {k: round(v, 2) for k, v in sorted(expense_by_cat.items())},
    }
