"""SSE revision notifications; clients resync from the authoritative API."""
import asyncio
import logging

logger = logging.getLogger(__name__)
subscribers: set[asyncio.Queue] = set()


def subscribe() -> asyncio.Queue:
    queue = asyncio.Queue(maxsize=1)
    subscribers.add(queue)
    return queue


def unsubscribe(queue: asyncio.Queue):
    subscribers.discard(queue)


def publish():
    for queue in tuple(subscribers):
        try:
            if queue.full():
                queue.get_nowait()
            queue.put_nowait("refresh")
        except asyncio.QueueFull:
            logger.warning("A display update queue is full")
