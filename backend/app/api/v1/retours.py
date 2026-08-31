from typing import List, Optional
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import BonRetour, LigneRetour, Client, Article, Utilisateur
from app.schemas import BonRetourCreate, BonRetourOut
from app.api.deps import get_current_user, require_roles
from app.services.numbering_service import generate_next_number
from app.services.article_service import adjust_stock
from app.services.log_service import log_system_action
from app.services.whatsapp_service import whatsapp_service

router = APIRouter()

@router.get("/", response_model=List[BonRetourOut])
def list_returns(
    id_client: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user)
):
    query = db.query(BonRetour)
    if id_client:
        query = query.filter(BonRetour.id_client == id_client)
    return query.order_by(BonRetour.date_retour.desc()).all()

@router.post("/", response_model=BonRetourOut, status_code=status.HTTP_201_CREATED)
def create_return(
    retour_in: BonRetourCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_roles(["admin", "vendeur", "caissier"]))
):
    client = db.query(Client).filter(Client.id_client == retour_in.id_client).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client introuvable")

    num_retour = generate_next_number(db, "bon_retour")
    montant_ttc = Decimal('0.000')

    lignes_retour = []
    for l in retour_in.lignes:
        article = db.query(Article).filter(Article.id_article == l.id_article).first()
        if not article:
            raise HTTPException(status_code=404, detail=f"Article ID {l.id_article} introuvable")

        qty = Decimal(str(l.quantite))
        pu = Decimal(str(l.prix_unitaire_ttc))
        line_total = qty * pu
        montant_ttc += line_total

        lr = LigneRetour(
            id_article=l.id_article,
            quantite=qty,
            prix_unitaire_ttc=pu
        )
        lignes_retour.append(lr)

        # Restock returned article
        adjust_stock(db, l.id_article, qty, allow_negative=True)

    if retour_in.id_document:
        from app.models import Document, FacturationDocument, Facturation
        doc = db.query(Document).filter(Document.id_document == retour_in.id_document).first()
        if doc:
            doc.montant_retourne = Decimal(str(doc.montant_retourne)) + montant_ttc
            
            if doc.facture_dans_facturation:
                fact_link = db.query(FacturationDocument).filter(FacturationDocument.id_document == doc.id_document).first()
                if fact_link:
                    fact = db.query(Facturation).filter(Facturation.id_facturation == fact_link.id_facturation).first()
                    if fact:
                        fact.montant_retourne = Decimal(str(fact.montant_retourne)) + montant_ttc

    bon_retour = BonRetour(
        numero=num_retour,
        id_document=retour_in.id_document,
        id_client=retour_in.id_client,
        montant_ttc=montant_ttc,
        motif=retour_in.motif,
        id_utilisateur=current_user.id_utilisateur,
        statut="valide",
        mode_remboursement=retour_in.mode_remboursement,
        lignes=lignes_retour
    )

    db.add(bon_retour)
    db.commit()
    db.refresh(bon_retour)

    log_system_action(
        db, type_action="retour_client", table_concernee="bons_retour", id_enregistrement=bon_retour.id_retour,
        description=f"Création Bon de Retour N° {num_retour} (Montant TTC: {montant_ttc} TND)",
        id_utilisateur=current_user.id_utilisateur
    )
    db.commit()
    
    from app.services.payment_service import recalculate_client_payments
    recalculate_client_payments(db, client.id_client)
    db.commit() # Save the recalculated states
    
    # Reload client to get fresh solde
    db.refresh(client)
    
    if getattr(retour_in, 'send_whatsapp', False):
        background_tasks.add_task(
            whatsapp_service.send_return_notification,
            client=client,
            retour=bon_retour,
            current_balance=client.solde_compte
        )

    return bon_retour

