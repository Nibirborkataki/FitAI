from datetime import datetime, time, timezone

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.chat_message import ChatMessage
from app.models.workout_plan import WorkoutPlan


def _start_of_today_utc() -> datetime:
    today = datetime.now(timezone.utc).date()
    return datetime.combine(today, time.min)


def used_today(db: Session, user_id: int) -> int:
    """Gemini calls today = chat questions + plan generations."""

    since = _start_of_today_utc()

    chats = db.scalar(
        select(func.count(ChatMessage.id)).where(
            ChatMessage.user_id == user_id,
            ChatMessage.role == "user",
            ChatMessage.created_at >= since
        )
    ) or 0

    plans = db.scalar(
        select(func.count(WorkoutPlan.id)).where(
            WorkoutPlan.user_id == user_id,
            WorkoutPlan.created_at >= since
        )
    ) or 0

    return chats + plans


def remaining_today(db: Session, user_id: int) -> int:
    return max(0, settings.AI_DAILY_LIMIT - used_today(db, user_id))


def ensure_quota(db: Session, user_id: int) -> None:

    if remaining_today(db, user_id) <= 0:
        raise HTTPException(
            status_code=429,
            detail="Daily AI limit reached. Your plan and metrics are still "
                   "available - try the coach again tomorrow."
        )
