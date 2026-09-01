from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db, SessionLocal
from app.models import Utilisateur
from app.schemas import BackupSettingsIn, BackupSettingsOut, BackupRunResult
from app.api.deps import require_roles
from app.services.backup_service import get_or_create_backup_settings, run_backup

router = APIRouter()


def _to_out(params) -> BackupSettingsOut:
    return BackupSettingsOut(
        id_backup=params.id_backup,
        actif=params.actif,
        heure_envoi=params.heure_envoi,
        smtp_email=params.smtp_email,
        smtp_password_defini=bool(params.smtp_password),
        email_destinataire=params.email_destinataire,
        derniere_sauvegarde=params.derniere_sauvegarde,
        dernier_statut=params.dernier_statut,
        dernier_message=params.dernier_message,
    )


@router.get("/", response_model=BackupSettingsOut)
def get_backup_settings(
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_roles(["admin"]))
):
    return _to_out(get_or_create_backup_settings(db))


@router.put("/", response_model=BackupSettingsOut)
def update_backup_settings(
    body: BackupSettingsIn,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_roles(["admin"]))
):
    params = get_or_create_backup_settings(db)
    if body.actif is not None:
        params.actif = body.actif
    if body.heure_envoi is not None:
        params.heure_envoi = body.heure_envoi
    if body.smtp_email is not None:
        params.smtp_email = body.smtp_email
    if body.smtp_password:  # ne jamais écraser avec une valeur vide
        params.smtp_password = body.smtp_password
    if body.email_destinataire is not None:
        params.email_destinataire = body.email_destinataire

    db.commit()
    db.refresh(params)

    # Le planificateur interne doit reprendre la nouvelle heure/activation immédiatement
    from app.scheduler import reschedule_backup_job
    reschedule_backup_job(params.actif, params.heure_envoi)

    return _to_out(params)


@router.post("/run-now", response_model=BackupRunResult)
def run_backup_now(
    current_user: Utilisateur = Depends(require_roles(["admin"]))
):
    db = SessionLocal()
    try:
        success, message = run_backup(db)
        return BackupRunResult(success=success, message=message)
    finally:
        db.close()
