from pathlib import Path
from fastapi import APIRouter

router = APIRouter(prefix="/api/system", tags=["system"])

DATA_DIR = Path("/data")


def _fmt(n: int) -> str:
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if n < 1024:
            return f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} PB"


@router.get("/storage")
def storage_stats():
    total = sum(f.stat().st_size for f in DATA_DIR.rglob("*") if f.is_file())
    return {"bytes": total, "human": _fmt(total)}
