from fastapi import APIRouter, Depends
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.chat_message import ChatMessage
from app.models.user import User
from app.routers.plan import latest_plan
from app.schemas.ai import (
    ChatMessageResponse,
    ChatReply,
    ChatRequest,
    UsageResponse
)
from app.services import gemini_service
from app.services.ai_usage import ensure_quota, remaining_today, used_today
from app.services.profile_service import get_profile_or_404, report_for


router = APIRouter(
    prefix="/api/coach",
    tags=["AI coach"]
)


def _recent_messages(db: Session, user_id: int, limit: int) -> list[ChatMessage]:
    messages = db.scalars(
        select(ChatMessage)
        .where(ChatMessage.user_id == user_id)
        .order_by(ChatMessage.created_at.desc(), ChatMessage.id.desc())
        .limit(limit)
    ).all()
    return list(reversed(messages))


@router.get(
    "/history",
    response_model=list[ChatMessageResponse]
)
def get_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return _recent_messages(db, current_user.id, 50)


@router.delete(
    "/history",
    status_code=204
)
def clear_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db.execute(
        delete(ChatMessage).where(ChatMessage.user_id == current_user.id)
    )
    db.commit()


@router.get(
    "/usage",
    response_model=UsageResponse
)
def get_usage(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    used = used_today(db, current_user.id)

    return {
        "used_today": used,
        "daily_limit": settings.AI_DAILY_LIMIT,
        "remaining_today": max(0, settings.AI_DAILY_LIMIT - used)
    }


@router.post(
    "/chat",
    response_model=ChatReply
)
def chat(
    data: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    profile = get_profile_or_404(db, current_user)
    ensure_quota(db, current_user.id)

    message = data.message.strip()
    history = _recent_messages(
        db, current_user.id, gemini_service.CHAT_HISTORY_WINDOW
    )
    plan = latest_plan(db, current_user.id)
    plan_summary = plan.plan.get("summary") if plan else None

    text, _model = gemini_service.coach_reply(
        profile, report_for(profile), plan_summary, history, message
    )

    # Persist only after the AI answered, so failed calls don't use quota
    db.add(ChatMessage(
        user_id=current_user.id, role="user", content=message
    ))
    reply = ChatMessage(
        user_id=current_user.id, role="assistant", content=text
    )
    db.add(reply)
    db.commit()
    db.refresh(reply)

    return {
        "reply": reply,
        "remaining_today": remaining_today(db, current_user.id)
    }
