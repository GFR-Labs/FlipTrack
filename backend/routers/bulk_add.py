from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends
from sqlmodel import Session
from pydantic import BaseModel
from database import get_session
from models import Item, Listing, Sale

router = APIRouter(prefix="/api/bulk-add", tags=["bulk-add"])

PLATFORMS = ["eBay", "Facebook Marketplace", "Craigslist", "OfferUp", "Amazon", "Other"]


class BulkRow(BaseModel):
    name: str
    purchase_price: float
    quantity: int = 1
    date_acquired: date
    notes: Optional[str] = None
    # Listing
    asking_price: Optional[float] = None
    platform: Optional[str] = None
    listed_date: Optional[date] = None
    # Sale
    sale_price: Optional[float] = None
    platform_fees: float = 0.0
    shipping_cost: float = 0.0
    sold_date: Optional[date] = None


@router.post("/")
def bulk_add(rows: list[BulkRow], session: Session = Depends(get_session)):
    added = []
    for row in rows:
        has_sale = row.sale_price is not None
        has_listing = row.asking_price is not None

        status = "Sold" if has_sale else ("Listed" if has_listing else "In Stock")

        item = Item(
            name=row.name,
            purchase_price=row.purchase_price,
            quantity=row.quantity,
            status=status,
            date_acquired=row.date_acquired,
            notes=row.notes or None,
        )
        session.add(item)
        session.flush()

        if has_listing:
            session.add(Listing(
                item_id=item.id,
                platform=row.platform or "eBay",
                asking_price=row.asking_price,
                listed_date=row.listed_date or row.date_acquired,
            ))

        if has_sale:
            net = round(row.sale_price - row.platform_fees - row.shipping_cost - row.purchase_price, 2)
            session.add(Sale(
                item_id=item.id,
                sale_price=row.sale_price,
                platform_fees=row.platform_fees,
                shipping_cost=row.shipping_cost,
                sold_date=row.sold_date or row.date_acquired,
                net_profit=net,
            ))

        added.append({"name": row.name, "status": status})

    session.commit()
    return {"added": len(added), "items": added}
