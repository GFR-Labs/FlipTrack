import os
from sqlalchemy import event
from sqlmodel import SQLModel, create_engine, Session

DB_PATH = os.getenv("DATABASE_URL", "sqlite:////data/fliptrack.db")
engine = create_engine(DB_PATH, echo=False, connect_args={"check_same_thread": False, "timeout": 30})


@event.listens_for(engine, "connect")
def set_sqlite_pragmas(dbapi_conn, connection_record):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.close()


def init_db():
    SQLModel.metadata.create_all(engine)
    _migrate()


def _migrate():
    """Minimal in-place migrations: create_all only creates missing tables,
    it never alters existing ones, so columns added to existing tables must
    be bolted on here for databases created by older versions."""
    with engine.connect() as conn:
        cols = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info(items)")}
        if "lot_id" not in cols:
            conn.exec_driver_sql("ALTER TABLE items ADD COLUMN lot_id INTEGER REFERENCES lots(id)")
        rcols = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info(receipts)")}
        if "kind" not in rcols:
            conn.exec_driver_sql("ALTER TABLE receipts ADD COLUMN kind VARCHAR NOT NULL DEFAULT 'other'")
            # Backfill from what the receipt is attached to — the best guess
            # for rows uploaded before kinds existed.
            conn.exec_driver_sql(
                "UPDATE receipts SET kind = CASE entity_type "
                "WHEN 'item' THEN 'sourcing' WHEN 'lot' THEN 'sourcing' "
                "WHEN 'sale' THEN 'sale' WHEN 'expense' THEN 'expense' "
                "ELSE 'other' END"
            )
        conn.commit()


def get_session():
    # expire_on_commit=False keeps attributes readable after commit. With the
    # default, commit() clears each instance's __dict__ and any model_dump()
    # that follows serializes to {} instead of reloading the row.
    with Session(engine, expire_on_commit=False) as session:
        yield session
