from typing import List, Optional
from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, status, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import RelanceCredit, Utilisateur, Client
from app.schemas import RelanceCreate, RelanceUpdate, RelanceOut
from app.api.deps import get_current_user, require_roles
from app.services.relance_service import schedule_credit_reminder, update_credit_reminder_status, sync_due_relances
from app.services.whatsapp_service import whatsapp_service

router = APIRouter()

@router.get("/", response_model=List[RelanceOut])
def list_relances(
    id_client: Optional[int] = Query(None),
    statut: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user)
):
    sync_due_relances(db)
    db.commit()

    query = db.query(RelanceCredit)
    if id_client:
        query = query.filter(RelanceCredit.id_client == id_client)
    if statut:
        query = query.filter(RelanceCredit.statut == statut)
    return query.order_by(RelanceCredit.date_planifiee.asc()).all()

@router.post("/", response_model=RelanceOut, status_code=status.HTTP_201_CREATED)
def create_relance(
    relance_in: RelanceCreate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_roles(["admin", "vendeur", "caissier"]))
):
    relance = schedule_credit_reminder(db, relance_in, user_id=current_user.id_utilisateur)
    db.commit()
    db.refresh(relance)
    return relance

@router.put("/{relance_id}", response_model=RelanceOut)
def update_relance(
    relance_id: int,
    relance_update: RelanceUpdate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_roles(["admin", "vendeur", "caissier"]))
):
    relance = update_credit_reminder_status(db, relance_id, relance_update, user_id=current_user.id_utilisateur)
    db.commit()
    db.refresh(relance)
    return relance

class SendRelanceBody(BaseModel):
    prochaine_relance_jours: Optional[int] = None

@router.post("/{relance_id}/send-whatsapp", response_model=RelanceOut, status_code=status.HTTP_200_OK)
def send_whatsapp_relance(
    relance_id: int,
    body: SendRelanceBody,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_roles(["admin", "vendeur", "caissier"]))
):
    relance = db.query(RelanceCredit).filter(RelanceCredit.id_relance == relance_id).first()
    if not relance:
        raise HTTPException(status_code=404, detail="Relance non trouvée")

    client = db.query(Client).filter(Client.id_client == relance.id_client).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client non trouvé")

    background_tasks.add_task(
        whatsapp_service.send_credit_reminder,
        client=client,
        relance=relance,
        current_balance=client.solde_compte
    )

    # L'envoi clôt cette relance ; la prochaine est programmée directement ici
    # (le délai choisi par l'utilisateur prime sur le délai par défaut du client).
    relance.notes = f"{relance.notes or ''}\n[{date.today()}] Relance WhatsApp envoyée.".strip()
    relance.statut = "effectuee"
    relance.date_execution = datetime.now()
    relance.canal_utilise = "whatsapp"
    relance.id_utilisateur = current_user.id_utilisateur

    if client.solde_compte < 0:
        next_delai = body.prochaine_relance_jours if body.prochaine_relance_jours is not None else client.delai_relance_jours
        next_date = date.today() + timedelta(days=next_delai)
        next_relance = RelanceCredit(
            id_client=client.id_client,
            date_planifiee=next_date,
            delai_jours_utilise=next_delai,
            solde_au_moment=client.solde_compte,
            canal_prevu="automatique",
            statut="planifiee",
            notes=f"Relance programmée suite à l'envoi de la relance N° {relance.id_relance}."
        )
        db.add(next_relance)

    db.commit()
    db.refresh(relance)
    return relance
