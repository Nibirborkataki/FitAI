from pydantic_settings import BaseSettings, SettingsConfigDict

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

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def cors_origins_list(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.CORS_ORIGINS.split(",")
            if origin.strip()
        ]

settings = Settings()
