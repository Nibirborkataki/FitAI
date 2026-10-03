from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, utcnow


class WorkoutPlan(Base):
    """
    An AI-generated weekly plan. Stored so the dashboard can be
    re-opened without calling Gemini again.
    """

    __tablename__ = "workout_plans"

    id: Mapped[int] = mapped_column(
        primary_key=True
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False
    )

    plan: Mapped[dict] = mapped_column(
        JSON,
        nullable=False
    )

    # Snapshot of the Python-computed metrics used to build the prompt
    metrics: Mapped[dict] = mapped_column(
        JSON,
        nullable=False
    )

    model: Mapped[str] = mapped_column(
        String(80),
        nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=utcnow,
        index=True,
        nullable=False
    )
