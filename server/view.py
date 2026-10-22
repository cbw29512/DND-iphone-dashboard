"""Privacy boundary: no private state enters the player payload."""
from .database import connect

KINDS = ("gallery", "map", "initiative", "scene", "dice")


def full_state():
    with connect() as db:
        settings = dict(db.execute("SELECT * FROM settings WHERE id=1").fetchone())
        media = [dict(x) for x in db.execute("SELECT id,category,name,position FROM media ORDER BY category,position,created_at")]
        combatants = [dict(x) for x in db.execute("SELECT * FROM combatants ORDER BY initiative DESC,position ASC")]
    return {"settings": settings, "media": media, "combatants": combatants}


def public_state(card_override=None, asset_override=None):
    with connect() as db:
        settings = db.execute("SELECT active_card,active_asset,revision,scene_text,dice_text,dice_effect,dice_roll_id,round_number,active_turn FROM settings WHERE id=1").fetchone()
        active = card_override if card_override in KINDS else (settings["active_card"] if card_override is None else None)
        result = {"card": active, "revision": settings["revision"], "content": None}
        if active in ("gallery", "map"):
            asset = db.execute("SELECT id,name FROM media WHERE id=? AND category=?",
                               (asset_override if asset_override else settings["active_asset"], active)).fetchone()
            if not asset and card_override is not None:
                asset = db.execute("SELECT id,name FROM media WHERE category=? ORDER BY position LIMIT 1", (active,)).fetchone()
            result["content"] = {"asset": dict(asset) if asset else None}
        elif active == "initiative":
            combatants = db.execute("SELECT id,name,initiative FROM combatants WHERE visible=1 ORDER BY initiative DESC,position ASC").fetchall()
            visible = [dict(x) for x in combatants]
            result["content"] = {"round": settings["round_number"], "active_turn": settings["active_turn"] if any(x["id"] == settings["active_turn"] for x in visible) else None, "combatants": visible}
        elif active == "scene":
            result["content"] = {"text": settings["scene_text"]}
        elif active == "dice":
            result["content"] = {"text": settings["dice_text"], "effect": settings["dice_effect"], "roll_id": settings["dice_roll_id"]}
    return result
