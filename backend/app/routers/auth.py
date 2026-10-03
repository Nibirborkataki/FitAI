from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.security import (
    create_access_token,
    hash_password,
    verify_password
)
from app.models.user import User
from app.services.profile_service import get_profile
from app.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    TokenResponse
)


router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"]
)


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=201
)
def register(
    data: RegisterRequest,
    db: Session = Depends(get_db)
):

    existing_user = db.scalar(
        select(User).where(
            User.email == data.email
        )
    )

    if existing_user:

        raise HTTPException(
            status_code=409,
            detail="Email already registered"
        )

    user = User(
        full_name=data.full_name,
        email=data.email,
        password_hash=hash_password(
            data.password
        )
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id)

    return {
        "access_token": token,
        "token_type": "bearer"
    }


@router.post(
    "/login",
    response_model=TokenResponse
)
def login(
    data: LoginRequest,
    db: Session = Depends(get_db)
):

    user = db.scalar(
        select(User).where(
            User.email == data.email
        )
    )

    if not user:

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    if not verify_password(
        data.password,
        user.password_hash
    ):

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    token = create_access_token(user.id)

    return {
        "access_token": token,
        "token_type": "bearer"
    }

@router.get("/me")
def get_me(
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db)
):

    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "first_name": (current_user.full_name or "").split(" ")[0]
                      or current_user.email.split("@")[0],
        "has_profile": get_profile(db, current_user) is not None
    }