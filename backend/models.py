from datetime import date, datetime
from typing import Optional
from sqlmodel import Field, SQLModel, Relationship, select


class Receipt(SQLModel, table=True):
    __tablename__ = "receipts"
    id: Optional[int] = Field(default=None, primary_key=True)
    entity_type: str          # "item" | "expense" | "sale" | "lot"
    entity_id: int
    filename: str             # stored filename on disk (kind-based; legacy rows may be UUIDs)
    original_name: str
    mime_type: str
    size_bytes: int
    kind: str = "other"       # "sourcing" | "sale" | "expense" | "other"
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Lot(SQLModel, table=True):
    """A sourcing transaction (lot / part-out) whose cost is allocated across
    the items pulled from it, plus an optional personal-use portion for parts
    kept out of the business (documented, never deducted)."""
    __tablename__ = "lots"
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    total_cost: float
    date_acquired: date
    personal_use_cost: float = 0.0
    personal_use_note: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    items: list["Item"] = Relationship(back_populates="lot")


class Item(SQLModel, table=True):
    __tablename__ = "items"
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    purchase_price: float
    quantity: int = 1
    status: str = "In Stock"  # In Stock | Listed | Sold
    date_acquired: date
    notes: Optional[str] = None
    lot_id: Optional[int] = Field(default=None, foreign_key="lots.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    listings: list["Listing"] = Relationship(back_populates="item")
    sales: list["Sale"] = Relationship(back_populates="item")
    lot: Optional[Lot] = Relationship(back_populates="items")


class Listing(SQLModel, table=True):
    __tablename__ = "listings"
    id: Optional[int] = Field(default=None, primary_key=True)
    item_id: int = Field(foreign_key="items.id")
    platform: str
    asking_price: float
    listed_date: date
    url: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    item: Optional[Item] = Relationship(back_populates="listings")


class Sale(SQLModel, table=True):
    __tablename__ = "sales"
    id: Optional[int] = Field(default=None, primary_key=True)
    item_id: int = Field(foreign_key="items.id")
    sale_price: float
    platform_fees: float = 0.0
    shipping_cost: float = 0.0
    sold_date: date
    net_profit: float = 0.0
    created_at: datetime = Field(default_factory=datetime.utcnow)

    item: Optional[Item] = Relationship(back_populates="sales")


class Expense(SQLModel, table=True):
    __tablename__ = "expenses"
    id: Optional[int] = Field(default=None, primary_key=True)
    category: str
    amount: float
    date: date
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ── Read/Create schemas ─────────────────────────────────────────────────────

class ItemCreate(SQLModel):
    name: str
    purchase_price: float
    quantity: int = 1
    status: str = "In Stock"
    date_acquired: date
    notes: Optional[str] = None
    lot_id: Optional[int] = None


class ItemRead(SQLModel):
    id: int
    name: str
    purchase_price: float
    quantity: int
    status: str
    date_acquired: date
    notes: Optional[str]
    lot_id: Optional[int]
    created_at: datetime


class ItemUpdate(SQLModel):
    name: Optional[str] = None
    purchase_price: Optional[float] = None
    quantity: Optional[int] = None
    status: Optional[str] = None
    date_acquired: Optional[date] = None
    notes: Optional[str] = None
    lot_id: Optional[int] = None


class ListingCreate(SQLModel):
    item_id: int
    platform: str
    asking_price: float
    listed_date: date
    url: Optional[str] = None


class ListingRead(SQLModel):
    id: int
    item_id: int
    platform: str
    asking_price: float
    listed_date: date
    url: Optional[str]
    created_at: datetime
    item: Optional[ItemRead] = None


class ListingUpdate(SQLModel):
    platform: Optional[str] = None
    asking_price: Optional[float] = None
    listed_date: Optional[date] = None
    url: Optional[str] = None


class SaleCreate(SQLModel):
    item_id: int
    sale_price: float
    platform_fees: float = 0.0
    shipping_cost: float = 0.0
    sold_date: date


class SaleRead(SQLModel):
    id: int
    item_id: int
    sale_price: float
    platform_fees: float
    shipping_cost: float
    sold_date: date
    net_profit: float
    created_at: datetime
    item: Optional[ItemRead] = None


class SaleUpdate(SQLModel):
    sale_price: Optional[float] = None
    platform_fees: Optional[float] = None
    shipping_cost: Optional[float] = None
    sold_date: Optional[date] = None


class ExpenseCreate(SQLModel):
    category: str
    amount: float
    date: date
    description: Optional[str] = None


class ExpenseRead(SQLModel):
    id: int
    category: str
    amount: float
    date: date
    description: Optional[str]
    created_at: datetime


class ExpenseUpdate(SQLModel):
    category: Optional[str] = None
    amount: Optional[float] = None
    date: Optional[date] = None
    description: Optional[str] = None


# ── Lot schemas ─────────────────────────────────────────────────────────────

class LotCreate(SQLModel):
    name: str
    total_cost: float
    date_acquired: date
    personal_use_cost: float = 0.0
    personal_use_note: Optional[str] = None
    notes: Optional[str] = None


class LotUpdate(SQLModel):
    name: Optional[str] = None
    total_cost: Optional[float] = None
    date_acquired: Optional[date] = None
    personal_use_cost: Optional[float] = None
    personal_use_note: Optional[str] = None
    notes: Optional[str] = None


class LotAllocation(SQLModel):
    """Bulk cost allocation for a lot. `items` maps item_id -> allocated cost
    in dollars (the frontend converts even splits and percentages to dollars
    before sending). Personal-use fields are optional."""
    items: dict[int, float] = {}
    personal_use_cost: Optional[float] = None
    personal_use_note: Optional[str] = None


# ── Helpers ─────────────────────────────────────────────────────────────────

def item_payload(item: Optional[Item]) -> Optional[dict]:
    """Serialize an Item for embedding in a Listing/Sale response.

    Reads through attribute access rather than model_dump(), because
    session.commit() expires every instance by clearing its __dict__ and
    model_dump() reads __dict__ directly — it would return {} instead of
    reloading the row.
    """
    if item is None:
        return None
    return ItemRead.model_validate(item, from_attributes=True).model_dump()


def apply_updates(obj: SQLModel, updates: SQLModel, nullable: frozenset[str] = frozenset()) -> None:
    """Apply a PATCH payload, skipping nulls for columns that can't hold them.

    Every field on the *Update schemas defaults to None so it can be omitted,
    which means an explicit null is indistinguishable from "clear this value".
    Only fields listed in `nullable` are allowed to be set to None; writing
    None to any other column raises IntegrityError on commit.
    """
    for field, value in updates.model_dump(exclude_unset=True).items():
        if value is None and field not in nullable:
            continue
        setattr(obj, field, value)


def reprice_item(session, item: Item, new_price: float) -> None:
    """Change an item's purchase price and keep its recorded sales consistent:
    net_profit derives from the purchase price, so every sale of the item is
    recomputed. The caller commits."""
    item.purchase_price = new_price
    session.add(item)
    for sale in session.exec(select(Sale).where(Sale.item_id == item.id)).all():
        sale.net_profit = round(
            sale.sale_price - sale.platform_fees - sale.shipping_cost - new_price, 2
        )
        session.add(sale)
