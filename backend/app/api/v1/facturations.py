from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Facturation, FacturationDocument, Document, Utilisateur
from app.schemas import FacturationCreate, FacturationUpdate, FacturationOut
from app.api.deps import get_current_user, require_roles
from app.services.invoice_service import (
    create_fiscal_invoice_from_bls,
    update_fiscal_invoice,
    delete_fiscal_invoice
)
from app.services.log_service import log_system_action

router = APIRouter()

@router.get("/", response_model=List[FacturationOut])
def list_facturations(
    id_client: Optional[int] = Query(None),
    statut: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user)
):
    query = db.query(Facturation)
    if id_client:
        query = query.filter(Facturation.id_client == id_client)
    if statut:
        query = query.filter(Facturation.statut == statut)
    return query.order_by(Facturation.date_facturation.desc()).all()

@router.get("/{facturation_id}", response_model=FacturationOut)
def get_facturation(
    facturation_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user)
):
    fact = db.query(Facturation).filter(Facturation.id_facturation == facturation_id).first()
    if not fact:
        raise HTTPException(status_code=404, detail="Facturation non trouvée")
    return fact

@router.get("/{facturation_id}/bls", response_model=list)
def get_facturation_bls(
    facturation_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user)
):
    """Retourne la liste des Bons de Livraison liés à cette facturation."""
    links = db.query(FacturationDocument).filter(
        FacturationDocument.id_facturation == facturation_id
    ).all()
    doc_ids = [lnk.id_document for lnk in links]
    if not doc_ids:
        return []
    bls = db.query(Document).filter(Document.id_document.in_(doc_ids)).all()
    return [
        {
            "id_document": bl.id_document,
            "numero": bl.numero,
            "date_document": bl.date_document.isoformat() if bl.date_document else None,
            "montant_ttc_final": float(bl.montant_ttc_final),
            "statut": bl.statut
        }
        for bl in bls
    ]

@router.get("/{facturation_id}/retours", response_model=list)
def get_facturation_retours(
    facturation_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user)
):
    """Retourne la liste des Bons de Retour liés à cette facturation."""
    from app.models import FacturationRetour, BonRetour
    links = db.query(FacturationRetour).filter(
        FacturationRetour.id_facturation == facturation_id
    ).all()
    ret_ids = [lnk.id_retour for lnk in links]
    if not ret_ids:
        return []
    retours = db.query(BonRetour).filter(BonRetour.id_retour.in_(ret_ids)).all()
    return [
        {
            "id_retour": r.id_retour,
            "numero": r.numero,
            "date_retour": r.date_retour.isoformat() if r.date_retour else None,
            "montant_ttc": float(r.montant_ttc),
            "statut": r.statut,
            "facture_dans_facturation": r.facture_dans_facturation,
            "lignes": [
                {
                    "id_article": l.id_article,
                    "quantite": float(l.quantite),
                    "prix_unitaire_ttc": float(l.prix_unitaire_ttc)
                }
                for l in r.lignes
            ]
        }
        for r in retours
    ]


@router.post("/", response_model=FacturationOut, status_code=status.HTTP_201_CREATED)
def create_facturation(
    facturation_in: FacturationCreate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_roles(["admin", "vendeur", "caissier"]))
):
    fact = create_fiscal_invoice_from_bls(db, facturation_in, user_id=current_user.id_utilisateur)
    log_system_action(
        db, type_action="facturation_fiscale", table_concernee="facturations", id_enregistrement=fact.id_facturation,
        description=f"Création Facture Fiscale N° {fact.numero_facture} (Montant TTC: {fact.montant_ttc} TND)",
        id_utilisateur=current_user.id_utilisateur
    )
    db.commit()
    db.refresh(fact)
    return fact

@router.put("/{facturation_id}", response_model=FacturationOut)
def update_facturation(
    facturation_id: int,
    data: FacturationUpdate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_roles(["admin", "vendeur"]))
):
    fact = update_fiscal_invoice(db, facturation_id, data, user_id=current_user.id_utilisateur)
    log_system_action(
        db, type_action="facturation_modifiee", table_concernee="facturations", id_enregistrement=fact.id_facturation,
        description=f"Modification Facture Fiscale N° {fact.numero_facture}",
        id_utilisateur=current_user.id_utilisateur
    )
    db.commit()
    db.refresh(fact)
    return fact

@router.delete("/{facturation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_facturation(
    facturation_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_roles(["admin"]))
):
    fact = db.query(Facturation).filter(Facturation.id_facturation == facturation_id).first()
    if not fact:
        raise HTTPException(status_code=404, detail="Facturation non trouvée")
    numero = fact.numero_facture
    delete_fiscal_invoice(db, facturation_id)
    log_system_action(
        db, type_action="facturation_supprimee", table_concernee="facturations", id_enregistrement=facturation_id,
        description=f"Suppression Facture Fiscale N° {numero}",
        id_utilisateur=current_user.id_utilisateur
    )
    db.commit()
