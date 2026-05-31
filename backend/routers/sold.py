from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from database import get_session
from models import Item, Sale, SaleCreate, SaleRead, SaleUpdate

router = APIRouter(prefix="/api/sold", tags=["sold"])


def _calc_net(sale_price: float, platform_fees: float, shipping_cost: float, purchase_price: float) -> float:
    return round(sale_price - platform_fees - shipping_cost - purchase_price, 2)


@router.get("/", response_model=list[SaleRead])
def list_sales(session: Session = Depends(get_session)):
    sales = session.exec(select(Sale).order_by(Sale.created_at.desc())).all()
    result = []
    for sale in sales:
        item = session.get(Item, sale.item_id)
        d = sale.model_dump()
        d["item"] = item.model_dump() if item else None
        result.append(d)
    return result


@router.post("/", response_model=SaleRead, status_code=201)
def create_sale(sale: SaleCreate, session: Session = Depends(get_session)):
    item = session.get(Item, sale.item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    net = _calc_net(sale.sale_price, sale.platform_fees, sale.shipping_cost, item.purchase_price)
    db_sale = Sale(**sale.model_dump(), net_profit=net)
    session.add(db_sale)
    item.status = "Sold"
    session.add(item)
    session.commit()
    session.refresh(db_sale)
    d = db_sale.model_dump()
    d["item"] = item.model_dump()
    return d


@router.get("/{sale_id}", response_model=SaleRead)
def get_sale(sale_id: int, session: Session = Depends(get_session)):
    sale = session.get(Sale, sale_id)
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    item = session.get(Item, sale.item_id)
    d = sale.model_dump()
    d["item"] = item.model_dump() if item else None
    return d


@router.patch("/{sale_id}", response_model=SaleRead)
def update_sale(sale_id: int, updates: SaleUpdate, session: Session = Depends(get_session)):
    sale = session.get(Sale, sale_id)
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    for field, value in updates.model_dump(exclude_unset=True).items():
        setattr(sale, field, value)
    item = session.get(Item, sale.item_id)
    if item:
        sale.net_profit = _calc_net(sale.sale_price, sale.platform_fees, sale.shipping_cost, item.purchase_price)
    session.add(sale)
    session.commit()
    session.refresh(sale)
    d = sale.model_dump()
    d["item"] = item.model_dump() if item else None
    return d


@router.delete("/{sale_id}", status_code=204)
def delete_sale(sale_id: int, session: Session = Depends(get_session)):
    sale = session.get(Sale, sale_id)
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    session.delete(sale)
    session.commit()
