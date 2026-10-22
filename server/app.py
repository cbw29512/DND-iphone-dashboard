"""Same-origin FastAPI application: local DM + iPhone display."""
import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from .config import ROOT, bootstrap
from .database import initialize
from .realtime import subscribe, unsubscribe
from .routes_auth import router as auth_router
from .routes_cards import router as cards_router
from .routes_media import router as media_router
from .security import require

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)
WEB = ROOT / "web"


@asynccontextmanager
async def lifespan(_app: FastAPI):
    initialize()
    passphrase = bootstrap()
    logger.warning("Local DM passphrase (do not share): %s", passphrase)
    logger.info("Open http://localhost:8000 on Windows; use your laptop LAN IP on iPhone")
    yield


app = FastAPI(title="D&D Flex Dashboard", lifespan=lifespan, docs_url=None, redoc_url=None)
app.include_router(auth_router)
app.include_router(cards_router)
app.include_router(media_router)
app.mount("/static", StaticFiles(directory=WEB), name="static")


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Cache-Control"] = "no-store" if request.url.path.startswith("/api/") else "no-cache"
    response.headers["Content-Security-Policy"] = ("default-src 'self'; img-src 'self' data:; "
        "style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'")
    return response


@app.get("/")
def dashboard():
    return FileResponse(WEB / "index.html")


@app.get("/display")
def display():
    return FileResponse(WEB / "display.html")


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/events")
async def events(request: Request):
    require(request)
    queue = subscribe()

    async def stream():
        try:
            yield "event: refresh\ndata: connected\n\n"
            while True:
                try:
                    await asyncio.wait_for(queue.get(), timeout=18)
                    yield "event: refresh\ndata: changed\n\n"
                except asyncio.TimeoutError:
                    yield ": heartbeat\n\n"
        except asyncio.CancelledError:
            logger.debug("Display stream disconnected")
            raise
        finally:
            unsubscribe(queue)

    return StreamingResponse(stream(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