@router.get("/{retour_id}", response_model=BonRetourOut)
def get_return(
    retour_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user)
):
    retour = db.query(BonRetour).filter(BonRetour.id_retour == retour_id).first()
    if not retour:
        raise HTTPException(status_code=404, detail="Bon de retour introuvable")

    # Récupérer le numéro du document lié si présent
    numero_document = None
    if retour.id_document:
        from app.models import Document
        doc = db.query(Document).filter(Document.id_document == retour.id_document).first()
        if doc:
            numero_document = doc.numero

    # Construire la réponse manuellement pour injecter numero_document
    result = BonRetourOut.model_validate(retour, from_attributes=True)
    result.numero_document = numero_document
    return result

@router.put("/{retour_id}", response_model=BonRetourOut)
def update_return(
    retour_id: int,
    retour_in: BonRetourCreate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_roles(["admin", "vendeur", "caissier"]))
):
    retour = db.query(BonRetour).filter(BonRetour.id_retour == retour_id).first()
    if not retour:
        raise HTTPException(status_code=404, detail="Bon de retour introuvable")

    client = db.query(Client).filter(Client.id_client == retour_in.id_client).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client introuvable")

    old_montant = Decimal(str(retour.montant_ttc))

    # Clear old lines
    db.query(LigneRetour).filter(LigneRetour.id_retour == retour_id).delete()

    montant_ttc = Decimal('0.000')
    lignes_retour = []
    for l in retour_in.lignes:
        article = db.query(Article).filter(Article.id_article == l.id_article).first()
        if not article:
            raise HTTPException(status_code=404, detail=f"Article ID {l.id_article} introuvable")

        qty = Decimal(str(l.quantite))
        pu = Decimal(str(l.prix_unitaire_ttc))
        line_total = qty * pu
        montant_ttc += line_total

        lr = LigneRetour(
            id_retour=retour_id,
            id_article=l.id_article,
            quantite=qty,
            prix_unitaire_ttc=pu
        )
        lignes_retour.append(lr)

    retour.id_client = retour_in.id_client
    retour.montant_ttc = montant_ttc
    retour.motif = retour_in.motif
    retour.lignes = lignes_retour

    db.commit()
    db.refresh(retour)

    log_system_action(
        db, type_action="modification", table_concernee="bons_retour", id_enregistrement=retour.id_retour,
        description=f"Modification Bon de Retour N° {retour.numero} (Montant TTC: {montant_ttc} TND)",
        id_utilisateur=current_user.id_utilisateur
    )
    db.commit()
    
    from app.services.payment_service import recalculate_client_payments
    recalculate_client_payments(db, retour_in.id_client)
    if client.id_client != retour_in.id_client:
        recalculate_client_payments(db, client.id_client)
    db.commit()
    
    return retour

@router.delete("/{retour_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_return(
    retour_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_roles(["admin", "vendeur"]))
):
    retour = db.query(BonRetour).filter(BonRetour.id_retour == retour_id).first()
    if not retour:
        raise HTTPException(status_code=404, detail="Bon de retour introuvable")

    if retour.facture_dans_facturation:
        raise HTTPException(status_code=400, detail="Ce bon de retour est intégré dans une facturation. Modifiez d'abord la facturation.")

    client_id = retour.id_client

    # Reverser le stock (annuler le restockage)
    for line in retour.lignes:
        adjust_stock(db, line.id_article, -line.quantite, allow_negative=True)

    # Si le retour était lié à un document, reverser le montant_retourne
    if retour.id_document:
        from app.models import Document
        doc = db.query(Document).filter(Document.id_document == retour.id_document).first()
        if doc:
            doc.montant_retourne = max(Decimal('0.000'), Decimal(str(doc.montant_retourne)) - Decimal(str(retour.montant_ttc)))

    log_system_action(
        db, type_action="suppression", table_concernee="bons_retour", id_enregistrement=retour_id,
        description=f"Suppression Bon de Retour N° {retour.numero} (Montant TTC: {retour.montant_ttc} TND)",
        id_utilisateur=current_user.id_utilisateur
    )

    db.delete(retour)
    db.commit()

    from app.services.payment_service import recalculate_client_payments
    recalculate_client_payments(db, client_id)
    db.commit()

