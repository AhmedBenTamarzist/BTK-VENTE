import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import settings

def get_engine():
    db_url = settings.DATABASE_URL
    
    # Try connecting to PostgreSQL first
    if db_url.startswith("postgresql"):
        try:
            # Test engine creation
            eng = create_engine(
                db_url,
                pool_pre_ping=True,
                pool_size=10,
                max_overflow=20
            )
            # Try a quick test connection
            with eng.connect() as conn:
                pass
            print(f"--> Connexion PostgreSQL réussie ({settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME})")
            return eng
        except Exception as e:
            print(f"--> Attention: Impossible de se connecter à PostgreSQL ({e}).")
            print("--> Basculement automatique sur la base de données locale SQLite (quincaillerie.db).")

    # Fallback to local SQLite file for standalone execution
    sqlite_url = "sqlite:///./quincaillerie.db"
    eng = create_engine(sqlite_url, connect_args={"check_same_thread": False})
    return eng

engine = get_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
