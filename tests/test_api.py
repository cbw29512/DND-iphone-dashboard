"""Regression gates for permissions, state, file uploads and combat turns."""
import io
from PIL import Image


def image_bytes():
    output = io.BytesIO()
    Image.new("RGB", (160, 120), "red").save(output, format="PNG")
    return output.getvalue()


def test_dm_authentication_and_write_guard(client, headers):
    assert client.get("/api/dm/state").status_code == 401
    assert client.post("/api/auth/login", json={"passphrase": "wrong"}, headers=headers).status_code == 401
    assert client.post("/api/auth/login", json={"passphrase": "integration-test-secret-123"}).status_code == 403
    response = client.post("/api/auth/login", json={"passphrase": "integration-test-secret-123"}, headers=headers)
    assert response.status_code == 200
    assert response.cookies.get("flex_session")
    assert client.post("/api/share", json={"card": "scene"}).status_code == 403
    assert client.get("/api/dm/state").status_code == 200


def test_upload_and_player_only_sees_shared_asset(dm, headers):
    media = dm.post("/api/media", data={"category": "gallery"},
                    files={"file": ("dragon.png", image_bytes(), "image/png")}, headers=headers)
    assert media.status_code == 200, media.text
    identity = media.json()["id"]
    assert dm.get(f"/api/media/{identity}").headers["content-type"] == "image/webp"
    assert dm.post("/api/share", json={"card": "gallery"}, headers=headers).status_code == 200
    assert dm.get("/api/display/state").json()["content"]["asset"]["id"] == identity
    assert dm.post("/api/media", data={"category": "gallery"},
                   files={"file": ("fake.png", b"not an image", "image/png")}, headers=headers).status_code == 415


def test_pair_is_single_use_and_private_fields_hidden(dm, headers):
    visible = dm.post("/api/combatants", json={"name": "Kael", "initiative": 21,
        "hp_current": 15, "hp_max": 40, "private_note": "Critical secret"}, headers=headers)
    assert visible.status_code == 200
    assert dm.post("/api/combatants", json={"name": "Hidden Lich", "initiative": 22,
        "private_note": "Ambush", "visible": False}, headers=headers).status_code == 200
    assert dm.post("/api/share", json={"card": "initiative"}, headers=headers).status_code == 200
    code = dm.post("/api/pair/create", headers=headers).json()["code"]
    assert len(code) == 6
    from fastapi.testclient import TestClient
    from server.app import app
    with TestClient(app) as phone:
        assert phone.get("/api/display/state").status_code == 401
        assert phone.post("/api/pair/redeem", json={"code": code}, headers=headers).status_code == 200
        assert phone.post("/api/pair/redeem", json={"code": code}, headers=headers).status_code == 401
        public = phone.get("/api/display/state").json()
        assert public["card"] == "initiative"
        assert [x["name"] for x in public["content"]["combatants"]] == ["Kael"]
        assert "private_note" not in str(public)
        assert "hp_current" not in str(public)
        assert phone.get("/api/dm/state").status_code == 401
        assert phone.post("/api/share", json={"card": None}, headers=headers).status_code == 401
        assert phone.get("/api/media/not-there").status_code == 404
        assert dm.post("/api/pair/revoke", headers=headers).status_code == 200
        assert phone.get("/api/display/state").status_code == 401


def test_initiative_order_and_round_progression(dm, headers):
    for name, initiative in [("Goblin", 8), ("Fighter", 17), ("Rogue", 14)]:
        dm.post("/api/combatants", json={"name": name, "initiative": initiative}, headers=headers)
    names = [x["name"] for x in dm.get("/api/dm/state").json()["combatants"]]
    assert names == ["Fighter", "Rogue", "Goblin"]
    rounds = []
    for _ in range(4):
        dm.post("/api/combat/next", headers=headers)
        rounds.append(dm.get("/api/dm/state").json()["settings"]["round_number"])
    assert rounds == [1, 1, 1, 2]
    dm.post("/api/combat/reset", headers=headers)
    assert dm.get("/api/dm/state").json()["settings"]["round_number"] == 1


def test_scene_dice_and_clear(dm, headers):
    dm.put("/api/scene", json={"text": "The innkeeper offers a map"}, headers=headers)
    dm.post("/api/share", json={"card": "scene"}, headers=headers)
    assert dm.get("/api/display/state").json()["content"]["text"] == "The innkeeper offers a map"
    roll = dm.post("/api/dice/roll", json={"sides": 20, "count": 2, "modifier": 3}, headers=headers)
    assert roll.status_code == 200
    assert 5 <= roll.json()["total"] <= 43
    dm.post("/api/share", json={"card": None}, headers=headers)
    assert dm.get("/api/display/state").json()["card"] is None
    assert dm.post("/api/share", json={"card": "unknown"}, headers=headers).status_code == 422
