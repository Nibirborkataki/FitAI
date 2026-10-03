from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.profiles import Profile
from app.models.user import User
from app.services.calculations import build_health_report


def get_profile(db: Session, user: User) -> Profile | None:
    return db.scalar(
        select(Profile).where(
            Profile.user_id == user.id
        )
    )


def get_profile_or_404(db: Session, user: User) -> Profile:

    profile = get_profile(db, user)

    if not profile:
        raise HTTPException(
            status_code=404,
            detail="Profile not found. Complete onboarding first."
        )

    return profile


def report_for(profile: Profile) -> dict:
    return build_health_report(
        age=profile.age,
        gender=profile.gender,
        height_cm=profile.height_cm,
        weight_kg=profile.weight_kg,
        target_weight_kg=profile.target_weight_kg,
        goal=profile.goal,
        activity_level=profile.activity_level,
        experience_level=profile.experience_level,
        workout_days=profile.workout_days,
        workout_duration=profile.workout_duration,
        workout_preference=profile.workout_preference,
        sleep_hours=profile.sleep_hours,
        dietary_preference=profile.dietary_preference,
        medical_conditions=profile.medical_conditions,
        injuries=profile.injuries
    )
