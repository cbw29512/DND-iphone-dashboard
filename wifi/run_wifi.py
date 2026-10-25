"""Start Donovan Wi-Fi server and open the laptop controller."""
import logging
import socket
import threading
import time
import webbrowser

import uvicorn

from wifi_network import PORT, addresses, phone_url
from wifi_server import app

LOG = logging.getLogger('donovan.wifi.start')
logging.basicConfig(level=logging.INFO, format='%(levelname)s %(message)s')


def launch_browser() -> None:
    try:
        for _ in range(50):
            try:
                with socket.create_connection(('127.0.0.1', PORT), timeout=.25):
                    webbrowser.open(f'http://localhost:{PORT}/')
                    return
            except OSError:
                time.sleep(.2)
        LOG.warning('Open http://localhost:%d/ manually', PORT)
    except Exception as exc:
        LOG.exception('Could not open the laptop browser: %s', exc)


if __name__ == '__main__':
    try:
        LOG.info('Laptop controls: http://localhost:%d/', PORT)
        for address in addresses():
            LOG.info('iPhone URL: %s', phone_url(address))
        LOG.info('Keep this window running and scan the QR with iPhone Camera')
        threading.Thread(target=launch_browser, daemon=True).start()
        uvicorn.run(app, host='0.0.0.0', port=PORT, log_level='warning')
    except Exception:
        LOG.exception('Donovan Wi-Fi server could not start')
        raise
