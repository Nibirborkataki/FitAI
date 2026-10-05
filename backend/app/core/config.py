from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def normalize_database_url(url: str) -> str:
    """
    Hosted Postgres providers (Neon, Render, Supabase...) hand out
    postgres:// or postgresql:// URLs; SQLAlchemy needs the psycopg 3 driver.
    """
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url


class Settings(BaseSettings):

    DATABASE_URL:str
    SECRET_KEY:str
    GEMINI_API_KEY:str
    GEMINI_MODEL:str = "gemini-3.8-flash"
    GEMINI_FALLBACK_MODEL:str = "gemini-flash-lite-latest"

    # Max Gemini calls (plan generations + chat messages) per user per day
    AI_DAILY_LIMIT:int = 40

    # Comma-separated list of allowed frontend origins
    CORS_ORIGINS:str = "http://localhost:5173,http://127.0.0.1:5173"

    # Optional regex for extra origins, e.g. Vercel preview deployments:
    # https://fitai-.*\.vercel\.app
    CORS_ORIGIN_REGEX:str | None = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @field_validator("DATABASE_URL")
    @classmethod
    def _use_psycopg_driver(cls, value: str) -> str:
        return normalize_database_url(value.strip())

    @property
    def cors_origins_list(self) -> list[str]:
        return [
            origin.strip().rstrip("/")
            for origin in self.CORS_ORIGINS.split(",")
            if origin.strip()
        ]

settings = Settings()
