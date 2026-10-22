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
 active_turn TEXT
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
 token_asset_id TEXT
);
CREATE TABLE IF NOT EXISTS encounters (id TEXT PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS encounter_members (
 id TEXT PRIMARY KEY, encounter_id TEXT NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
 name TEXT NOT NULL, modifier INTEGER NOT NULL DEFAULT 0, visible INTEGER NOT NULL DEFAULT 1,
 token_asset_id TEXT, position INTEGER NOT NULL DEFAULT 0
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
        db.execute("PRAGMA journal_mode=WAL")


def revision(db):
    db.execute("UPDATE settings SET revision=revision+1 WHERE id=1")


def rows(query, params=()):
    with connect() as db:
        return [dict(r) for r in db.execute(query, params).fetchall()]
