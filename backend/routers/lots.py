from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from database import get_session
from models import (
    Item, ItemRead, Lot, LotAllocation, LotCreate, LotUpdate,
    apply_updates, reprice_item,
)

router = APIRouter(prefix="/api/lots", tags=["lots"])

NULLABLE = frozenset({"personal_use_note", "notes"})


def _lot_payload(lot: Lot, items: list[Item]) -> dict:
    allocated = round(sum(i.purchase_price for i in items), 2)
    remaining = round(lot.total_cost - allocated - lot.personal_use_cost, 2)
    return {
        "id": lot.id,
        "name": lot.name,
        "total_cost": lot.total_cost,
        "date_acquired": str(lot.date_acquired),
        "personal_use_cost": lot.personal_use_cost,
        "personal_use_note": lot.personal_use_note,
        "notes": lot.notes,
        "created_at": str(lot.created_at),
        "allocated": allocated,
        "remaining": remaining,
        "item_count": len(items),
        "items": [ItemRead.model_validate(i, from_attributes=True).model_dump(mode="json") for i in items],
    }


def _items_of(lot_id: int, session: Session) -> list[Item]:
    return session.exec(select(Item).where(Item.lot_id == lot_id).order_by(Item.created_at)).all()


@router.get("/")
def list_lots(session: Session = Depends(get_session)):
    lots = session.exec(select(Lot).order_by(Lot.date_acquired.desc())).all()
    return [_lot_payload(lot, _items_of(lot.id, session)) for lot in lots]


@router.post("/", status_code=201)
def create_lot(lot: LotCreate, session: Session = Depends(get_session)):
    db_lot = Lot.model_validate(lot)
    session.add(db_lot)
    session.commit()
    session.refresh(db_lot)
    return _lot_payload(db_lot, [])


@router.get("/{lot_id}")
def get_lot(lot_id: int, session: Session = Depends(get_session)):
    lot = session.get(Lot, lot_id)
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")
    return _lot_payload(lot, _items_of(lot_id, session))


@router.patch("/{lot_id}")
def update_lot(lot_id: int, updates: LotUpdate, session: Session = Depends(get_session)):
    lot = session.get(Lot, lot_id)
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")
    apply_updates(lot, updates, NULLABLE)
    session.add(lot)
    session.commit()
    session.refresh(lot)
    return _lot_payload(lot, _items_of(lot_id, session))


@router.post("/{lot_id}/allocate")
def allocate_lot(lot_id: int, alloc: LotAllocation, session: Session = Depends(get_session)):
    """Apply a batch of cost allocations to the lot's items (and optionally
    the personal-use portion) in one transaction. Costs are dollar amounts;
    sold items are repriced too, which recomputes their sales' net profit."""
    lot = session.get(Lot, lot_id)
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")

    lot_items = {i.id: i for i in _items_of(lot_id, session)}
    unknown = [iid for iid in alloc.items if iid not in lot_items]
    if unknown:
        raise HTTPException(status_code=400, detail=f"Items not in this lot: {unknown}")
    bad = {iid: c for iid, c in alloc.items.items() if c < 0}
    if bad or (alloc.personal_use_cost is not None and alloc.personal_use_cost < 0):
        raise HTTPException(status_code=400, detail="Allocated costs cannot be negative")

    for iid, cost in alloc.items.items():
        reprice_item(session, lot_items[iid], round(cost, 2))
    if alloc.personal_use_cost is not None:
        lot.personal_use_cost = round(alloc.personal_use_cost, 2)
    if alloc.personal_use_note is not None:
        lot.personal_use_note = alloc.personal_use_note or None
    session.add(lot)
    session.commit()
    session.refresh(lot)
    return _lot_payload(lot, _items_of(lot_id, session))


@router.delete("/{lot_id}", status_code=204)
def delete_lot(lot_id: int, session: Session = Depends(get_session)):
    lot = session.get(Lot, lot_id)
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")
    items = _items_of(lot_id, session)
    if items:
        raise HTTPException(
            status_code=409,
            detail=f"This lot has {len(items)} item(s) allocated from it. "
                   "Remove or delete those items first — their cost basis "
                   "traces back to this lot.",
        )
    session.delete(lot)
    session.commit()
