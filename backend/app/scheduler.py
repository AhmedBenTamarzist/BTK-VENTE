import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import Session
from datetime import date
from app.database import SessionLocal
from app.models import RelanceCredit, Client
from app.services.whatsapp_service import whatsapp_service

logger = logging.getLogger(__name__)

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

def start_scheduler():
    scheduler = BackgroundScheduler()
    # Run every day at 09:00 AM
    # Désactivé suite à la demande du client de faire l'envoi manuellement
    # scheduler.add_job(
    #     process_daily_reminders,
    #     trigger=CronTrigger(hour=9, minute=0),
    #     id="daily_reminders",
    #     name="Send daily WhatsApp credit reminders",
    #     replace_existing=True,
    # )
    # scheduler.start()
    # logger.info("Background scheduler started (Jobs disabled).")
    return scheduler
