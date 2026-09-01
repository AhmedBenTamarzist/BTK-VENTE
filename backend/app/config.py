from typing import Optional
from urllib.parse import quote_plus
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # env_file=".env" est ce qui manquait : sans ça, pydantic-settings ignore
    # totalement backend/.env et chaque champ retombe sur sa valeur par
    # défaut codée ci-dessous (ex: DB_PASSWORD="postgres"), quel que soit le
    # contenu réel du fichier .env.
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=True, extra="ignore")

    PROJECT_NAME: str = "Quincaillerie ERP & POS Backend"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"

    # Database configuration
    DB_HOST: str = "localhost"
    DB_PORT: str = "5432"
    DB_USER: str = "postgres"
    DB_PASSWORD: str = "postgres"
    DB_NAME: str = "quincaillerie_db"

    # Calculée après coup (voir _build_database_url) à partir de DB_HOST/PORT/
    # USER/PASSWORD/NAME une fois ceux-ci résolus depuis l'environnement/.env —
    # sauf si DATABASE_URL est elle-même définie explicitement dans .env.
    DATABASE_URL: Optional[str] = None

    # JWT Authentication
    SECRET_KEY: str = "super_secret_quincaillerie_key_change_me_in_production_12345"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days token

    # Server settings
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    RELOAD: bool = False

    # WhatsApp API (non utilisé actuellement — whatsapp_service.py ouvre des liens wa.me,
    # ces variables ne servent que si une intégration Graph API est ajoutée plus tard)
    WHATSAPP_TOKEN: str = ""
    WHATSAPP_PHONE_ID: str = ""

    # Sauvegarde de la base de données (backup_db.py)
    BACKUP_DIR: str = "backups"
    BACKUP_RETENTION_DAYS: int = 14
    PG_DUMP_PATH: str = "pg_dump"

    # Envoi de la sauvegarde par email (SMTP)
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    BACKUP_EMAIL_TO: str = ""

    # Synchronisation des articles avec Debot (app dépôt/stock séparée)
    DEBOT_API_URL: str = "https://gdstock.ddns.net/api"
    DEBOT_API_KEY: str = ""

    @model_validator(mode="after")
    def _build_database_url(self):
        if not self.DATABASE_URL:
            # DB_USER/DB_PASSWORD sont encodés (quote_plus) : un mot de passe
            # contenant @, /, #, %, etc. casserait sinon la construction de l'URL.
            self.DATABASE_URL = (
                f"postgresql://{quote_plus(self.DB_USER)}:{quote_plus(self.DB_PASSWORD)}"
                f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
            )
        return self

settings = Settings()
