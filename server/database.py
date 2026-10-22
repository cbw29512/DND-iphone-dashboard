"""SQLite schema and connection helpers; one-process local server contract."""
import logging
import sqlite3
from contextlib import contextmanager
from .config import DATA

logger = logging.getLogger(__name__)
SCHEMA = """
CREATE TABLE IF NOT EXISTS settings (
 id INTEGER PRIMARY KEY CHECK(id = 1), active_card TEXT, active_asset TEXT,
 revision INTEGER NOT NULL DEFAULT 0, scene_text TEXT NOT NULL DEFAULT '',
 dice_text TEXT NOT NULL DEFAULT '', round_number INTEGER NOT NULL DEFAULT 1,
 active_turn TEXT,
 attack_natural INTEGER, attack_bonus INTEGER, attack_total INTEGER, attack_actor TEXT,
 attack_damage INTEGER, attack_damage_type TEXT, attack_damage_formula TEXT, attack_name TEXT,
 attack_condition TEXT, attack_save_ability TEXT, attack_save_dc INTEGER,
 attack_target TEXT, attack_target_ac INTEGER, attack_hit INTEGER
);
INSERT OR IGNORE INTO settings (id) VALUES (1);
CREATE TABLE IF NOT EXISTS media (
 id TEXT PRIMARY KEY, category TEXT NOT NULL, name TEXT NOT NULL,
 stored_name TEXT NOT NULL UNIQUE, content_type TEXT NOT NULL,
 position INTEGER NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS combatants (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, initiative INTEGER NOT NULL,
 position INTEGER NOT NULL, hp_current INTEGER, hp_max INTEGER,
 private_note TEXT NOT NULL DEFAULT '', visible INTEGER NOT NULL DEFAULT 1,
 token_asset_id TEXT,
 attack_bonus INTEGER NOT NULL DEFAULT 0,
 armor_class INTEGER,
 initiative_group TEXT,
 source_monster_id TEXT
);
CREATE TABLE IF NOT EXISTS encounters (id TEXT PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS encounter_members (
 id TEXT PRIMARY KEY, encounter_id TEXT NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
 name TEXT NOT NULL, modifier INTEGER NOT NULL DEFAULT 0, visible INTEGER NOT NULL DEFAULT 1,
 token_asset_id TEXT, attack_bonus INTEGER NOT NULL DEFAULT 0, armor_class INTEGER, initiative_group TEXT, source_monster_id TEXT, position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS monster_attack_profiles (
 id TEXT PRIMARY KEY, monster_id TEXT NOT NULL, attack_name TEXT NOT NULL,
 attack_bonus INTEGER NOT NULL, damage_count INTEGER NOT NULL,
 damage_sides INTEGER NOT NULL, damage_bonus INTEGER NOT NULL,
 damage_type TEXT NOT NULL, source_ruleset TEXT NOT NULL,
 source_complete INTEGER NOT NULL DEFAULT 1,
 effect_condition TEXT, effect_save_ability TEXT, effect_save_dc INTEGER
);
CREATE TABLE IF NOT EXISTS access (
 token_hash TEXT PRIMARY KEY, role TEXT NOT NULL, expires INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS pairing (
 code_hash TEXT PRIMARY KEY, expires INTEGER NOT NULL
);
"""


@contextmanager
def connect():
    db = sqlite3.connect(DATA / "flex.sqlite3", timeout=5)
    db.row_factory = sqlite3.Row
    try:
        db.execute("PRAGMA foreign_keys=ON")
        yield db
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Database operation failed")
        raise
    finally:
        db.close()


def initialize():
    DATA.mkdir(parents=True, exist_ok=True)
    with connect() as db:
        db.executescript(SCHEMA)
        if 'token_asset_id' not in {row[1] for row in db.execute('PRAGMA table_info(combatants)')}:
            db.execute('ALTER TABLE combatants ADD COLUMN token_asset_id TEXT')
        for table, column, ddl in [
            ("combatants", "attack_bonus", "INTEGER NOT NULL DEFAULT 0"),
            ("encounter_members", "attack_bonus", "INTEGER NOT NULL DEFAULT 0"),
            ("settings", "attack_natural", "INTEGER"),
            ("settings", "attack_bonus", "INTEGER"),
            ("settings", "attack_total", "INTEGER"),
            ("settings", "attack_actor", "TEXT"),
            ("settings", "attack_damage", "INTEGER"),
            ("settings", "attack_damage_type", "TEXT"),
            ("settings", "attack_damage_formula", "TEXT"),
            ("settings", "attack_name", "TEXT"),
            ("settings", "attack_condition", "TEXT"),
            ("settings", "attack_save_ability", "TEXT"),
            ("settings", "attack_save_dc", "INTEGER"),
            ("settings", "attack_target", "TEXT"),
            ("settings", "attack_target_ac", "INTEGER"),
            ("settings", "attack_hit", "INTEGER"),
            ("combatants", "armor_class", "INTEGER"),
            ("combatants", "initiative_group", "TEXT"),
            ("encounter_members", "initiative_group", "TEXT"),
            ("encounter_members", "source_monster_id", "TEXT"),
            ("combatants", "source_monster_id", "TEXT"),
            ("encounter_members", "armor_class", "INTEGER"),
            ("monster_attack_profiles", "effect_condition", "TEXT"),
            ("monster_attack_profiles", "effect_save_ability", "TEXT"),
            ("monster_attack_profiles", "effect_save_dc", "INTEGER"),
        ]:
            if column not in {row[1] for row in db.execute(f"PRAGMA table_info({table})")}:
                db.execute(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}")
        db.execute("PRAGMA journal_mode=WAL")


def revision(db):
    db.execute("UPDATE settings SET revision=revision+1 WHERE id=1")


def rows(query, params=()):
    with connect() as db:
        return [dict(r) for r in db.execute(query, params).fetchall()]
