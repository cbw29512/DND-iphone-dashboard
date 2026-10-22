"""Separate DM and display permissions, with short-lived pairing codes."""
import hashlib
import logging
import secrets
import time
from fastapi import HTTPException, Request, WebSocket
from .database import connect

logger = logging.getLogger(__name__)
COOKIE = "flex_session"
TTL_DM = 7 * 86400
TTL_PLAYER = 30 * 86400


def digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def grant(role: str) -> str:
    token = secrets.token_urlsafe(32)
    with connect() as db:
        db.execute("DELETE FROM access WHERE expires < ?", (int(time.time()),))
        db.execute("INSERT INTO access VALUES (?,?,?)", (
            digest(token), role, int(time.time()) + (TTL_DM if role == "dm" else TTL_PLAYER)))
    return token


def role_from_token(token: str | None) -> str | None:
    if not token:
        return None
    with connect() as db:
        row = db.execute("SELECT role FROM access WHERE token_hash=? AND expires>?",
                         (digest(token), int(time.time()))).fetchone()
    return row["role"] if row else None


def require(request: Request, dm_only=False):
    role = role_from_token(request.cookies.get(COOKIE))
    if role != "dm" and (dm_only or role != "player"):
        raise HTTPException(401, "Sign in or pair the display")
    return role


def require_write(request: Request):
    require(request, dm_only=True)
    if request.headers.get("X-Flex-Request") != "1":
        raise HTTPException(403, "Missing request verification header")


def allow_mutation(request: Request):
    if request.headers.get("X-Flex-Request") != "1":
        raise HTTPException(403, "Missing request verification header")


def create_code() -> str:
    code = f"{secrets.randbelow(1_000_000):06d}"
    with connect() as db:
        db.execute("DELETE FROM pairing")
        db.execute("INSERT INTO pairing VALUES (?,?)", (digest(code), int(time.time()) + 600))
    return code


def redeem(code: str) -> bool:
    if len(code) != 6 or not code.isdecimal():
        return False
    with connect() as db:
        row = db.execute("DELETE FROM pairing WHERE code_hash=? AND expires>=? RETURNING code_hash",
                         (digest(code), int(time.time()))).fetchone()
        if not row:
            return False
        db.execute("DELETE FROM pairing")
    return True


def invalidate(request: Request):
    token = request.cookies.get(COOKIE)
    if token:
        with connect() as db:
            db.execute("DELETE FROM access WHERE token_hash=?", (digest(token),))


def clear_players():
    with connect() as db:
        db.execute("DELETE FROM access WHERE role='player'")
        db.execute("DELETE FROM pairing")


def set_cookie(response, token: str, secure: bool):
    response.set_cookie(COOKIE, token, httponly=True, secure=secure,
                        samesite="strict", max_age=TTL_DM if role_from_token(token) == "dm" else TTL_PLAYER,
                        path="/")
