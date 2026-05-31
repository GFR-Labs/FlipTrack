import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, File, UploadFile, HTTPException, Query
from fastapi.responses import FileResponse
from sqlmodel import Session, select
from database import get_session
from models import Receipt

RECEIPTS_DIR = Path("/data/receipts")
ALLOWED_MIME = {
    "image/jpeg", "image/jpg", "image/png", "image/webp",
    "image/gif", "image/heic", "application/pdf",
}
MAX_BYTES = 15 * 1024 * 1024  # 15 MB

router = APIRouter(prefix="/api/receipts", tags=["receipts"])


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
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
):
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_MIME:
        raise HTTPException(400, f"File type not allowed: {content_type}")

    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(400, "File exceeds 15 MB limit")

    RECEIPTS_DIR.mkdir(parents=True, exist_ok=True)
    suffix = Path(file.filename or "file").suffix.lower() or ".bin"
    stored = f"{uuid.uuid4()}{suffix}"
    (RECEIPTS_DIR / stored).write_bytes(data)

    receipt = Receipt(
        entity_type=entity_type,
        entity_id=entity_id,
        filename=stored,
        original_name=file.filename or stored,
        mime_type=content_type,
        size_bytes=len(data),
    )
    session.add(receipt)
    session.commit()
    session.refresh(receipt)
    return receipt


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
