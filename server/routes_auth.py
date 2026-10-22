"""DM login, one-time iPhone pairing, and revocation."""
import hmac
import logging
import time
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from .config import bootstrap
from .schema import Login, Pair
from .realtime import publish
from .security import (COOKIE, allow_mutation, clear_players, create_code, grant,
                       invalidate, redeem, require, require_write, set_cookie)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api")
failures: dict[str, list[int]] = {}


def protect_login(request: Request):
    ip = request.client.host if request.client else "unknown"
    now = int(time.time())
    attempts = [t for t in failures.get(ip, []) if now - t < 60]
    if len(attempts) >= 8:
        raise HTTPException(429, "Too many login attempts; retry in one minute")
    failures[ip] = attempts
    return ip


@router.post("/auth/login")
def login(request: Request, body: Login):
    allow_mutation(request)
    ip = protect_login(request)
    if not hmac.compare_digest(body.passphrase, bootstrap()):
        failures[ip].append(int(time.time()))
        raise HTTPException(401, "Incorrect passphrase")
    failures.pop(ip, None)
    response = JSONResponse({"ok": True, "role": "dm"})
    set_cookie(response, grant("dm"), request.url.scheme == "https")
    logger.info("DM authenticated")
    return response


@router.get("/auth/me")
def me(request: Request):
    return {"role": require(request)}


@router.post("/auth/logout")
def logout(request: Request):
    allow_mutation(request)
    invalidate(request)
    response = JSONResponse({"ok": True})
    response.delete_cookie(COOKIE)
    return response


@router.post("/pair/create")
def pair_create(request: Request):
    require_write(request)
    code = create_code()
    return {"code": code, "expires_in": 600}


@router.post("/pair/redeem")
def pair_redeem(request: Request, body: Pair):
    allow_mutation(request)
    ip = protect_login(request)
    if not redeem(body.code):
        failures[ip].append(int(time.time()))
        raise HTTPException(401, "Incorrect or expired pairing code")
    failures.pop(ip, None)
    response = JSONResponse({"ok": True, "role": "player"})
    set_cookie(response, grant("player"), request.url.scheme == "https")
    return response


@router.post("/pair/revoke")
def pair_revoke(request: Request):
    require_write(request)
    clear_players()
    publish()
    return {"ok": True}
