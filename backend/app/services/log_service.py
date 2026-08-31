from typing import Optional, Any, Dict
from sqlalchemy.orm import Session
from app.models import LogAction

def log_system_action(
    db: Session,
    type_action: str,
    table_concernee: Optional[str] = None,
    id_enregistrement: Optional[int] = None,
    description: Optional[str] = None,
    donnees_avant: Optional[Dict[str, Any]] = None,
    donnees_apres: Optional[Dict[str, Any]] = None,
    id_utilisateur: Optional[int] = None,
    adresse_ip: Optional[str] = None
):
    try:
        log = LogAction(
            id_utilisateur=id_utilisateur,
            type_action=type_action,
            table_concernee=table_concernee,
            id_enregistrement=id_enregistrement,
            description=description,
            donnees_avant=donnees_avant,
            donnees_apres=donnees_apres,
            adresse_ip=adresse_ip
        )
        db.add(log)
        db.flush()
    except Exception as e:
        print(f"Error recording log: {e}")
