"""All card actions change server-authoritative state and announce revisions."""
import logging
import secrets
import uuid
from fastapi import APIRouter, HTTPException, Query, Request
from .database import connect, revision
from .realtime import publish
from .schema import CardKind, Combatant, Dice, Roll, Scene, Selection, Share, EncounterNew, EncounterMember, AttackRoll
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
        db.execute("UPDATE settings SET active_card='initiative',active_turn=?,round_number=?,attack_natural=NULL,attack_bonus=NULL,attack_total=NULL,attack_actor=NULL,attack_damage=NULL,attack_damage_type=NULL,attack_damage_formula=NULL,attack_name=NULL,attack_condition=NULL,attack_save_ability=NULL,attack_save_dc=NULL,attack_target=NULL,attack_target_ac=NULL,attack_hit=NULL WHERE id=1", (order[next_index], next_round))
        revision(db)
    publish()
    return public_state()


@router.post("/combat/reset")
def reset(request: Request):
    require_write(request)
    with connect() as db:
        db.execute("UPDATE settings SET active_turn=NULL,round_number=1,attack_natural=NULL,attack_bonus=NULL,attack_total=NULL,attack_actor=NULL WHERE id=1")
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
            "INSERT INTO encounter_members(id,encounter_id,name,modifier,visible,token_asset_id,attack_bonus,armor_class,position) VALUES (?,?,?,?,?,?,?,?,?)",
            (identity, encounter_id, body.name.strip(), body.modifier, int(body.visible), body.token_asset_id, body.attack_bonus, body.armor_class, pos)
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
            "SELECT name,modifier,visible,token_asset_id,attack_bonus,armor_class FROM encounter_members WHERE encounter_id=? ORDER BY position,rowid",
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
                "INSERT INTO combatants(id,name,initiative,position,visible,token_asset_id,attack_bonus,armor_class) VALUES (?,?,?,?,?,?,?,?)",
                (identity, member["name"], total, index, member["visible"], member["token_asset_id"], member["attack_bonus"], member["armor_class"])
            )
            scores.append({"name": member["name"], "roll": natural, "modifier": member["modifier"], "total": total, "position": index})
        scores.sort(key=lambda x: (-x["total"], x["position"]))
        first = db.execute("SELECT id FROM combatants ORDER BY initiative DESC,position ASC LIMIT 1").fetchone()["id"]
        db.execute("UPDATE settings SET round_number=1,active_turn=?,active_card='initiative',attack_natural=NULL,attack_bonus=NULL,attack_total=NULL,attack_actor=NULL WHERE id=1", (first,))
        revision(db)
    publish()
    return {"rolls": [{k: v for k, v in score.items() if k != "position"} for score in scores], "round": 1}


@router.post("/combat/attack")
def monster_attack(request: Request, body: AttackRoll):
    require_write(request)
    with connect() as db:
        current = db.execute("SELECT active_turn FROM settings WHERE id=1").fetchone()["active_turn"]
        if body.combatant_id != current:
            raise HTTPException(409, "Only the active combatant may attack")
        actor = db.execute("SELECT name,attack_bonus,visible FROM combatants WHERE id=?", (current,)).fetchone()
        if actor is None or not actor["visible"]:
            raise HTTPException(409, "Cannot display this combatant")
        profile = None
        if body.profile_id:
            profile = db.execute("SELECT * FROM monster_attack_profiles WHERE id=? AND source_complete=1", (body.profile_id,)).fetchone()
            if profile is None or profile["monster_id"] != actor["name"].casefold().replace(" ", "-"):
                raise HTTPException(422, "Attack profile does not match the active monster")
        if profile is None:
            raise HTTPException(409, "Choose a verified monster attack profile before rolling hit and damage")
        target = None
        if body.target_id:
            target = db.execute("SELECT id,name,armor_class FROM combatants WHERE id=?", (body.target_id,)).fetchone()
            if target is None or target["armor_class"] is None:
                raise HTTPException(422, "Target must have a saved Armor Class")
        bonus = profile["attack_bonus"]
        raw = [1 + secrets.randbelow(20) for _ in range(2 if body.mode != "normal" else 1)]
        natural = max(raw) if body.mode == "advantage" else min(raw) if body.mode == "disadvantage" else raw[0]
        total = natural + bonus
        hit = (natural == 20 or (natural != 1 and total >= target["armor_class"])) if target else None
        damage_rolls = [1 + secrets.randbelow(profile["damage_sides"]) for _ in range(profile["damage_count"] * (2 if natural == 20 else 1))]
        damage = sum(damage_rolls) + profile["damage_bonus"]
        damage_formula = f'{len(damage_rolls)}d{profile["damage_sides"]} {profile["damage_bonus"]:+d}'
        db.execute(
            "UPDATE settings SET active_card='initiative',attack_natural=?,attack_bonus=?,attack_total=?,attack_actor=?,attack_damage=?,attack_damage_type=?,attack_damage_formula=?,attack_name=?,attack_condition=?,attack_save_ability=?,attack_save_dc=?,attack_target=?,attack_target_ac=?,attack_hit=? WHERE id=1",
            (natural, bonus, total, current, damage, profile["damage_type"], damage_formula, profile["attack_name"], profile["effect_condition"], profile["effect_save_ability"], profile["effect_save_dc"], target["name"] if target else None, target["armor_class"] if target else None, int(hit) if hit is not None else None)
        )
        revision(db)
    publish()
    return {"natural": natural, "dice": raw, "mode": body.mode, "bonus": bonus, "total": total, "hit": hit, "damage": damage, "damage_rolls": damage_rolls, "damage_type": profile["damage_type"]}
