"""Validated runtime configuration; user data never enters the source tree."""
import json
import logging
import os
import secrets
from pathlib import Path

logger = logging.getLogger(__name__)
ROOT = Path(__file__).resolve().parent.parent
DATA = Path(os.environ.get("FLEX_DATA_DIR", ROOT / "data")).resolve()


def bootstrap() -> str:
    """Return a DM passphrase, generating a persistent local one when absent."""
    DATA.mkdir(parents=True, exist_ok=True)
    secret = os.environ.get("FLEX_DM_PASSPHRASE")
    if secret:
        if len(secret) < 12:
            raise ValueError("FLEX_DM_PASSPHRASE must be at least 12 characters")
        return secret
    file = DATA / "admin.json"
    try:
        if file.exists():
            secret = json.loads(file.read_text())["passphrase"]
        else:
            secret = secrets.token_urlsafe(18)
            file.write_text(json.dumps({"passphrase": secret}))
            try:
                file.chmod(0o600)
            except OSError:
                logger.warning("Cannot restrict local credential file permissions")
        return secret
    except (OSError, ValueError, KeyError) as exc:
        logger.exception("Cannot initialize administrator credentials")
        raise RuntimeError("Unable to initialize administrator credentials") from exc
