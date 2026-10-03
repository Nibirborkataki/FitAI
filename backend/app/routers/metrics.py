from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.health import HealthReport
from app.services.profile_service import get_profile_or_404, report_for


router = APIRouter(
    prefix="/api/metrics",
    tags=["Metrics"]
)


@router.get(
    "",
    response_model=HealthReport
)
def get_metrics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Pure-Python health report. Costs zero AI calls."""

    return report_for(get_profile_or_404(db, current_user))
