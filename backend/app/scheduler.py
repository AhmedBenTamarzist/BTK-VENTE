import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import Session
from datetime import date
from app.database import SessionLocal
from app.models import RelanceCredit, Client
from app.services.whatsapp_service import whatsapp_service

logger = logging.getLogger(__name__)

BACKUP_JOB_ID = "daily_backup"

_scheduler = None  # instance partagée, créée par start_scheduler()

def process_daily_reminders():
    """Find scheduled relances for today and send WhatsApp reminders."""
    logger.info("Starting daily credit reminders process...")
    db: Session = SessionLocal()
    try:
        today = date.today()
        # Find all pending relances scheduled for today or earlier
        relances = db.query(RelanceCredit).filter(
            RelanceCredit.statut == "planifiee",
            RelanceCredit.date_planifiee <= today
        ).all()

        for relance in relances:
            client = db.query(Client).filter(Client.id_client == relance.id_client).first()
            if client and client.solde_compte < 0: # Check if they still owe money
                # Send whatsapp
                whatsapp_service.send_credit_reminder(
                    client=client,
                    relance=relance,
                    current_balance=client.solde_compte
                )

                # We do NOT mark the relance as 'effectuee' here automatically if the business
                # process requires the user to mark it manually after calling, BUT since the prompt says
                # "le client a un credit alors il le envoe automatiquement", we should probably
                # update the status or just add a note. Let's add a note.
                relance.notes = f"{relance.notes or ''}\n[{date.today()}] Rappel WhatsApp automatique envoyé.".strip()
                db.add(relance)

        db.commit()
        logger.info(f"Processed {len(relances)} daily credit reminders.")
    except Exception as e:
        logger.error(f"Error processing daily reminders: {e}")
        db.rollback()
    finally:
        db.close()


def run_backup_job():
    """Job planifié : sauvegarde de la base + envoi email, dans sa propre session."""
    from app.services.backup_service import run_backup
    logger.info("Starting scheduled database backup...")
    db = SessionLocal()
    try:
        success, message = run_backup(db)
        logger.info(f"Scheduled backup {'succeeded' if success else 'failed'}: {message}")
    finally:
        db.close()


def reschedule_backup_job(actif: bool, heure_envoi: str):
    """Met à jour (ou retire) le job de sauvegarde quotidien selon les
    réglages courants — appelé au démarrage et à chaque modification depuis
    l'interface (Paramètres > Sauvegardes), sans redémarrer l'application."""
    if _scheduler is None:
        return

    if _scheduler.get_job(BACKUP_JOB_ID):
        _scheduler.remove_job(BACKUP_JOB_ID)

    if not actif:
        return

    try:
        hour, minute = [int(x) for x in heure_envoi.split(":")]
    except (ValueError, AttributeError):
        logger.error(f"Heure d'envoi de sauvegarde invalide : {heure_envoi!r} (format attendu HH:MM)")
        return

    _scheduler.add_job(
        run_backup_job,
        trigger=CronTrigger(hour=hour, minute=minute),
        id=BACKUP_JOB_ID,
        name="Sauvegarde quotidienne de la base de données",
        replace_existing=True,
    )
    logger.info(f"Job de sauvegarde planifié tous les jours à {heure_envoi}.")


def start_scheduler():
    global _scheduler
    _scheduler = BackgroundScheduler()
    _scheduler.start()
    logger.info("Background scheduler started.")

    # Applique les réglages de sauvegarde déjà enregistrés (si l'admin les a configurés)
    db = SessionLocal()
    try:
        from app.services.backup_service import get_or_create_backup_settings
        params = get_or_create_backup_settings(db)
        reschedule_backup_job(params.actif, params.heure_envoi)
    except Exception as e:
        logger.error(f"Impossible d'initialiser le job de sauvegarde : {e}")
    finally:
        db.close()

    # Rappels de crédit quotidiens — désactivés à la demande du client (envoi manuel uniquement)
    # _scheduler.add_job(
    #     process_daily_reminders,
    #     trigger=CronTrigger(hour=9, minute=0),
    #     id="daily_reminders",
    #     name="Send daily WhatsApp credit reminders",
    #     replace_existing=True,
    # )

    return _scheduler
