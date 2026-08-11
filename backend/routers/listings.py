from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from database import get_session
from models import (
    Item, Listing, ListingCreate, ListingRead, ListingUpdate,
    apply_updates, item_payload,
)

router = APIRouter(prefix="/api/listings", tags=["listings"])

NULLABLE = frozenset({"url"})


def _read(listing: Listing, item: Item | None) -> dict:
    d = listing.model_dump()
    d["item"] = item_payload(item)
    return d


@router.get("/", response_model=list[ListingRead])
def list_listings(session: Session = Depends(get_session)):
    listings = session.exec(select(Listing).order_by(Listing.created_at.desc())).all()
    return [_read(l, session.get(Item, l.item_id)) for l in listings]


@router.post("/", response_model=ListingRead, status_code=201)
def create_listing(listing: ListingCreate, session: Session = Depends(get_session)):
    item = session.get(Item, listing.item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db_listing = Listing.model_validate(listing)
    session.add(db_listing)
    item.status = "Listed"
    session.commit()
    session.refresh(db_listing)
    return _read(db_listing, item)


@router.get("/{listing_id}", response_model=ListingRead)
def get_listing(listing_id: int, session: Session = Depends(get_session)):
    listing = session.get(Listing, listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    return _read(listing, session.get(Item, listing.item_id))


@router.patch("/{listing_id}", response_model=ListingRead)
def update_listing(listing_id: int, updates: ListingUpdate, session: Session = Depends(get_session)):
    listing = session.get(Listing, listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    apply_updates(listing, updates, NULLABLE)
    session.add(listing)
    session.commit()
    session.refresh(listing)
    return _read(listing, session.get(Item, listing.item_id))


@router.delete("/{listing_id}", status_code=204)
def delete_listing(listing_id: int, session: Session = Depends(get_session)):
    listing = session.get(Listing, listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    session.delete(listing)
    session.commit()
