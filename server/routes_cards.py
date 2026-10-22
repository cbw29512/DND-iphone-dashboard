"""All card actions change server-authoritative state and announce revisions."""
import logging
import secrets
import uuid
from fastapi import APIRouter, HTTPException, Query, Request
from .database import connect, revision
from .realtime import publish
from .schema import CardKind, Combatant, Dice, Roll, Scene, Selection, Share, EncounterNew, EncounterMember
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
        if body.token_asset_id and not db.execute("SELECT 1 FROM media WHERE id=? AND category='gallery'", (body.token_asset_id,)).fetchone():
            raise HTTPException(400, "Token artwork not found in gallery")
        db.execute("INSERT INTO combatants (id,name,initiative,position,hp_current,hp_max,private_note,visible,token_asset_id) VALUES (?,?,?,?,?,?,?,?,?)", (identity, body.name.strip(), body.initiative,
            order, body.hp_current, body.hp_max, body.private_note, int(body.visible), body.token_asset_id))
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


@router.post("/encounters")
def create_encounter(request: Request, body: EncounterNew):
    require_write(request)
    identity = str(uuid.uuid4())
    with connect() as db:
        db.execute("INSERT INTO encounters(id,name) VALUES (?,?)", (identity, body.name.strip()))
        revision(db)
    publish()
    return {"id": identity}


@router.post("/encounters/{encounter_id}/members")
def add_member(request: Request, encounter_id: str, body: EncounterMember):
    require_write(request)
    identity = str(uuid.uuid4())
    with connect() as db:
        if not db.execute("SELECT id FROM encounters WHERE id=?", (encounter_id,)).fetchone():
            raise HTTPException(404, "Encounter not found")
        if body.token_asset_id and not db.execute(
            "SELECT id FROM media WHERE id=? AND category='gallery'", (body.token_asset_id,)
        ).fetchone():
            raise HTTPException(400, "Token artwork not found")
        pos = db.execute("SELECT COUNT(*) FROM encounter_members WHERE encounter_id=?", (encounter_id,)).fetchone()[0]
        db.execute(
            "INSERT INTO encounter_members(id,encounter_id,name,modifier,visible,token_asset_id,position) VALUES (?,?,?,?,?,?,?)",
            (identity, encounter_id, body.name.strip(), body.modifier, int(body.visible), body.token_asset_id, pos)
        )
        revision(db)
    publish()
    return {"id": identity}


@router.delete("/encounters/{encounter_id}/members/{member_id}")
def delete_member(request: Request, encounter_id: str, member_id: str):
    require_write(request)
    with connect() as db:
        db.execute("DELETE FROM encounter_members WHERE id=? AND encounter_id=?", (member_id, encounter_id))
        revision(db)
    publish()
    return {"ok": True}


@router.post("/encounters/{encounter_id}/start")
def start_encounter(request: Request, encounter_id: str):
    require_write(request)
    with connect() as db:
        if not db.execute("SELECT id FROM encounters WHERE id=?", (encounter_id,)).fetchone():
            raise HTTPException(404, "Encounter not found")
        members = db.execute(
            "SELECT name,modifier,visible,token_asset_id FROM encounter_members WHERE encounter_id=? ORDER BY position,rowid",
            (encounter_id,)
        ).fetchall()
        if not members:
            raise HTTPException(409, "Add participants before starting combat")
        db.execute("DELETE FROM combatants")
        scores = []
        for index, member in enumerate(members):
            natural = 1 + secrets.randbelow(20)
            total = natural + member["modifier"]
            identity = str(uuid.uuid4())
            db.execute(
                "INSERT INTO combatants(id,name,initiative,position,visible,token_asset_id) VALUES (?,?,?,?,?,?)",
                (identity, member["name"], total, index, member["visible"], member["token_asset_id"])
            )
            scores.append({"name": member["name"], "roll": natural, "modifier": member["modifier"], "total": total, "position": index})
        scores.sort(key=lambda x: (-x["total"], x["position"]))
        first = db.execute("SELECT id FROM combatants ORDER BY initiative DESC,position ASC LIMIT 1").fetchone()["id"]
        db.execute("UPDATE settings SET round_number=1,active_turn=?,active_card='initiative' WHERE id=1", (first,))
        revision(db)
    publish()
    return {"rolls": [{k: v for k, v in score.items() if k != "position"} for score in scores], "round": 1}
