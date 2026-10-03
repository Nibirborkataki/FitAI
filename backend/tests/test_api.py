from app.core.config import settings
from app.schemas.ai import Exercise, GeneratedPlan, PlanDay
from app.services import gemini_service
from tests.conftest import PROFILE


def fake_plan(profile, report):
    days = [
        PlanDay(
            day=d["day"], focus=d["focus"], warmup="5 min bike",
            exercises=[Exercise(name="Squat", sets="3", reps="10", rest_seconds=60)],
            cooldown="Stretch", estimated_minutes=50,
        )
        for d in reversed(report["training"]["schedule"])  # wrong order on purpose
    ]
    plan = GeneratedPlan(
        title="Test plan", summary="Summary", days=days,
        progression="Add weight", tips=["Sleep"], safety_notes="Be safe",
    )
    return gemini_service._align_with_schedule(plan, report), "fake-model"


def test_register_login_and_me(client):
    no_name = client.post("/api/auth/register",
                          json={"email": "x@b.com", "password": "password123"})
    assert no_name.status_code == 422

    r = client.post("/api/auth/register",
                    json={"full_name": "  Asha   Rao ", "email": "A@B.com",
                          "password": "password123"})
    assert r.status_code == 201

    dup = client.post("/api/auth/register",
                      json={"full_name": "Asha", "email": "a@b.com",
                            "password": "password123"})
    assert dup.status_code == 409

    login = client.post("/api/auth/login",
                        json={"email": "a@b.com", "password": "password123"})
    assert login.status_code == 200
    token = login.json()["access_token"]

    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.json() == {
        "id": 1, "email": "a@b.com", "full_name": "Asha Rao",
        "first_name": "Asha", "has_profile": False
    }

    bad = client.post("/api/auth/login",
                      json={"email": "a@b.com", "password": "wrong"})
    assert bad.status_code == 401


def test_protected_routes_need_token(client):
    assert client.get("/api/metrics").status_code in (401, 403)


def test_profile_upsert_and_metrics(client, auth_headers):
    assert client.get("/api/metrics", headers=auth_headers).status_code == 404

    r = client.put("/api/profile", json=PROFILE, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["workout_preference"] == "strength"

    r = client.put("/api/profile", json={**PROFILE, "weight_kg": 84},
                   headers=auth_headers)
    assert r.json()["weight_kg"] == 84

    metrics = client.get("/api/metrics", headers=auth_headers).json()
    assert metrics["bmi"] == 25.93
    assert len(metrics["training"]["schedule"]) == 4
    assert metrics["weeks_to_target"] == 12
    assert metrics["recovery"]["status"] == "low"
    assert metrics["nutrition"]["protein_per_meal_g"] > 0
    assert "Paneer" in metrics["nutrition"]["protein_sources"]
    levels = {f["level"] for f in metrics["health_flags"]}
    assert "caution" in levels  # high blood pressure


def test_profile_rejects_invalid_choice(client, auth_headers):
    r = client.put("/api/profile", json={**PROFILE, "goal": "get_huge"},
                   headers=auth_headers)
    assert r.status_code == 422


def test_plan_generation_is_saved_and_ordered(client, auth_headers, monkeypatch):
    monkeypatch.setattr(gemini_service, "generate_workout_plan", fake_plan)
    client.put("/api/profile", json=PROFILE, headers=auth_headers)

    empty = client.get("/api/plan", headers=auth_headers)
    assert empty.status_code == 200 and empty.json() is None

    r = client.post("/api/plan/generate", headers=auth_headers)
    assert r.status_code == 201
    days = [d["day"] for d in r.json()["plan"]["days"]]
    assert days == ["Monday", "Tuesday", "Thursday", "Friday"]

    saved = client.get("/api/plan", headers=auth_headers).json()
    assert saved["id"] == r.json()["id"]


def test_chat_saves_history_and_counts_quota(client, auth_headers, monkeypatch):
    monkeypatch.setattr(
        gemini_service, "coach_reply",
        lambda *args: ("Drink water.", "fake-model")
    )
    client.put("/api/profile", json=PROFILE, headers=auth_headers)

    r = client.post("/api/coach/chat", json={"message": "Tips?"},
                    headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["reply"]["content"] == "Drink water."
    assert r.json()["remaining_today"] == settings.AI_DAILY_LIMIT - 1

    history = client.get("/api/coach/history", headers=auth_headers).json()
    assert [m["role"] for m in history] == ["user", "assistant"]

    client.delete("/api/coach/history", headers=auth_headers)
    assert client.get("/api/coach/history", headers=auth_headers).json() == []


def test_daily_limit_blocks_ai_calls(client, auth_headers, monkeypatch):
    monkeypatch.setattr(settings, "AI_DAILY_LIMIT", 1)
    monkeypatch.setattr(
        gemini_service, "coach_reply", lambda *args: ("ok", "fake-model")
    )
    client.put("/api/profile", json=PROFILE, headers=auth_headers)

    first = client.post("/api/coach/chat", json={"message": "hi"},
                        headers=auth_headers)
    second = client.post("/api/coach/chat", json={"message": "hi again"},
                         headers=auth_headers)
    assert first.status_code == 200
    assert second.status_code == 429


def test_ai_outage_returns_503(client, auth_headers, monkeypatch):
    def boom(*args):
        raise gemini_service.AIServiceError("busy")

    monkeypatch.setattr(gemini_service, "coach_reply", boom)
    client.put("/api/profile", json=PROFILE, headers=auth_headers)

    r = client.post("/api/coach/chat", json={"message": "hi"},
                    headers=auth_headers)
    assert r.status_code == 503
    # failed call is not stored and does not use quota
    assert client.get("/api/coach/history", headers=auth_headers).json() == []
