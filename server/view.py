"""Privacy boundary: no private state enters the player payload."""
from .database import connect

KINDS = ("gallery", "map", "initiative", "scene", "dice")


def full_state():
    with connect() as db:
        settings = dict(db.execute("SELECT * FROM settings WHERE id=1").fetchone())
        media = [dict(x) for x in db.execute("SELECT id,category,name,position FROM media ORDER BY category,position,created_at")]
        combatants = [dict(x) for x in db.execute("SELECT * FROM combatants ORDER BY initiative DESC,position ASC")]
        encounters = [dict(x) for x in db.execute("SELECT id,name FROM encounters ORDER BY rowid")]
        members = [dict(x) for x in db.execute("SELECT id,encounter_id,name,modifier,visible,token_asset_id,attack_bonus FROM encounter_members ORDER BY position,rowid")]
    return {"settings": settings, "media": media, "combatants": combatants, "encounters": encounters, "encounter_members": members}


def public_state(card_override=None, asset_override=None):
    with connect() as db:
        settings = db.execute("SELECT active_card,active_asset,revision,scene_text,dice_text,round_number,active_turn,attack_natural,attack_bonus,attack_total,attack_actor FROM settings WHERE id=1").fetchone()
        active = card_override if card_override in KINDS else (settings["active_card"] if card_override is None else None)
        result = {"card": active, "revision": settings["revision"], "content": None}
        if active in ("gallery", "map"):
            asset = db.execute("SELECT id,name FROM media WHERE id=? AND category=?",
                               (asset_override if asset_override else settings["active_asset"], active)).fetchone()
            if not asset and card_override is not None:
                asset = db.execute("SELECT id,name FROM media WHERE category=? ORDER BY position LIMIT 1", (active,)).fetchone()
            result["content"] = {"asset": dict(asset) if asset else None}
        elif active == "initiative":
            combatants = db.execute("SELECT c.id,c.name,c.initiative,c.token_asset_id AS asset_id FROM combatants c WHERE c.visible=1 ORDER BY c.initiative DESC,c.position ASC").fetchall()
            visible = [dict(x) for x in combatants]
            result["content"] = {"round": settings["round_number"], "active_turn": settings["active_turn"] if any(x["id"] == settings["active_turn"] for x in visible) else None, "combatants": visible, "attack": {"natural": settings["attack_natural"], "bonus": settings["attack_bonus"], "total": settings["attack_total"]} if settings["attack_actor"] == settings["active_turn"] and settings["attack_total"] is not None else None}
        elif active == "scene":
            result["content"] = {"text": settings["scene_text"]}
        elif active == "dice":
            result["content"] = {"text": settings["dice_text"]}
    return result
