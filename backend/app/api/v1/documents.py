from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status, BackgroundTasks
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Document, Utilisateur
from app.schemas import DocumentCreate, DocumentOut, DeliveryBatchCreate
from app.api.deps import get_current_user, require_roles
from app.services.document_service import create_sales_document, update_sales_document, convert_devis_to_bl, convert_devis_to_facture, record_partial_delivery
from app.services.log_service import log_system_action
from app.services.whatsapp_service import whatsapp_service

router = APIRouter()

@router.get("/", response_model=List[DocumentOut])
def list_documents(
    type_document: Optional[str] = Query(None, description="devis, bon_livraison, facture_rapide"),
    id_client: Optional[int] = Query(None),
    statut: Optional[str] = Query(None),
    statut_livraison: Optional[str] = Query(None, description="non_livre, partiellement_livre, livre"),
    non_factures_only: bool = False,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user)
):
    query = db.query(Document)
    if type_document:
        query = query.filter(Document.type_document == type_document)
    if id_client:
        query = query.filter(Document.id_client == id_client)
    if statut:
        query = query.filter(Document.statut == statut)
    if statut_livraison:
        query = query.filter(Document.statut_livraison == statut_livraison)
    if non_factures_only:
        query = query.filter(Document.type_document == "bon_livraison", Document.facture_dans_facturation == False)

    return query.order_by(Document.date_document.desc()).all()

@router.get("/{document_id}", response_model=DocumentOut)
def get_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user)
):
    doc = db.query(Document).filter(Document.id_document == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document non trouvé")

    # Quantité déjà retournée par article, pour les bons de retour explicitement liés à ce document
    from app.models import BonRetour, LigneRetour
    from sqlalchemy import func
    returned_map = dict(
        db.query(LigneRetour.id_article, func.sum(LigneRetour.quantite))
        .join(BonRetour, BonRetour.id_retour == LigneRetour.id_retour)
        .filter(BonRetour.id_document == document_id, BonRetour.statut == "valide")
        .group_by(LigneRetour.id_article)
        .all()
    )
    for l in doc.lignes:
        l.quantite_retournee = returned_map.get(l.id_article, 0)

    return doc

@router.post("/", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
def create_document(
    doc_in: DocumentCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_roles(["admin", "vendeur", "caissier", "gestionnaire_stock"]))
):
    doc = create_sales_document(db, doc_in, user_id=current_user.id_utilisateur)
    log_system_action(
        db, type_action="creation", table_concernee="documents", id_enregistrement=doc.id_document,
        description=f"Création document {doc.type_document} N° {doc.numero} (Client ID: {doc.id_client}, Total TTC: {doc.montant_ttc_final} TND, Livraison: {doc.statut_livraison})",
        id_utilisateur=current_user.id_utilisateur
    )
    db.commit()
    db.refresh(doc)
    
    # WhatsApp is now triggered manually via the /send-whatsapp endpoint to avoid stealing focus during payment.
    return doc

@router.put("/{document_id}", response_model=DocumentOut)
def update_document(
    document_id: int,
    doc_in: DocumentCreate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_roles(["admin", "vendeur", "caissier"]))
):
    doc = update_sales_document(db, document_id, doc_in, user_id=current_user.id_utilisateur)
    log_system_action(
        db, type_action="modification", table_concernee="documents", id_enregistrement=doc.id_document,
        description=f"Modification document N° {doc.numero} (Total TTC: {doc.montant_ttc_final} TND)",
        id_utilisateur=current_user.id_utilisateur
    )
    db.commit()
    db.refresh(doc)
    return doc

@router.post("/{document_id}/deliver", response_model=DocumentOut)
def deliver_document_items(
    document_id: int,
    delivery_batch: DeliveryBatchCreate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_roles(["admin", "vendeur", "caissier", "gestionnaire_stock"]))
):
    doc = record_partial_delivery(db, document_id, delivery_batch, user_id=current_user.id_utilisateur)
    log_system_action(
        db, type_action="livraison_articles", table_concernee="documents", id_enregistrement=doc.id_document,
        description=f"Enregistrement livraison pour document N° {doc.numero} (Statut livraison: {doc.statut_livraison})",
        id_utilisateur=current_user.id_utilisateur
    )
    db.commit()
    db.refresh(doc)
    return doc

@router.post("/{devis_id}/convert-to-bl", response_model=DocumentOut)
def convert_devis(
    devis_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_roles(["admin", "vendeur", "caissier"]))
):
    bl = convert_devis_to_bl(db, devis_id, user_id=current_user.id_utilisateur)
    log_system_action(
        db, type_action="conversion", table_concernee="documents", id_enregistrement=bl.id_document,
        description=f"Conversion devis ID {devis_id} vers Bon de Livraison N° {bl.numero}",
        id_utilisateur=current_user.id_utilisateur
    )
    db.commit()
    db.refresh(bl)
    return bl

@router.post("/{devis_id}/convert-to-facture", response_model=DocumentOut)
def convert_devis_facture(
    devis_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_roles(["admin", "vendeur", "caissier"]))
):
    facture = convert_devis_to_facture(db, devis_id, user_id=current_user.id_utilisateur)
    log_system_action(
        db, type_action="conversion", table_concernee="documents", id_enregistrement=facture.id_document,
        description=f"Conversion devis ID {devis_id} vers Facture Rapide N° {facture.numero}",
        id_utilisateur=current_user.id_utilisateur
    )
    db.commit()
    db.refresh(facture)
    return facture

@router.post("/{document_id}/send-whatsapp", status_code=200)
def send_whatsapp_document(
    document_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_roles(["admin", "vendeur", "caissier"]))
):
    from app.models import Document
    doc = db.query(Document).filter(Document.id_document == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document non trouvé")
        
    if not doc.client:
        raise HTTPException(status_code=400, detail="Ce document n'a pas de client associé")
        
    background_tasks.add_task(
        whatsapp_service.send_sale_notification,
        client=doc.client,
        document=doc,
        current_balance=doc.client.solde_compte
    )
    
    return {"status": "success", "message": "Notification WhatsApp de vente déclenchée"}
