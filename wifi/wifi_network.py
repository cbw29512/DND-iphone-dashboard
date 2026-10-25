"""LAN discovery and QR rendering. No external services or outbound traffic."""
from __future__ import annotations

import io
import ipaddress
import logging
import socket

import qrcode
from qrcode.image.svg import SvgPathImage

LOG = logging.getLogger('donovan.wifi.network')
PORT = 8765


def valid_lan_ip(value: str) -> str:
    """Return an IPv4 LAN address or raise ValueError (for a typed override)."""
    try:
        ip = ipaddress.IPv4Address(value.strip())
        if not ip.is_private or ip.is_loopback or ip.is_unspecified or ip.is_multicast:
            raise ValueError('Use a private, non-loopback LAN IPv4 address')
        return str(ip)
    except (ipaddress.AddressValueError, ValueError) as exc:
        LOG.warning('Rejected phone QR address: %r (%s)', value, exc)
        raise ValueError('Enter a local IPv4 address such as 192.168.1.20') from exc


def addresses() -> list[str]:
    """Discover likely local addresses; prefer the OS default interface."""
    found: list[str] = []
    try:
        # UDP connect selects the interface but sends NO packet.
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(('192.0.2.1', 80))
            found.append(valid_lan_ip(s.getsockname()[0]))
    except (OSError, ValueError) as exc:
        LOG.info('Default-interface lookup unavailable: %s', exc)
    try:
        for item in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            try:
                ip = valid_lan_ip(item[4][0])
                if ip not in found:
                    found.append(ip)
            except ValueError:
                continue
    except OSError as exc:
        LOG.warning('Hostname interface lookup unavailable: %s', exc)
    return found


def phone_url(ip: str) -> str:
    return f'http://{valid_lan_ip(ip)}:{PORT}/?view=phone'


def qr_svg(url: str) -> bytes:
    """Make a camera-scannable QR using local Python code only."""
    try:
        code = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, border=4, box_size=10)
        code.add_data(url)
        code.make(fit=True)
        image = code.make_image(image_factory=SvgPathImage)
        buffer = io.BytesIO()
        image.save(buffer)
        return buffer.getvalue()
    except Exception as exc:
        LOG.exception('Unable to encode iPhone QR code')
        raise RuntimeError('QR generation failed') from exc
