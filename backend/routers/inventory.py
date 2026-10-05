from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete
from sqlmodel import Session, select
from database import get_session
from models import Item, ItemCreate, ItemRead, ItemUpdate, Listing, Lot, Sale, apply_updates, reprice_item

router = APIRouter(prefix="/api/inventory", tags=["inventory"])

NULLABLE = frozenset({"notes", "lot_id"})


def _check_lot(lot_id, session: Session):
    if lot_id is not None and not session.get(Lot, lot_id):
        raise HTTPException(status_code=404, detail="Lot not found")


@router.get("/", response_model=list[ItemRead])
def list_items(session: Session = Depends(get_session)):
    return session.exec(select(Item).order_by(Item.created_at.desc())).all()


@router.post("/", response_model=ItemRead, status_code=201)
def create_item(item: ItemCreate, session: Session = Depends(get_session)):
    _check_lot(item.lot_id, session)
    db_item = Item.model_validate(item)
    session.add(db_item)
    session.commit()
    session.refresh(db_item)
    return db_item


@router.get("/{item_id}", response_model=ItemRead)
def get_item(item_id: int, session: Session = Depends(get_session)):
    item = session.get(Item, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


@router.patch("/{item_id}", response_model=ItemRead)
def update_item(item_id: int, updates: ItemUpdate, session: Session = Depends(get_session)):
    item = session.get(Item, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if "lot_id" in updates.model_dump(exclude_unset=True):
        _check_lot(updates.lot_id, session)
    old_price = item.purchase_price
    apply_updates(item, updates, NULLABLE)
    session.add(item)
    # Keep recorded sales consistent: net_profit is derived from the item's
    # purchase price, so a price correction must flow through to past sales.
    if item.purchase_price != old_price:
        reprice_item(session, item, item.purchase_price)
    session.commit()
    session.refresh(item)
    return item


@router.delete("/{item_id}", status_code=204)
def delete_item(item_id: int, session: Session = Depends(get_session)):
    item = session.get(Item, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    # Never cascade into financial records: deleting an item must not erase
    # recorded income. The sale rows are the books.
    sale_count = len(session.exec(select(Sale).where(Sale.item_id == item_id)).all())
    if sale_count:
        raise HTTPException(
            status_code=409,
            detail=f"This item has {sale_count} recorded sale(s). "
                   "Delete those sales from the Sold page first if you really "
                   "want to remove it — sales are part of your financial records.",
        )
    session.execute(delete(Listing).where(Listing.item_id == item_id))
    session.delete(item)
    session.commit()
