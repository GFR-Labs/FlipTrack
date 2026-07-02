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


def get_session():
    with Session(engine) as session:
        yield session
