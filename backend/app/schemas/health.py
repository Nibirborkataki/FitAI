from pydantic import BaseModel, Field

from app.schemas.profile import (
    ActivityLevel,
    ExperienceLevel,
    Gender,
    Goal,
    WorkoutPreference
)


class HealthCalculationRequest(BaseModel):

    age: int = Field(ge=13, le=100)
    gender: Gender
    height_cm: float = Field(gt=100, lt=250)
    weight_kg: float = Field(gt=20, lt=300)
    activity_level: ActivityLevel
    goal: Goal


class HealthCalculationResponse(BaseModel):

    bmi: float
    bmi_category: str
    bmr: float
    tdee: float
    calorie_target: float


class WeightRange(BaseModel):
    min_kg: float
    max_kg: float


class Macros(BaseModel):
    protein_g: int
    carbs_g: int
    fat_g: int


class Water(BaseModel):
    rest_day: float
    training_day: float


class HeartRateZone(BaseModel):
    name: str
    min_bpm: int
    max_bpm: int
    purpose: str


class HeartRate(BaseModel):
    max_hr: int
    zones: list[HeartRateZone]


class ScheduleDay(BaseModel):
    day: str
    focus: str


class TrainingTemplate(BaseModel):
    split_name: str
    schedule: list[ScheduleDay]
    rest_days: list[str]
    sets: str
    reps: str
    rest_seconds: int
    cardio_minutes_per_week: int
    intensity_note: str
    session_minutes: int
    weekly_minutes: int


class Recovery(BaseModel):
    sleep_hours: float
    target_min: float
    target_max: float
    status: str
    note: str


class NutritionGuide(BaseModel):
    diet: str
    meals_per_day: int
    protein_per_meal_g: int
    protein_sources: list[str]


class HealthFlag(BaseModel):
    level: str
    message: str


class HealthReport(BaseModel):
    """Full Python-computed report shown on the dashboard."""

    bmi: float
    bmi_category: str
    healthy_weight_range: WeightRange
    bmr: float
    tdee: float
    calorie_target: float
    calorie_adjustment: int
    macros: Macros
    nutrition: NutritionGuide
    recovery: Recovery | None
    health_flags: list[HealthFlag]
    water_liters: Water
    heart_rate: HeartRate
    weeks_to_target: int | None
    training: TrainingTemplate
