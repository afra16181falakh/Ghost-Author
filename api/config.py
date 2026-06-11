"""
Central config loaded from environment variables / .env file.
"""
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://ghost:secret@localhost:5432/ghost_author"

    # Redis (Celery broker + WebSocket pub/sub)
    redis_url: str = "redis://localhost:6379/0"

    # AI
    gemini_api_key: str = ""

    # GitHub OAuth
    github_client_id: str = ""
    github_client_secret: str = ""
    github_token: str = ""

    # App
    secret_key: str = "change_me_in_production"
    environment: str = "development"
    frontend_url: str = "http://localhost:5176"

    # Notifications
    github_webhook_secret: str = ""
    slack_webhook_url: str = ""

    # Observability
    sentry_dsn: str = ""

    # Agent defaults
    max_attempts: int = 3
    max_cognitive: int = 15
    max_nesting: int = 2
    max_length: int = 15

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


# Alias used by settings.py test-webhook endpoint
def get_app_settings() -> Settings:
    return get_settings()


REQUIRED_PROD_VARS = ["gemini_api_key", "secret_key"]


def validate_startup(settings: Settings) -> None:
    """Raise on missing critical env vars in production."""
    if settings.environment != "production":
        return
    errors = []
    if settings.secret_key == "change_me_in_production":
        errors.append("SECRET_KEY must be changed from the default in production")
    if not settings.gemini_api_key:
        errors.append("GEMINI_API_KEY is required")
    if not settings.database_url or "localhost" in settings.database_url and settings.environment == "production":
        pass  # allow localhost in prod for docker-compose internal networking
    if errors:
        raise RuntimeError(
            "Ghost Author startup failed — missing required configuration:\n"
            + "\n".join(f"  • {e}" for e in errors)
        )
