from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


Gender = Literal["male", "female", "other"]

Goal = Literal[
    "fat_loss", "muscle_gain", "maintenance", "endurance", "general_fitness"
]

ActivityLevel = Literal[
    "sedentary", "light", "moderate", "active", "very_active"
]

ExperienceLevel = Literal["beginner", "intermediate", "advanced"]

WorkoutPreference = Literal[
    "strength", "cardio", "hiit", "yoga_mobility", "mixed"
]

Equipment = Literal[
    "none", "bands", "dumbbells", "home_gym", "full_gym"
]

DietaryPreference = Literal[
    "no_preference", "vegetarian", "eggetarian", "non_vegetarian",
    "vegan", "pescatarian"
]


class ProfileCreate(BaseModel):

    age: int = Field(
        ge=13,
        le=100
    )

    gender: Gender

    height_cm: float = Field(
        gt=100,
        lt=250
    )

    weight_kg: float = Field(
        gt=20,
        lt=300
    )

    target_weight_kg: float | None = Field(
        default=None,
        gt=20,
        lt=300
    )

    goal: Goal

    activity_level: ActivityLevel

    # a.k.a. "fitness level"
    experience_level: ExperienceLevel

    workout_days: int = Field(
        ge=1,
        le=7
    )

    workout_duration: int = Field(
        ge=15,
        le=180
    )

    workout_preference: WorkoutPreference = "mixed"

    equipment: Equipment

    sleep_hours: float | None = Field(
        default=None,
        ge=0,
        le=24
    )

    dietary_preference: DietaryPreference | None = None

    medical_conditions: str | None = Field(
        default=None,
        max_length=500
    )

    injuries: str | None = Field(
        default=None,
        max_length=500
    )


class ProfileResponse(ProfileCreate):

    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
