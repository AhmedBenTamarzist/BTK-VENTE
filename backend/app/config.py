import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Quincaillerie ERP & POS Backend"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Database configuration
    DB_HOST: str = os.getenv("DB_HOST", "localhost")
    DB_PORT: str = os.getenv("DB_PORT", "5432")
    DB_USER: str = os.getenv("DB_USER", "postgres")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD", "postgres")
    DB_NAME: str = os.getenv("DB_NAME", "quincaillerie_db")
    
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    )

    # JWT Authentication
    SECRET_KEY: str = os.getenv("SECRET_KEY", "super_secret_quincaillerie_key_change_me_in_production_12345")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days token

    # Server settings
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    RELOAD: bool = os.getenv("RELOAD", "false").lower() == "true"

    # WhatsApp API (non utilisé actuellement — whatsapp_service.py ouvre des liens wa.me,
    # ces variables ne servent que si une intégration Graph API est ajoutée plus tard)
    WHATSAPP_TOKEN: str = os.getenv("WHATSAPP_TOKEN", "")
    WHATSAPP_PHONE_ID: str = os.getenv("WHATSAPP_PHONE_ID", "")

    # Sauvegarde de la base de données (backup_db.py)
    BACKUP_DIR: str = os.getenv("BACKUP_DIR", "backups")
    BACKUP_RETENTION_DAYS: int = int(os.getenv("BACKUP_RETENTION_DAYS", "14"))
    PG_DUMP_PATH: str = os.getenv("PG_DUMP_PATH", "pg_dump")

    # Envoi de la sauvegarde par email (SMTP)
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    BACKUP_EMAIL_TO: str = os.getenv("BACKUP_EMAIL_TO", "")

    class Config:
        case_sensitive = True

settings = Settings()
