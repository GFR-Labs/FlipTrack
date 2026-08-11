from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete
from sqlmodel import Session, select
from database import get_session
from models import (
    Item, Listing, Sale, SaleCreate, SaleRead, SaleUpdate,
    apply_updates, item_payload,
)

router = APIRouter(prefix="/api/sold", tags=["sold"])


def _calc_net(sale_price: float, platform_fees: float, shipping_cost: float, purchase_price: float) -> float:
    return round(sale_price - platform_fees - shipping_cost - purchase_price, 2)


def _read(sale: Sale, item: Item | None) -> dict:
    d = sale.model_dump()
    d["item"] = item_payload(item)
    return d


@router.get("/", response_model=list[SaleRead])
def list_sales(session: Session = Depends(get_session)):
    sales = session.exec(select(Sale).order_by(Sale.created_at.desc())).all()
    return [_read(s, session.get(Item, s.item_id)) for s in sales]


@router.post("/", response_model=SaleRead, status_code=201)
def create_sale(sale: SaleCreate, session: Session = Depends(get_session)):
    item = session.get(Item, sale.item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    net = _calc_net(sale.sale_price, sale.platform_fees, sale.shipping_cost, item.purchase_price)
    db_sale = Sale(**sale.model_dump(), net_profit=net)
    session.add(db_sale)
    item.status = "Sold"
    session.execute(delete(Listing).where(Listing.item_id == sale.item_id))
    session.commit()
    session.refresh(db_sale)
    return _read(db_sale, item)


@router.get("/{sale_id}", response_model=SaleRead)
def get_sale(sale_id: int, session: Session = Depends(get_session)):
    sale = session.get(Sale, sale_id)
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    return _read(sale, session.get(Item, sale.item_id))


@router.patch("/{sale_id}", response_model=SaleRead)
def update_sale(sale_id: int, updates: SaleUpdate, session: Session = Depends(get_session)):
    sale = session.get(Sale, sale_id)
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    apply_updates(sale, updates)
    item = session.get(Item, sale.item_id)
    if item:
        sale.net_profit = _calc_net(sale.sale_price, sale.platform_fees, sale.shipping_cost, item.purchase_price)
    session.add(sale)
    session.commit()
    session.refresh(sale)
    return _read(sale, item)


@router.delete("/{sale_id}", status_code=204)
def delete_sale(sale_id: int, session: Session = Depends(get_session)):
    sale = session.get(Sale, sale_id)
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    session.delete(sale)
    session.commit()
