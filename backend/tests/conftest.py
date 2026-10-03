import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.core.database import Base, get_db
from app.main import app


@pytest.fixture()
def client():
    """App wired to a throwaway in-memory SQLite DB."""

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(bind=engine, autoflush=False)

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


@pytest.fixture()
def auth_headers(client):
    response = client.post(
        "/api/auth/register",
        json={"full_name": "Test User", "email": "Test@Example.com",
              "password": "supersecret"}
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


PROFILE = {
    "age": 30,
    "gender": "male",
    "height_cm": 180,
    "weight_kg": 85,
    "target_weight_kg": 78,
    "goal": "fat_loss",
    "activity_level": "moderate",
    "experience_level": "intermediate",
    "workout_days": 4,
    "workout_duration": 60,
    "workout_preference": "strength",
    "equipment": "full_gym",
    "injuries": "Mild left knee pain",
    "sleep_hours": 6.5,
    "dietary_preference": "vegetarian",
    "medical_conditions": "High blood pressure"
}
