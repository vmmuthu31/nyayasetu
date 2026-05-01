from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:password@localhost:5432/nyayasetu"
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    anthropic_api_key: str = ""

    s3_endpoint_url: str = "http://localhost:9000"
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin"
    s3_bucket_name: str = "nyayasetu"

    tesseract_cmd: str = "/usr/bin/tesseract"
    poppler_path: str = "/usr/bin"

    frontend_url: str = "http://localhost:3000"

    # CCMS Integration
    ccms_webhook_secret: str = "change-me-ccms-secret"

    # Appeal limitation periods (days) — per Indian procedural law
    appeal_limitation_days_hc: int = 90   # High Court orders
    appeal_limitation_days_sc: int = 90   # SLP to Supreme Court
    comply_default_days: int = 30

    class Config:
        env_file = ".env"


settings = Settings()
