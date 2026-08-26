import json
import os
from typing import List, Union, Optional
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "TicketFlow — Smart Ticket Booking Platform"
    API_V1_STR: str = "/api/v1"
    
    # Environment & Security
    ENVIRONMENT: str = "development"
    APP_ENV: Optional[str] = None
    JWT_SECRET: str = "ticketflow-secret-key-change-in-production-min-32-chars-long"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Database URL (handles postgresql://, postgres://, and postgresql+asyncpg://)
    DATABASE_URL: str = "postgresql+asyncpg://postgres:admin@localhost:5432/theatre_saas"
    SYNC_DATABASE_URL: Optional[str] = None
    
    @field_validator("DATABASE_URL", mode="before")
    def assemble_db_url(cls, v: str) -> str:
        if v.startswith("postgresql://"):
            return v.replace("postgresql://", "postgresql+asyncpg://", 1)
        elif v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql+asyncpg://", 1)
        return v

    # TTL & Business Rules
    SEAT_HOLD_TTL_MINUTES: int = 5
    WAITLIST_OFFER_TTL_MINUTES: int = 15
    BACKGROUND_SWEEPER_INTERVAL_SECONDS: int = 30
    
    # Notifications & Email
    EMAIL_PROVIDER: str = "mock"
    EMAIL_API_KEY: Optional[str] = None
    EMAIL_FROM: Optional[str] = "noreply@ticketflow.dev"
    FRONTEND_URL: Optional[str] = "http://localhost:5173"
    
    # CORS
    BACKEND_CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]
    CORS_ORIGINS: Optional[Union[List[str], str]] = None

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, str):
            return json.loads(v)
        return v

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )

    def validate_production_security(self):
        env = (self.APP_ENV or self.ENVIRONMENT or "development").lower()
        if env in ["production", "prod"]:
            if not self.JWT_SECRET or self.JWT_SECRET == "ticketflow-secret-key-change-in-production-min-32-chars-long":
                raise ValueError("SECURITY ALERT: A custom, secure JWT_SECRET (minimum 32 characters) must be set when running in production.")


settings = Settings()

# Synchronize aliases
if settings.APP_ENV and not settings.ENVIRONMENT:
    settings.ENVIRONMENT = settings.APP_ENV

if settings.CORS_ORIGINS:
    parsed_origins = Settings.assemble_cors_origins(settings.CORS_ORIGINS)
    for origin in parsed_origins:
        if origin not in settings.BACKEND_CORS_ORIGINS:
            if isinstance(settings.BACKEND_CORS_ORIGINS, list):
                settings.BACKEND_CORS_ORIGINS.append(origin)

if settings.FRONTEND_URL and settings.FRONTEND_URL not in settings.BACKEND_CORS_ORIGINS:
    if isinstance(settings.BACKEND_CORS_ORIGINS, list):
        settings.BACKEND_CORS_ORIGINS.append(settings.FRONTEND_URL)

if not settings.SYNC_DATABASE_URL:
    db_url = settings.DATABASE_URL
    if "postgresql+asyncpg://" in db_url:
        settings.SYNC_DATABASE_URL = db_url.replace("postgresql+asyncpg://", "postgresql+psycopg://", 1)
    else:
        settings.SYNC_DATABASE_URL = db_url

settings.validate_production_security()
