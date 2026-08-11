import logging
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pathlib import Path
from database import init_db
from routers import inventory, listings, sold, expenses, dashboard, business, bulk_add, receipts, system

logger = logging.getLogger("fliptrack")

app = FastAPI(title="FlipTrack API", version="1.0.0")


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Log the traceback and return the error type instead of a bare 500.

    A generic "Internal Server Error" in the UI gives no way to tell a
    validation problem from a locked database, so surface the exception class
    to the client and keep the full traceback in the container logs.
    """
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": f"{type(exc).__name__}: {exc}"[:500]},
    )

app.include_router(inventory.router)
app.include_router(listings.router)
app.include_router(sold.router)
app.include_router(expenses.router)
app.include_router(dashboard.router)
app.include_router(business.router)
app.include_router(bulk_add.router)
app.include_router(receipts.router)
app.include_router(system.router)


@app.on_event("startup")
def on_startup():
    init_db()


STATIC_DIR = Path("/app/static")

if STATIC_DIR.exists():
    # Serve built assets (hashed JS/CSS files)
    assets_dir = STATIC_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(request: Request, full_path: str):
        # Return specific file if it exists (e.g. favicon.svg)
        candidate = STATIC_DIR / full_path
        if candidate.exists() and candidate.is_file():
            return FileResponse(candidate)
        # Everything else → SPA entry point
        return FileResponse(STATIC_DIR / "index.html")
