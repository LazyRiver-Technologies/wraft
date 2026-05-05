from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_SERVICE_KEY: str
    SUPABASE_ANON_KEY: str
    DATABASE_URL: str
    GEMINI_API_KEY: str
    GROQ_API_KEY: str
    REDIS_URL: str
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: Optional[str] = None
    META_VERIFY_TOKEN: str
    META_APP_SECRET: str
    PLATFORM_WA_PHONE_NUMBER_ID: Optional[str] = None
    PLATFORM_WA_ACCESS_TOKEN: Optional[str] = None
    RAZORPAY_KEY_ID: Optional[str] = None
    RAZORPAY_KEY_SECRET: Optional[str] = None
    RAZORPAY_WEBHOOK_SECRET: Optional[str] = None
    ENVIRONMENT: str = "development"
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001"
    ]

    ADMIN_SECRET_KEY: str = "default_dev_key_change_me_in_prod_12345"
    ADMIN_PASSWORD_HASH: str = "$2b$12$ERW6MVoeaI4qs0nmD4IexOFEpKkq1chqcQYxQhBmsgZ0H1kbVnk6W" # hash of 'admin'
    ADMIN_ALLOWED_IPS: list[str] = []

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()  # type: ignore
