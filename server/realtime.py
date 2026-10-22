"""Thread-safe revision notifier: endpoints may run in FastAPI worker threads."""
import asyncio
import logging
from threading import RLock

logger = logging.getLogger(__name__)
_lock = RLock()
_subscribers: dict[asyncio.Queue, asyncio.AbstractEventLoop] = {}


def subscribe() -> asyncio.Queue:
    queue = asyncio.Queue(maxsize=1)
    with _lock:
        _subscribers[queue] = asyncio.get_running_loop()
    return queue


def unsubscribe(queue: asyncio.Queue):
    with _lock:
        _subscribers.pop(queue, None)


def _signal(queue: asyncio.Queue):
    try:
        if queue.full():
            queue.get_nowait()
        queue.put_nowait("refresh")
    except asyncio.QueueFull:
        logger.warning("Display event queue unexpectedly full")


def publish():
    with _lock:
        active = tuple(_subscribers.items())
    for queue, loop in active:
        try:
            loop.call_soon_threadsafe(_signal, queue)
        except RuntimeError:
            unsubscribe(queue)
            logger.warning("Removed a disconnected live-display subscriber")
