import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import settings

# Corrige à la racine le "'utf-8' codec can't decode byte 0xe9..." rencontré sur
# les installations PostgreSQL Windows en français : sans ça, libpq renvoie ses
# messages d'erreur/diagnostics dans l'encodage ANSI local (CP1252), que
# psycopg2 essaie ensuite de décoder en UTF-8 et échoue. Forcer l'encodage
# client en UTF8 évite le problème à la source (variable lue par libpq).
os.environ.setdefault("PGCLIENTENCODING", "UTF8")

def _safe_error_message(e: Exception) -> str:
    """str(e) peut lever une UnicodeDecodeError : sur certaines installations
    Windows/PostgreSQL en français, libpq renvoie ses messages d'erreur (ex.
    "mot de passe") encodés en CP1252 plutôt qu'en UTF-8, et psycopg2 échoue
    à les décoder. On retente alors en CP1252 pour afficher le vrai message
    (mot de passe incorrect, base introuvable, etc.) plutôt qu'un crash."""
    try:
        return str(e)
    except UnicodeDecodeError:
        raw = e.args[0] if e.args else b""
        if isinstance(raw, bytes):
            return raw.decode("cp1252", errors="replace")
        if isinstance(raw, str):
            try:
                return raw.encode("utf-8", "surrogateescape").decode("cp1252", errors="replace")
            except Exception:
                pass
        return "erreur de connexion PostgreSQL (message illisible, probablement identifiants incorrects)"

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
            print(f"--> Attention: Impossible de se connecter à PostgreSQL ({_safe_error_message(e)}).")
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
