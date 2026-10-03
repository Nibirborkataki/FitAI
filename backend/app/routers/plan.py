from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.workout_plan import WorkoutPlan
from app.schemas.ai import WorkoutPlanResponse
from app.services import gemini_service
from app.services.ai_usage import ensure_quota
from app.services.profile_service import get_profile_or_404, report_for


router = APIRouter(
    prefix="/api/plan",
    tags=["Workout plan"]
)


def latest_plan(db: Session, user_id: int) -> WorkoutPlan | None:
    return db.scalar(
        select(WorkoutPlan)
        .where(WorkoutPlan.user_id == user_id)
        .order_by(WorkoutPlan.created_at.desc(), WorkoutPlan.id.desc())
        .limit(1)
    )


@router.get(
    "",
    response_model=WorkoutPlanResponse | None
)
def get_plan(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Return the saved plan, or null if none exists yet (no AI call)."""

    return latest_plan(db, current_user.id)


@router.post(
    "/generate",
    response_model=WorkoutPlanResponse,
    status_code=201
)
def generate_plan(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate a new AI plan from the profile + Python metrics."""

    profile = get_profile_or_404(db, current_user)
    ensure_quota(db, current_user.id)

    report = report_for(profile)
    generated, model = gemini_service.generate_workout_plan(profile, report)

    plan = WorkoutPlan(
        user_id=current_user.id,
        plan=generated.model_dump(),
        metrics=report,
        model=model
    )

    db.add(plan)
    db.commit()
    db.refresh(plan)

    return plan
