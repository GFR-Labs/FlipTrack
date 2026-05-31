from fastapi import APIRouter, Depends
from sqlmodel import Session, select, func
from database import get_session
from models import Item, Sale, Expense
from collections import defaultdict

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats")
def get_stats(session: Session = Depends(get_session)):
    sales = session.exec(select(Sale)).all()
    items = session.exec(select(Item)).all()
    expenses = session.exec(select(Expense)).all()

    gross_revenue = sum(s.sale_price for s in sales)
    total_fees = sum(s.platform_fees + s.shipping_cost for s in sales)
    total_invested = sum(i.purchase_price * i.quantity for i in items)
    net_profit = sum(s.net_profit for s in sales)
    total_expenses = sum(e.amount for e in expenses)

    # Items currently in stock (not sold)
    in_stock = [i for i in items if i.status == "In Stock"]
    listed = [i for i in items if i.status == "Listed"]

    # Potential profit: sum of items still listed / in stock (assume they sell at purchase price as floor)
    # We don't have asking prices here easily, so we just count unrealized cost
    potential_inventory_value = sum(i.purchase_price * i.quantity for i in in_stock + listed)

    return {
        "gross_revenue": round(gross_revenue, 2),
        "net_profit": round(net_profit - total_expenses, 2),
        "total_invested": round(total_invested, 2),
        "total_fees": round(total_fees, 2),
        "total_expenses": round(total_expenses, 2),
        "items_in_stock": len(in_stock),
        "items_listed": len(listed),
        "items_sold": len([i for i in items if i.status == "Sold"]),
        "potential_inventory_value": round(potential_inventory_value, 2),
    }


@router.get("/monthly")
def get_monthly(session: Session = Depends(get_session)):
    sales = session.exec(select(Sale)).all()
    expenses = session.exec(select(Expense)).all()

    monthly_revenue: dict[str, float] = defaultdict(float)
    monthly_profit: dict[str, float] = defaultdict(float)
    monthly_expenses: dict[str, float] = defaultdict(float)

    for s in sales:
        key = s.sold_date.strftime("%Y-%m")
        monthly_revenue[key] += s.sale_price
        monthly_profit[key] += s.net_profit

    for e in expenses:
        key = e.date.strftime("%Y-%m")
        monthly_expenses[key] += e.amount

    all_keys = sorted(set(list(monthly_revenue.keys()) + list(monthly_expenses.keys())))

    result = []
    for key in all_keys:
        year, month = key.split("-")
        from calendar import month_abbr
        label = f"{month_abbr[int(month)]} {year}"
        result.append({
            "month": label,
            "revenue": round(monthly_revenue.get(key, 0), 2),
            "profit": round(monthly_profit.get(key, 0) - monthly_expenses.get(key, 0), 2),
            "expenses": round(monthly_expenses.get(key, 0), 2),
        })

    return result
