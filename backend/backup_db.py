"""
Lance une sauvegarde manuelle immédiate (utile pour tester la configuration) :

    python backup_db.py

La sauvegarde automatique quotidienne est gérée par le planificateur interne
de l'application (voir app/scheduler.py) selon l'heure réglée dans
Paramètres > Sauvegardes — ce script sert uniquement à déclencher une
sauvegarde à la main.
"""
import sys
from app.database import SessionLocal
from app.services.backup_service import run_backup

if __name__ == "__main__":
    db = SessionLocal()
    try:
        success, message = run_backup(db)
        print(message)
        sys.exit(0 if success else 1)
    finally:
        db.close()
