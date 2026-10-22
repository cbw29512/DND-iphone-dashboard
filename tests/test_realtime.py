"""Realtime update notifications must safely cross FastAPI worker threads."""
import asyncio
from threading import Thread
from server.realtime import publish, subscribe, unsubscribe


def test_worker_thread_dispatch():
    async def check():
        queue = subscribe()
        try:
            sender = Thread(target=publish)
            sender.start()
            await asyncio.wait_for(queue.get(), timeout=1)
            sender.join(timeout=1)
            assert not sender.is_alive()
        finally:
            unsubscribe(queue)
    asyncio.run(check())
