from datetime import date, datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models import RelanceCredit, Client, Document
from app.schemas import RelanceCreate, RelanceUpdate

def schedule_credit_reminder(
    db: Session,
    relance_in: RelanceCreate,
    user_id: Optional[int] = None
) -> RelanceCredit:
    client = db.query(Client).filter(Client.id_client == relance_in.id_client).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client introuvable")

    if relance_in.date_planifiee is not None:
        date_planifiee = relance_in.date_planifiee
        delai = (date_planifiee - date.today()).days
    else:
        delai = relance_in.delai_override_jours if relance_in.delai_override_jours is not None else client.delai_relance_jours
        date_planifiee = date.today() + timedelta(days=delai)

    relance = RelanceCredit(
        id_client=client.id_client,
        date_planifiee=date_planifiee,
        delai_jours_utilise=delai,
        solde_au_moment=client.solde_compte,
        canal_prevu=relance_in.canal_prevu,
        statut="planifiee",
        notes=relance_in.notes
    )

    db.add(relance)
    db.flush()
    return relance

def update_credit_reminder_status(
    db: Session,
    relance_id: int,
    relance_update: RelanceUpdate,
    user_id: Optional[int] = None
) -> RelanceCredit:
    relance = db.query(RelanceCredit).filter(RelanceCredit.id_relance == relance_id).first()
    if not relance:
        raise HTTPException(status_code=404, detail="Relance de crédit introuvable")

    relance.statut = relance_update.statut
    relance.canal_utilise = relance_update.canal_utilise or relance.canal_prevu
    relance.id_utilisateur = user_id

    if relance_update.statut == "effectuee":
        relance.date_execution = datetime.now()

        # Automatically schedule the next reminder using client default delay
        client = db.query(Client).filter(Client.id_client == relance.id_client).first()
        if client and client.solde_compte < 0:
            next_delai = client.delai_relance_jours
            next_date = date.today() + timedelta(days=next_delai)

            next_relance = RelanceCredit(
                id_client=client.id_client,
                date_planifiee=next_date,
                delai_jours_utilise=next_delai,
                solde_au_moment=client.solde_compte,
                canal_prevu="automatique",
                statut="planifiee",
                notes=f"Relance automatique programmée suite à l'exécution de la relance N° {relance.id_relance}"
            )
            db.add(next_relance)

    if relance_update.notes:
        relance.notes = f"{relance.notes or ''}\n{relance_update.notes}".strip()

    db.flush()
    return relance

def sync_due_relances(db: Session) -> int:
    """
    Génère automatiquement une relance "planifiee" pour tout client endetté dont
    le document impayé le plus ancien dépasse son délai de relance configuré,
    s'il n'a pas déjà une relance en attente. Appelé à chaque consultation de la
    liste des relances à effectuer, pour que les clients nouvellement en retard
    apparaissent sans intervention manuelle (l'envoi WhatsApp, lui, reste manuel).
    """
    today = date.today()

    clients_en_dette = db.query(Client).filter(Client.solde_compte < 0, Client.actif == True).all()
    created = 0

    for client in clients_en_dette:
        has_pending = db.query(RelanceCredit).filter(
            RelanceCredit.id_client == client.id_client,
            RelanceCredit.statut == "planifiee"
        ).first()
        if has_pending:
            continue

        oldest_unpaid = db.query(Document).filter(
            Document.id_client == client.id_client,
            Document.montant_restant > 0,
            Document.statut != "annule"
        ).order_by(Document.date_document.asc()).first()
        if not oldest_unpaid:
            continue

        due_date = oldest_unpaid.date_document.date() + timedelta(days=client.delai_relance_jours)
        if due_date > today:
            continue

        relance = RelanceCredit(
            id_client=client.id_client,
            date_planifiee=due_date,
            delai_jours_utilise=client.delai_relance_jours,
            solde_au_moment=client.solde_compte,
            canal_prevu="automatique",
            statut="planifiee",
            notes=f"Relance générée automatiquement : document N° {oldest_unpaid.numero} impayé depuis le {oldest_unpaid.date_document.strftime('%d/%m/%Y')}."
        )
        db.add(relance)
        created += 1

    if created:
        db.flush()
    return created
