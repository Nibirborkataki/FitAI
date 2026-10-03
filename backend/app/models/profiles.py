from datetime import datetime

from sqlalchemy import (
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, utcnow


class Profile(Base):

    __tablename__ = "profiles"

    id: Mapped[int] = mapped_column(
        primary_key=True
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        unique=True,
        nullable=False
    )

    age: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )

    gender: Mapped[str] = mapped_column(
        String(30),
        nullable=False
    )

    height_cm: Mapped[float] = mapped_column(
        Float,
        nullable=False
    )

    weight_kg: Mapped[float] = mapped_column(
        Float,
        nullable=False
    )

    target_weight_kg: Mapped[float | None] = mapped_column(
        Float,
        nullable=True
    )

    goal: Mapped[str] = mapped_column(
        String(50),
        nullable=False
    )

    activity_level: Mapped[str] = mapped_column(
        String(50),
        nullable=False
    )

    experience_level: Mapped[str] = mapped_column(
        String(50),
        nullable=False
    )

    workout_days: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )

    workout_duration: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )

    equipment: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )

    workout_preference: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="mixed",
        server_default="mixed"
    )

    sleep_hours: Mapped[float | None] = mapped_column(
        Float,
        nullable=True
    )

    dietary_preference: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True
    )

    medical_conditions: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )

    injuries: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=utcnow,
        nullable=False
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=utcnow,
        onupdate=utcnow,
        nullable=False
    )