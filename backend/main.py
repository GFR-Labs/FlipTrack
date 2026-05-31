from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path
from database import init_db
from routers import inventory, listings, sold, expenses, dashboard, business, bulk_add

app = FastAPI(title="FlipTrack API", version="1.0.0")

app.include_router(inventory.router)
app.include_router(listings.router)
app.include_router(sold.router)
app.include_router(expenses.router)
app.include_router(dashboard.router)
app.include_router(business.router)
app.include_router(bulk_add.router)


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
