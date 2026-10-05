import re
import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, File, UploadFile, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlmodel import Session, select
from database import get_session
from models import Expense, Item, Lot, Receipt, Sale

RECEIPTS_DIR = Path("/data/receipts")
ALLOWED_MIME = {
    "image/jpeg", "image/jpg", "image/png", "image/webp",
    "image/gif", "image/heic", "application/pdf",
}
MAX_BYTES = 15 * 1024 * 1024  # 15 MB

KINDS = {"sourcing", "sale", "expense", "other"}
DEFAULT_KIND = {"item": "sourcing", "lot": "sourcing", "sale": "sale", "expense": "expense"}

router = APIRouter(prefix="/api/receipts", tags=["receipts"])


def _stored_name(receipt: Receipt, ext: str) -> str:
    """Human-readable, collision-free on-disk name: the receipt's kind leads,
    the entity and receipt id keep it unique."""
    return f"{receipt.kind}-receipt_{receipt.entity_type}{receipt.entity_id}_r{receipt.id}{ext}"


def _validate_kind(kind: str) -> str:
    if kind not in KINDS:
        raise HTTPException(400, f"kind must be one of: {', '.join(sorted(KINDS))}")
    return kind


class ReceiptUpdate(BaseModel):
    kind: str


@router.get("/all")
def list_all_receipts(session: Session = Depends(get_session)):
    """Every receipt with a label for what it's attached to — feeds the
    Attachments tab."""
    receipts = session.exec(select(Receipt).order_by(Receipt.created_at.desc())).all()

    items    = {i.id: i for i in session.exec(select(Item)).all()}
    sales    = {s.id: s for s in session.exec(select(Sale)).all()}
    expenses = {e.id: e for e in session.exec(select(Expense)).all()}
    lots     = {l.id: l for l in session.exec(select(Lot)).all()}

    def label(r: Receipt) -> str:
        if r.entity_type == "item":
            it = items.get(r.entity_id)
            return it.name if it else f"Deleted item #{r.entity_id}"
        if r.entity_type == "sale":
            s = sales.get(r.entity_id)
            if not s:
                return f"Deleted sale #{r.entity_id}"
            it = items.get(s.item_id)
            return f"Sale of {it.name}" if it else f"Sale #{r.entity_id}"
        if r.entity_type == "expense":
            e = expenses.get(r.entity_id)
            return (e.description or e.category) if e else f"Deleted expense #{r.entity_id}"
        if r.entity_type == "lot":
            l = lots.get(r.entity_id)
            return l.name if l else f"Deleted lot #{r.entity_id}"
        return f"{r.entity_type} #{r.entity_id}"

    return [
        {
            **r.model_dump(),
            "entity_label": label(r),
            "file_missing": not (RECEIPTS_DIR / r.filename).exists(),
        }
        for r in receipts
    ]


@router.get("/")
def list_receipts(
    entity_type: str = Query(...),
    entity_id: int = Query(...),
    session: Session = Depends(get_session),
):
    return session.exec(
        select(Receipt)
        .where(Receipt.entity_type == entity_type, Receipt.entity_id == entity_id)
        .order_by(Receipt.created_at)
    ).all()


@router.post("/", status_code=201)
async def upload_receipt(
    entity_type: str = Query(...),
    entity_id: int = Query(...),
    kind: str = Query(None),
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
):
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_MIME:
        raise HTTPException(400, f"File type not allowed: {content_type}")

    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(400, "File exceeds 15 MB limit")

    kind = _validate_kind(kind) if kind else DEFAULT_KIND.get(entity_type, "other")

    RECEIPTS_DIR.mkdir(parents=True, exist_ok=True)
    suffix = Path(file.filename or "file").suffix.lower() or ".bin"
    suffix = re.sub(r"[^.\w]", "", suffix)[:10] or ".bin"

    receipt = Receipt(
        entity_type=entity_type,
        entity_id=entity_id,
        filename=f"pending-{uuid.uuid4()}{suffix}",
        original_name=file.filename or "file",
        mime_type=content_type,
        size_bytes=len(data),
        kind=kind,
    )
    session.add(receipt)
    session.flush()  # assigns receipt.id for the stored name
    receipt.filename = _stored_name(receipt, suffix)
    try:
        (RECEIPTS_DIR / receipt.filename).write_bytes(data)
    except OSError as exc:
        session.rollback()
        raise HTTPException(500, f"Could not store file: {exc}")
    session.add(receipt)
    session.commit()
    session.refresh(receipt)
    return receipt


@router.patch("/{receipt_id}")
def update_receipt(receipt_id: int, updates: ReceiptUpdate, session: Session = Depends(get_session)):
    """Change what a receipt is (sourcing/sale/expense), renaming the stored
    file to match so exports and the folder on disk stay truthful."""
    receipt = session.get(Receipt, receipt_id)
    if not receipt:
        raise HTTPException(404, "Receipt not found")
    kind = _validate_kind(updates.kind)

    file_missing = not (RECEIPTS_DIR / receipt.filename).exists()
    if kind != receipt.kind:
        old_path = RECEIPTS_DIR / receipt.filename
        receipt.kind = kind
        ext = Path(receipt.filename).suffix
        new_name = _stored_name(receipt, ext)
        if old_path.exists():
            try:
                old_path.rename(RECEIPTS_DIR / new_name)
            except OSError as exc:
                raise HTTPException(500, f"Could not rename file: {exc}")
            receipt.filename = new_name
            file_missing = False
        # A missing file still gets its kind corrected; the gap stays
        # visible in the report and the Attachments tab.
        session.add(receipt)
        session.commit()
        session.refresh(receipt)

    return {**receipt.model_dump(), "file_missing": file_missing}


@router.get("/{receipt_id}/file")
def serve_file(receipt_id: int, session: Session = Depends(get_session)):
    receipt = session.get(Receipt, receipt_id)
    if not receipt:
        raise HTTPException(404, "Receipt not found")
    path = RECEIPTS_DIR / receipt.filename
    if not path.exists():
        raise HTTPException(404, "File missing from disk")
    return FileResponse(path, media_type=receipt.mime_type, filename=receipt.original_name)


@router.delete("/{receipt_id}", status_code=204)
def delete_receipt(receipt_id: int, session: Session = Depends(get_session)):
    receipt = session.get(Receipt, receipt_id)
    if not receipt:
        raise HTTPException(404, "Receipt not found")
    path = RECEIPTS_DIR / receipt.filename
    if path.exists():
        path.unlink()
    session.delete(receipt)
    session.commit()
