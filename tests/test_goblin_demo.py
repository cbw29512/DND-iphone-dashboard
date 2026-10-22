"""Goblin test encounter: shared initiative and independent shaman turn."""
def test_sample_goblins_share_initiative_and_shaman_independent(dm, headers):
    sample = dm.post("/api/encounters/sample-goblin-fight", headers=headers)
    assert sample.status_code == 200, sample.text
    encounter = sample.json()["id"]
    assert dm.post("/api/encounters/sample-goblin-fight", headers=headers).json()["id"] == encounter
    start = dm.post(f"/api/encounters/{encounter}/start", headers=headers)
    assert start.status_code == 200, start.text
    rolls = start.json()["rolls"]
    assert len(rolls) == 5
    goblins = [r for r in rolls if r["name"] in ("Goblin 1", "Goblin 2")]
    assert len(goblins) == 2
    assert goblins[0]["roll"] == goblins[1]["roll"]
    assert goblins[0]["total"] == goblins[1]["total"]
    assert any(r["name"].startswith("Goblin Shaman") and r["group"] is None for r in rolls)
    state = dm.get("/api/dm/state").json()
    assert len(state["combatants"]) == 5
    assert sorted(c["source_monster_id"] for c in state["combatants"] if c["initiative_group"] == "goblins") == ["goblin", "goblin"]
    assert len([p for p in state["attack_profiles"] if p["monster_id"] == "goblin" and p["source_complete"]]) == 2
    first_round = state["settings"]["round_number"]
    for _ in range(5):
        advance = dm.post("/api/combat/next", headers=headers)
        assert advance.status_code == 200, advance.text
    assert dm.get("/api/dm/state").json()["settings"]["round_number"] == first_round + 1


def test_edit_prepared_and_live_player_cards(dm, headers):
    sample = dm.post("/api/encounters/sample-goblin-fight", headers=headers).json()
    encounter = sample["id"]
    members = dm.get("/api/dm/state").json()["encounter_members"]
    fighter = next(m for m in members if m["encounter_id"] == encounter and m["name"] == "Hero · Fighter")
    response = dm.put(f"/api/encounters/{encounter}/members/{fighter['id']}",
        json={"name": "Jeff", "modifier": 3, "armor_class": 19}, headers=headers)
    assert response.status_code == 200, response.text
    assert dm.post(f"/api/encounters/{encounter}/start", headers=headers).status_code == 200
    combatants = dm.get("/api/dm/state").json()["combatants"]
    jeff = next(c for c in combatants if c["name"] == "Jeff")
    assert jeff["armor_class"] == 19
    response = dm.put(f"/api/combatants/{jeff['id']}",
        json={"name": "Jeff", "initiative": jeff["initiative"], "armor_class": 20}, headers=headers)
    assert response.status_code == 200
    assert next(c for c in dm.get("/api/dm/state").json()["combatants"] if c["id"] == jeff["id"])["armor_class"] == 20
