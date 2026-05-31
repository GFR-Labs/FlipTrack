from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from database import get_session
from models import Item, Listing, ListingCreate, ListingRead, ListingUpdate

router = APIRouter(prefix="/api/listings", tags=["listings"])


@router.get("/", response_model=list[ListingRead])
def list_listings(session: Session = Depends(get_session)):
    listings = session.exec(select(Listing).order_by(Listing.created_at.desc())).all()
    result = []
    for listing in listings:
        item = session.get(Item, listing.item_id)
        d = listing.model_dump()
        d["item"] = item.model_dump() if item else None
        result.append(d)
    return result


@router.post("/", response_model=ListingRead, status_code=201)
def create_listing(listing: ListingCreate, session: Session = Depends(get_session)):
    item = session.get(Item, listing.item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db_listing = Listing.model_validate(listing)
    session.add(db_listing)
    item.status = "Listed"
    session.add(item)
    session.commit()
    session.refresh(db_listing)
    d = db_listing.model_dump()
    d["item"] = item.model_dump()
    return d


@router.get("/{listing_id}", response_model=ListingRead)
def get_listing(listing_id: int, session: Session = Depends(get_session)):
    listing = session.get(Listing, listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    item = session.get(Item, listing.item_id)
    d = listing.model_dump()
    d["item"] = item.model_dump() if item else None
    return d


@router.patch("/{listing_id}", response_model=ListingRead)
def update_listing(listing_id: int, updates: ListingUpdate, session: Session = Depends(get_session)):
    listing = session.get(Listing, listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    for field, value in updates.model_dump(exclude_unset=True).items():
        setattr(listing, field, value)
    session.add(listing)
    session.commit()
    session.refresh(listing)
    item = session.get(Item, listing.item_id)
    d = listing.model_dump()
    d["item"] = item.model_dump() if item else None
    return d


@router.delete("/{listing_id}", status_code=204)
def delete_listing(listing_id: int, session: Session = Depends(get_session)):
    listing = session.get(Listing, listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    session.delete(listing)
    session.commit()
