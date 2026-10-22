"""All card actions change server-authoritative state and announce revisions."""
import logging
import secrets
import uuid
from fastapi import APIRouter, HTTPException, Query, Request
from .database import connect, revision
from .realtime import publish
from .schema import CardKind, Combatant, Dice, Roll, Scene, Selection, Share
from .security import require, require_write
from .view import full_state, public_state

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api")


@router.get("/dm/state")
def dm_state(request: Request):
    require(request, dm_only=True)
    return full_state()


@router.get("/display/state")
def display_state(request: Request):
    require(request)
    return public_state()


@router.get("/dm/preview")
def dm_preview(request: Request, card: CardKind, asset_id: str | None = None):
    require(request, dm_only=True)
    return public_state(card_override=card, asset_override=asset_id)


@router.post("/share")
def share(request: Request, body: Share):
    require_write(request)
    with connect() as db:
        asset_id = None
        if body.card in ("gallery", "map"):
            row = db.execute("SELECT id FROM media WHERE category=? ORDER BY position LIMIT 1", (body.card,)).fetchone()
            asset_id = row["id"] if row else None
        db.execute("UPDATE settings SET active_card=?, active_asset=? WHERE id=1", (body.card, asset_id))
        revision(db)
    publish()
    return public_state()


@router.post("/selection")
def selection(request: Request, body: Selection):
    require_write(request)
    with connect() as db:
        active = db.execute("SELECT active_card FROM settings WHERE id=1").fetchone()[0]
        if active not in ("gallery", "map"):
            raise HTTPException(409, "Share an artwork card first")
        media = db.execute("SELECT id FROM media WHERE id=? AND category=?", (body.asset_id, active)).fetchone()
        if not media:
            raise HTTPException(404, "Image not in selected gallery")
        db.execute("UPDATE settings SET active_asset=? WHERE id=1", (body.asset_id,))
        revision(db)
    publish()
    return public_state()


@router.put("/scene")
def scene(request: Request, body: Scene):
    require_write(request)
    with connect() as db:
        db.execute("UPDATE settings SET scene_text=? WHERE id=1", (body.text,))
        revision(db)
    publish()
    return {"ok": True}


@router.post("/dice")
def dice(request: Request, body: Dice):
    require_write(request)
    with connect() as db:
        db.execute("UPDATE settings SET dice_text=? WHERE id=1", (body.text,))
        revision(db)
    publish()
    return {"ok": True}


@router.post("/combatants")
def add_combatant(request: Request, body: Combatant):
    require_write(request)
    identity = str(uuid.uuid4())
    with connect() as db:
        order = db.execute("SELECT COUNT(*) FROM combatants").fetchone()[0]
        db.execute("INSERT INTO combatants VALUES (?,?,?,?,?,?,?,?)", (identity, body.name.strip(), body.initiative,
            order, body.hp_current, body.hp_max, body.private_note, int(body.visible)))
        revision(db)
    publish()
    return {"id": identity}


@router.delete("/combatants/{combatant_id}")
def remove_combatant(request: Request, combatant_id: str):
    require_write(request)
    with connect() as db:
        db.execute("DELETE FROM combatants WHERE id=?", (combatant_id,))
        db.execute("UPDATE settings SET active_turn=NULL WHERE active_turn=?", (combatant_id,))
        revision(db)
    publish()
    return {"ok": True}


@router.post("/combat/next")
def advance(request: Request):
    require_write(request)
    with connect() as db:
        order = [r["id"] for r in db.execute("SELECT id FROM combatants ORDER BY initiative DESC, position ASC")]
        settings = db.execute("SELECT active_turn,round_number FROM settings WHERE id=1").fetchone()
        if not order:
            raise HTTPException(409, "Add combatants before advancing turns")
        current = settings["active_turn"]
        index = order.index(current) if current in order else -1
        next_index = (index + 1) % len(order)
        next_round = settings["round_number"] + int(index == len(order) - 1)
        db.execute("UPDATE settings SET active_turn=?,round_number=? WHERE id=1", (order[next_index], next_round))
        revision(db)
    publish()
    return public_state()


@router.post("/combat/reset")
def reset(request: Request):
    require_write(request)
    with connect() as db:
        db.execute("UPDATE settings SET active_turn=NULL,round_number=1 WHERE id=1")
        revision(db)
    publish()
    return {"ok": True}


@router.post("/dice/roll")
def roll(request: Request, body: Roll):
    require_write(request)
    values = [1 + secrets.randbelow(body.sides) for _ in range(body.count)]
    total = sum(values) + body.modifier
    expression = f"{body.count}d{body.sides}"
    if body.modifier:
        expression += f" {body.modifier:+d}"
    with connect() as db:
        db.execute("UPDATE settings SET dice_text=? WHERE id=1", (f"{expression}: {total}",))
        revision(db)
    publish()
    return {"total": total, "rolls": values, "modifier": body.modifier}
