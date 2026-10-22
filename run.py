"""Local development entrypoint: python run.py"""
import logging
import uvicorn

if __name__ == "__main__":
    try:
        uvicorn.run("server.app:app", host="0.0.0.0", port=8000, reload=False)
    except Exception:
        logging.exception("Unable to start the D&D Flex Dashboard")
        raise
