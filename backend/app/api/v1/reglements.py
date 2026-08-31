from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status, BackgroundTasks
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Reglement, ReglementFournisseur, Utilisateur
from app.schemas import (
    ReglementCreate, ReglementOut,
    ReglementFournisseurCreate, ReglementFournisseurOut,
    StatutChequeUpdate
)
from app.api.deps import get_current_user, require_roles
from app.services.payment_service import (
    add_client_payment, add_supplier_payment,
    recalculate_client_payments, recalculate_achat_payment
)
from app.services.log_service import log_system_action
from app.services.whatsapp_service import whatsapp_service

router = APIRouter()

VALID_STATUTS_CHEQUE = {"en_attente", "encaisse", "rejete"}

# --- CLIENT PAYMENTS ---
@router.get("/clients", response_model=List[ReglementOut])
def list_client_payments(
    id_client: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user)
):
    query = db.query(Reglement)
    if id_client:
        query = query.filter(Reglement.id_client == id_client)
    return query.order_by(Reglement.date_reglement.desc()).all()

@router.post("/clients", response_model=ReglementOut, status_code=status.HTTP_201_CREATED)
def create_client_payment(
    reg_in: ReglementCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_roles(["admin", "caissier", "vendeur"]))
):
    reg = add_client_payment(db, reg_in, user_id=current_user.id_utilisateur)
    log_system_action(
        db, type_action="reglement_client", table_concernee="reglements", id_enregistrement=reg.id_reglement,
        description=f"Règlement client N° {reg.numero} (Montant: {reg.montant} TND, Mode: {reg.mode_paiement})",
        id_utilisateur=current_user.id_utilisateur
    )
    db.commit()
    db.refresh(reg)
    
    if getattr(reg_in, 'send_whatsapp', False) and reg.client:
        # Fetch linked document if any, to include its details in the WhatsApp message
        linked_doc = None
        if reg_in.id_document:
            from app.models import Document
            linked_doc = db.query(Document).filter(Document.id_document == reg_in.id_document).first()
        background_tasks.add_task(
            whatsapp_service.send_payment_notification,
            client=reg.client,
            reglement=reg,
            current_balance=reg.client.solde_compte,
            document=linked_doc
        )
        
    return reg

@router.put("/clients/{reglement_id}/statut-cheque", response_model=ReglementOut)
def update_client_cheque_status(
    reglement_id: int,
    body: StatutChequeUpdate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_roles(["admin", "caissier"]))
):
    reg = db.query(Reglement).filter(Reglement.id_reglement == reglement_id).first()
    if not reg:
        raise HTTPException(status_code=404, detail="Règlement introuvable")
    if reg.mode_paiement not in ("cheque", "traite"):
        raise HTTPException(status_code=400, detail="Seuls les règlements par chèque ou traite ont un statut d'encaissement")
    if body.statut_cheque not in VALID_STATUTS_CHEQUE:
        raise HTTPException(status_code=400, detail=f"Statut invalide. Valeurs autorisées: {', '.join(VALID_STATUTS_CHEQUE)}")

    ancien_statut = reg.statut_cheque
    reg.statut_cheque = body.statut_cheque
    db.flush()
    recalculate_client_payments(db, reg.id_client)

    log_system_action(
        db, type_action="modification", table_concernee="reglements", id_enregistrement=reg.id_reglement,
        description=f"Statut chèque règlement N° {reg.numero} : {ancien_statut or 'N/A'} -> {body.statut_cheque}",
        id_utilisateur=current_user.id_utilisateur
    )
    db.commit()
    db.refresh(reg)
    return reg

# --- SUPPLIER PAYMENTS ---
@router.get("/fournisseurs", response_model=List[ReglementFournisseurOut])
def list_supplier_payments(
    id_fournisseur: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user)
):
    query = db.query(ReglementFournisseur)
    if id_fournisseur:
        query = query.filter(ReglementFournisseur.id_fournisseur == id_fournisseur)
    return query.order_by(ReglementFournisseur.date_reglement.desc()).all()

@router.post("/fournisseurs", response_model=ReglementFournisseurOut, status_code=status.HTTP_201_CREATED)
def create_supplier_payment(
    reg_in: ReglementFournisseurCreate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_roles(["admin", "caissier", "gestionnaire_stock"]))
):
    reg = add_supplier_payment(db, reg_in, user_id=current_user.id_utilisateur)
    log_system_action(
        db, type_action="reglement_fournisseur", table_concernee="reglements_fournisseur", id_enregistrement=reg.id_reglement_fournisseur,
        description=f"Règlement fournisseur N° {reg.numero} (Montant: {reg.montant} TND, Mode: {reg.mode_paiement})",
        id_utilisateur=current_user.id_utilisateur
    )
    db.commit()
    db.refresh(reg)
    return reg

@router.put("/fournisseurs/{reglement_id}/statut-cheque", response_model=ReglementFournisseurOut)
def update_supplier_cheque_status(
    reglement_id: int,
    body: StatutChequeUpdate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_roles(["admin", "caissier", "gestionnaire_stock"]))
):
    reg = db.query(ReglementFournisseur).filter(ReglementFournisseur.id_reglement_fournisseur == reglement_id).first()
    if not reg:
        raise HTTPException(status_code=404, detail="Règlement introuvable")
    if reg.mode_paiement not in ("cheque", "traite"):
        raise HTTPException(status_code=400, detail="Seuls les règlements par chèque ou traite ont un statut d'encaissement")
    if body.statut_cheque not in VALID_STATUTS_CHEQUE:
        raise HTTPException(status_code=400, detail=f"Statut invalide. Valeurs autorisées: {', '.join(VALID_STATUTS_CHEQUE)}")

    ancien_statut = reg.statut_cheque
    reg.statut_cheque = body.statut_cheque
    db.flush()
    if reg.id_achat:
        recalculate_achat_payment(db, reg.id_achat)

    log_system_action(
        db, type_action="modification", table_concernee="reglements_fournisseur", id_enregistrement=reg.id_reglement_fournisseur,
        description=f"Statut chèque règlement N° {reg.numero} : {ancien_statut or 'N/A'} -> {body.statut_cheque}",
        id_utilisateur=current_user.id_utilisateur
    )
    db.commit()
    db.refresh(reg)
    return reg
