"""Environment configuration."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # API
    app_env: str = "development"
    log_level: str = "INFO"

    # Supabase Postgres
    database_url: str = "postgresql://postgres:postgres@localhost:5432/nuclear"

    # Cloudflare R2 (S3-compatible)
    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket_name: str = "nuclear"
    r2_endpoint_url: str = ""

    # LLM
    openrouter_api_key: str = ""
    openai_api_key: str = ""


settings = Settings()
