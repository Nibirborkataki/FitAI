from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.profiles import Profile
from app.models.user import User
from app.schemas.profile import (
    ProfileCreate,
    ProfileResponse
)
from app.services.profile_service import get_profile, get_profile_or_404


router = APIRouter(
    prefix="/api/profile",
    tags=["Profile"]
)


class ProfileOut(ProfileResponse):
    updated_at: datetime


@router.post(
    "",
    response_model=ProfileOut,
    status_code=201
)
def create_profile(
    data: ProfileCreate,
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db)
):

    if get_profile(db, current_user):

        raise HTTPException(
            status_code=409,
            detail="Profile already exists"
        )

    profile = Profile(
        user_id=current_user.id,
        **data.model_dump()
    )

    db.add(profile)
    db.commit()
    db.refresh(profile)

    return profile


@router.put(
    "",
    response_model=ProfileOut
)
def upsert_profile(
    data: ProfileCreate,
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db)
):
    """Create the profile, or replace it when the user edits their answers."""

    profile = get_profile(db, current_user)

    if profile is None:
        profile = Profile(user_id=current_user.id)
        db.add(profile)

    for field, value in data.model_dump().items():
        setattr(profile, field, value)

    db.commit()
    db.refresh(profile)

    return profile


@router.get(
    "",
    response_model=ProfileOut
)
def read_profile(
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db)
):

    return get_profile_or_404(db, current_user)
