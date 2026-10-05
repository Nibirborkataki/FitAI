from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.core.config import settings
from app.core.database import engine
from app.routers.auth import router as auth_router
from app.routers.coach import router as coach_router
from app.routers.health import router as health_router
from app.routers.metrics import router as metrics_router
from app.routers.plan import router as plan_router
from app.routers.profile import router as profile_router
from app.services.gemini_service import AIServiceError

app = FastAPI(
    title="FitAI API",
    description="AI-powered personal fitness and health assistant",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=settings.CORS_ORIGIN_REGEX or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

app.include_router(auth_router)
app.include_router(profile_router)
app.include_router(health_router)
app.include_router(metrics_router)
app.include_router(plan_router)
app.include_router(coach_router)


@app.exception_handler(AIServiceError)
def ai_service_error_handler(request: Request, exc: AIServiceError):

    return JSONResponse(
        status_code=503,
        content={"detail": str(exc)}
    )


@app.get("/api/health")
def health_check():

    return {
        "status": "ok",
        "service": "FitAI API"
    }


@app.get("/api/health/database")
def database_health():

    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))

    return {
        "status": "ok",
        "database": "connected"
    }
