"""Safe image processing and permission-aware access to files."""
import io
import logging
import uuid
from pathlib import Path
from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from PIL import Image, ImageOps, UnidentifiedImageError
from .config import DATA
from .database import connect, revision
from .realtime import publish
from .security import require, require_write

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api")
ALLOWED = {"JPEG", "PNG", "WEBP", "GIF"}
MAX_BYTES = 12 * 1024 * 1024
MAX_PIXELS = 30_000_000


def process_image(content: bytes) -> tuple[bytes, str, str]:
    try:
        with Image.open(io.BytesIO(content)) as check:
            if check.format not in ALLOWED or check.width * check.height > MAX_PIXELS:
                raise ValueError("Unsupported or oversized image")
            kind = check.format
            check.verify()
        if kind == "GIF":
            return content, "image/gif", ".gif"  # Preserves animated assets.
        with Image.open(io.BytesIO(content)) as image:
            image = ImageOps.exif_transpose(image)
            image.thumbnail((1920, 1920), Image.Resampling.LANCZOS)
            image = image.convert("RGBA" if "A" in image.getbands() else "RGB")
            dest = io.BytesIO()
            image.save(dest, format="WEBP", quality=84, method=5)
            return dest.getvalue(), "image/webp", ".webp"
    except (UnidentifiedImageError, ValueError, OSError, Image.DecompressionBombError) as exc:
        logger.warning("Rejected invalid image: %s", type(exc).__name__)
        raise HTTPException(415, "Invalid or unsupported image") from exc


@router.post("/media")
async def upload(request: Request, file: UploadFile = File(...), category: str = Form("gallery")):
    require_write(request)
    if category not in ("gallery", "map"):
        raise HTTPException(422, "Unknown gallery category")
    try:
        original = await file.read(MAX_BYTES + 1)
        if len(original) > MAX_BYTES:
            raise HTTPException(413, "Image exceeds the 12 MB upload limit")
        data, mime, extension = process_image(original)
        identity = str(uuid.uuid4())
        folder = DATA / "media"
        folder.mkdir(parents=True, exist_ok=True)
        destination = folder / (identity + extension)
        destination.write_bytes(data)
        with connect() as db:
            position = db.execute("SELECT COUNT(*) FROM media WHERE category=?", (category,)).fetchone()[0]
            db.execute("INSERT INTO media (id,category,name,stored_name,content_type,position) VALUES (?,?,?,?,?,?)",
                       (identity, category, Path(file.filename or "Artwork").name[:120], destination.name, mime, position))
            revision(db)
        publish()
        return {"id": identity, "name": Path(file.filename or "Artwork").name[:120]}
    except HTTPException:
        raise
    except (OSError, ValueError):
        logger.exception("Media upload failed")
        raise HTTPException(500, "Unable to store image")
    finally:
        await file.close()


@router.get("/media/{asset_id}")
def media(request: Request, asset_id: str):
    role = require(request)
    with connect() as db:
        asset = db.execute("SELECT * FROM media WHERE id=?", (asset_id,)).fetchone()
        setting = db.execute("SELECT active_asset,active_card,active_turn FROM settings WHERE id=1").fetchone()
        visible_token = None
        if setting["active_card"] == "initiative" and setting["active_turn"]:
            visible_token = db.execute(
                "SELECT token_asset_id FROM combatants WHERE id=? AND visible=1",
                (setting["active_turn"],)
            ).fetchone()
    if not asset or (role == "player" and not (
        (setting["active_asset"] == asset_id and setting["active_card"] == asset["category"])
        or (asset["category"] == "gallery" and visible_token and visible_token["token_asset_id"] == asset_id)
    )):
        raise HTTPException(404, "Media not found")
    path = DATA / "media" / asset["stored_name"]
    if not path.is_file():
        logger.error("Stored asset is missing: %s", asset_id)
        raise HTTPException(404, "Media file is missing")
    return FileResponse(path, media_type=asset["content_type"], headers={"Cache-Control": "private, max-age=60", "X-Content-Type-Options": "nosniff"})


@router.delete("/media/{asset_id}")
def delete_media(request: Request, asset_id: str):
    require_write(request)
    with connect() as db:
        row = db.execute("SELECT stored_name FROM media WHERE id=?", (asset_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Media not found")
        db.execute("DELETE FROM media WHERE id=?", (asset_id,))
        db.execute("UPDATE settings SET active_asset=NULL WHERE active_asset=?", (asset_id,))
        revision(db)
    try:
        (DATA / "media" / row["stored_name"]).unlink(missing_ok=True)
    except OSError:
        logger.exception("Could not clean deleted media file")
    publish()
    return {"ok": True}
