"""Import SRD 2014 monster attacks from the pinned Iron Pit source catalog.

Run from Iron Lantern repository root:
  python scripts/import_ironpit_2014_attacks.py /path/to/D20-ironpit

This copies verified basic attack parameters only. Printed special mechanics and
multiattack must not be silently approximated by one damage roll.
"""
import json
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from server.database import initialize
from server.config import DATA


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python scripts/import_ironpit_2014_attacks.py /path/to/D20-ironpit")
    ironpit = Path(sys.argv[1]).expanduser().resolve()
    directory = ironpit / "backend" / "app" / "content" / "data"
    catalog = json.loads((directory / "srd_5_1_monsters_catalog.json").read_text(encoding="utf-8"))
    manifest = json.loads((directory / "srd_5_1_monsters_source_manifest.json").read_text(encoding="utf-8"))
    if manifest.get("ruleset") != "2014" or manifest.get("monster_count") != 327 or len(catalog) != 327:
        raise SystemExit("Refusing import: pinned 2014 SRD monster manifest mismatch.")
    rows = []
    for monster in catalog:
        for attack in monster.get("attacks", []):
            damage = attack.get("damage") or {}
            if not all(isinstance(damage.get(k), int) for k in ("dice_count","dice_size","bonus")):
                continue
            special = any(attack.get(k) for k in (
                "conditional_damage", "on_hit_damage", "on_hit_save_effect",
                "on_hit_ability_score_reduction", "on_hit_contested_movement",
                "ongoing_damage_effect", "control_effect", "charge_profile",
                "conditional_attack_advantage", "resource_id", "breakable_restraint"
            ))
            valid = bool(attack.get("source_complete", True)) and not special and damage["dice_size"] >= 2
            rows.append((
                "2014:"+monster["id"]+":"+attack["id"], monster["id"], attack["name"],
                int(attack["attack_bonus"]), damage["dice_count"], damage["dice_size"],
                damage["bonus"], str(damage.get("type") or "untyped"),
                "2014", int(valid)
            ))
    initialize()
    with sqlite3.connect(DATA / "flex.sqlite3") as db:
        db.executemany("""
        INSERT INTO monster_attack_profiles
        (id,monster_id,attack_name,attack_bonus,damage_count,damage_sides,damage_bonus,
         damage_type,source_ruleset,source_complete)
        VALUES (?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET
          attack_name=excluded.attack_name,attack_bonus=excluded.attack_bonus,
          damage_count=excluded.damage_count,damage_sides=excluded.damage_sides,
          damage_bonus=excluded.damage_bonus,damage_type=excluded.damage_type,
          source_complete=excluded.source_complete
        """, rows)
    print(f"Imported {len(rows)} SRD 2014 attack profiles; "
          f"{sum(row[-1] for row in rows)} basic attacks available for one-click rolling. "
          "Complex source riders require separate implementation.")


if __name__ == "__main__":
    main()
