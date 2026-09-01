"""
Sauvegarde de la base de données (PostgreSQL ou, à défaut, le fichier SQLite
local) + envoi par email. Les identifiants d'envoi (email, mot de passe
d'application, destinataire) et l'heure d'envoi sont configurés depuis
l'interface (Paramètres > Sauvegardes), stockés dans ParametresBackup —
pas dans des variables d'environnement.
"""
import gzip
import logging
import os
import shutil
import smtplib
import subprocess
from datetime import datetime, timedelta
from email.message import EmailMessage
from pathlib import Path
from typing import Tuple

from sqlalchemy.orm import Session

from app.config import settings
from app.models import ParametresBackup

logger = logging.getLogger(__name__)

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
BACKUP_DIR = BACKEND_DIR / settings.BACKUP_DIR


def get_or_create_backup_settings(db: Session) -> ParametresBackup:
    params = db.query(ParametresBackup).first()
    if not params:
        params = ParametresBackup(actif=False, heure_envoi="22:00")
        db.add(params)
        db.commit()
        db.refresh(params)
    return params


def _is_postgres_reachable() -> bool:
    try:
        from sqlalchemy import create_engine
        eng = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
        with eng.connect():
            pass
        return True
    except Exception:
        return False


def _dump_postgres(dest_gz: Path) -> Tuple[bool, str]:
    env = os.environ.copy()
    env["PGPASSWORD"] = settings.DB_PASSWORD
    cmd = [
        settings.PG_DUMP_PATH,
        "-h", settings.DB_HOST,
        "-p", str(settings.DB_PORT),
        "-U", settings.DB_USER,
        "-d", settings.DB_NAME,
        "--no-owner", "--no-privileges",
    ]
    try:
        result = subprocess.run(cmd, env=env, capture_output=True, check=True)
    except FileNotFoundError:
        return False, (
            f"pg_dump introuvable ('{settings.PG_DUMP_PATH}'). "
            f"Ajoute le dossier bin de PostgreSQL au PATH, ou règle PG_DUMP_PATH dans backend/.env."
        )
    except subprocess.CalledProcessError as e:
        return False, f"Erreur pg_dump (code {e.returncode}) : {e.stderr.decode('utf-8', errors='replace')}"

    with gzip.open(dest_gz, "wb") as f:
        f.write(result.stdout)
    return True, ""


def _dump_sqlite(dest_gz: Path) -> Tuple[bool, str]:
    sqlite_path = BACKEND_DIR / "quincaillerie.db"
    if not sqlite_path.exists():
        return False, f"Fichier SQLite introuvable ({sqlite_path})."
    with open(sqlite_path, "rb") as f_in, gzip.open(dest_gz, "wb") as f_out:
        shutil.copyfileobj(f_in, f_out)
    return True, ""


def _purge_old_backups():
    if settings.BACKUP_RETENTION_DAYS <= 0:
        return
    cutoff = datetime.now() - timedelta(days=settings.BACKUP_RETENTION_DAYS)
    for f in BACKUP_DIR.glob("quincaillerie_backup_*.gz"):
        try:
            if datetime.fromtimestamp(f.stat().st_mtime) < cutoff:
                f.unlink()
        except Exception as e:
            logger.warning(f"Impossible de supprimer l'ancienne sauvegarde {f.name} : {e}")


def _send_email(params: ParametresBackup, attachment: Path, success: bool, error_detail: str = "") -> str:
    if not params.smtp_email or not params.smtp_password or not params.email_destinataire:
        return "Email non envoyé : email d'envoi / mot de passe / destinataire non configurés."

    today = datetime.now().strftime('%d/%m/%Y')
    msg = EmailMessage()
    msg["From"] = params.smtp_email
    msg["To"] = params.email_destinataire

    if success:
        msg["Subject"] = f"[VenteApp] Sauvegarde OK - {today}"
        msg.set_content(f"Sauvegarde de la base de données du {today} réussie.\nFichier joint : {attachment.name}\n")
        with open(attachment, "rb") as f:
            msg.add_attachment(f.read(), maintype="application", subtype="gzip", filename=attachment.name)
    else:
        msg["Subject"] = f"[VenteApp] ECHEC Sauvegarde - {today}"
        msg.set_content(f"La sauvegarde automatique du {today} a échoué.\n\nDétail :\n{error_detail}")

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=30) as server:
            server.starttls()
            server.login(params.smtp_email, params.smtp_password)
            server.send_message(msg)
        return f"Email envoyé à {params.email_destinataire}."
    except Exception as e:
        return f"Erreur envoi email : {e}"


def run_backup(db: Session) -> Tuple[bool, str]:
    """Exécute une sauvegarde complète (dump + purge + email) et journalise le résultat
    dans ParametresBackup. Retourne (succès, message)."""
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    params = get_or_create_backup_settings(db)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    dest_gz = BACKUP_DIR / f"quincaillerie_backup_{timestamp}.sql.gz"

    use_postgres = settings.DATABASE_URL.startswith("postgresql") and _is_postgres_reachable()
    if use_postgres:
        ok, err = _dump_postgres(dest_gz)
    else:
        dest_gz = dest_gz.with_suffix("").with_suffix(".db.gz")
        ok, err = _dump_sqlite(dest_gz)

    if not ok:
        email_msg = _send_email(params, dest_gz, success=False, error_detail=err)
        message = f"Échec de la sauvegarde : {err} ({email_msg})"
        params.derniere_sauvegarde = datetime.now()
        params.dernier_statut = "echec"
        params.dernier_message = message
        db.commit()
        logger.error(message)
        return False, message

    _purge_old_backups()
    size_kb = dest_gz.stat().st_size / 1024
    email_msg = _send_email(params, dest_gz, success=True)
    message = f"Sauvegarde réussie ({dest_gz.name}, {size_kb:.1f} Ko). {email_msg}"

    params.derniere_sauvegarde = datetime.now()
    params.dernier_statut = "succes"
    params.dernier_message = message
    db.commit()
    logger.info(message)
    return True, message
