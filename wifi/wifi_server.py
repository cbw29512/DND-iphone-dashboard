"""Local Wi-Fi relay: laptop sends rolls; iPhone only reads displayed results.

Schema: Snapshot/result are presentation data, not monster HP or enemy stats.
State: latest Snapshot lives in RAM; phone polls once every 800ms.
"""
from __future__ import annotations

import logging
import time
from pathlib import Path
from threading import Lock
from typing import Any

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import HTMLResponse, JSONResponse, Response
from pydantic import BaseModel, Field

from wifi_network import addresses, phone_url, qr_svg, valid_lan_ip
from wifi_pairing import with_pairing_panel

ROOT = Path(__file__).resolve().parent
CARD_HTML = (ROOT / 'index.html') if (ROOT / 'index.html').exists() else (ROOT.parent / 'index.html')
logging.basicConfig(level=logging.INFO, format='%(levelname)s %(message)s')
LOG = logging.getLogger('donovan.wifi')


class RollResult(BaseModel):
    title: str = Field(max_length=120)
    kind: str = Field(max_length=24)
    amount: str = Field(max_length=100)
    roll: str = Field(max_length=300)
    details: str = Field(max_length=3500)
    economy: str = Field(max_length=60)


class Snapshot(BaseModel):
    result: RollResult
    hp: int = Field(ge=0, le=51)
    turn: int = Field(ge=0, le=100000)
    portrait: str = Field(default='', max_length=2_500_000)
    slots: dict[str, int] | dict[int, int]
    channels: int = Field(ge=0, le=3)
    action: bool
    bonus: bool
    reaction: bool


app = FastAPI(title='Donovan Wi-Fi Screen', docs_url=None, redoc_url=None)
lock = Lock()
latest: dict[str, Any] = {}
last_phone_seen: float = 0.0


def choose_address(override: str | None) -> str:
    options = addresses()
    if override:
        return valid_lan_ip(override)
    if not options:
        raise HTTPException(503, 'Could not identify LAN address; enter your laptop IPv4 address')
    return options[0]


def local_controller(request: Request) -> bool:
    return bool(request.client and request.client.host in ('127.0.0.1', '::1'))


@app.get('/', response_class=HTMLResponse)
def card(request: Request, view: str = '') -> HTMLResponse:
    try:
        if not local_controller(request) and view != 'phone':
            return HTMLResponse(status_code=307, headers={'Location':'/?view=phone'})
        html = CARD_HTML.read_text(encoding='utf-8')
        html = html.replace("fetch('/api/snapshot',{cache:'no-store'})", "fetch('/api/snapshot?view=phone',{cache:'no-store'})")
        if view != 'phone':
            html = with_pairing_panel(html)
        return HTMLResponse(html, headers={'Cache-Control':'no-store'})
    except Exception as exc:
        LOG.exception('Failed to serve Donovan screen')
        raise HTTPException(500, 'Could not serve character card') from exc


@app.get('/api/connect-info')
def connect_info(address: str | None = None) -> JSONResponse:
    try:
        ip = choose_address(address)
        with lock:
            connected = last_phone_seen > 0 and time.monotonic() - last_phone_seen < 6
        return JSONResponse({'address':ip,'phone_url':phone_url(ip),'addresses':addresses(),'phone_connected':connected},headers={'Cache-Control':'no-store'})
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        LOG.exception('Failed to determine phone URL')
        raise HTTPException(500, 'Unable to resolve Wi-Fi address') from exc


@app.get('/api/qr.svg')
def get_qr(address: str | None = None) -> Response:
    try:
        data = qr_svg(phone_url(choose_address(address)))
        return Response(data, media_type='image/svg+xml',headers={'Cache-Control':'no-store'})
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        LOG.exception('Could not generate connection QR')
        raise HTTPException(500, 'QR unavailable') from exc


@app.get('/api/snapshot')
def read_snapshot(view: str = '') -> dict[str, Any]:
    global last_phone_seen
    try:
        with lock:
            if view == 'phone':
                last_phone_seen = time.monotonic()
            return {'snapshot': latest.copy() if latest else None}
    except Exception as exc:
        LOG.exception('Unable to read latest action')
        raise HTTPException(500, 'Display read failed') from exc


@app.post('/api/snapshot')
def update_snapshot(data: Snapshot, request: Request) -> dict[str, str]:
    if not local_controller(request):
        LOG.warning('Rejected snapshot write from non-laptop address')
        raise HTTPException(403, 'Only laptop localhost may send combat actions')
    try:
        with lock:
            latest.clear()
            latest.update(data.model_dump())
        return {'status': 'ok'}
    except Exception as exc:
        LOG.exception('Unable to publish latest action')
        raise HTTPException(500, 'Display update failed') from exc


