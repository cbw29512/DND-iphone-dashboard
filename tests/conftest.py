"""Isolated test storage and credentials for every API integration test."""
import pytest
from fastapi.testclient import TestClient
from server import config, database, routes_media
from server.app import app


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "DATA", tmp_path)
    monkeypatch.setattr(database, "DATA", tmp_path)
    monkeypatch.setattr(routes_media, "DATA", tmp_path)
    monkeypatch.setenv("FLEX_DM_PASSPHRASE", "integration-test-secret-123")
    try:
        with TestClient(app) as web:
            yield web
    except Exception:
        raise


@pytest.fixture
def dm(client):
    response = client.post("/api/auth/login", json={"passphrase": "integration-test-secret-123"}, headers={"X-Flex-Request": "1"})
    assert response.status_code == 200
    return client


@pytest.fixture
def headers():
    return {"X-Flex-Request": "1"}
