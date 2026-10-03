from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


# ---------- Shapes Gemini must return (used as response_schema) ----------

class Exercise(BaseModel):
    name: str
    sets: str
    reps: str
    rest_seconds: int
    notes: str = ""


class PlanDay(BaseModel):
    day: str
    focus: str
    warmup: str
    exercises: list[Exercise]
    cooldown: str
    estimated_minutes: int


class GeneratedPlan(BaseModel):
    title: str
    summary: str
    days: list[PlanDay]
    progression: str
    tips: list[str]
    safety_notes: str


# ---------- API shapes ----------

class WorkoutPlanResponse(BaseModel):

    model_config = ConfigDict(from_attributes=True)

    id: int
    plan: GeneratedPlan
    model: str
    created_at: datetime


class ChatRequest(BaseModel):

    message: str = Field(
        min_length=1,
        max_length=1000
    )


class ChatMessageResponse(BaseModel):

    model_config = ConfigDict(from_attributes=True)

    id: int
    role: str
    content: str
    created_at: datetime


class ChatReply(BaseModel):

    reply: ChatMessageResponse
    remaining_today: int


class UsageResponse(BaseModel):

    used_today: int
    daily_limit: int
    remaining_today: int
