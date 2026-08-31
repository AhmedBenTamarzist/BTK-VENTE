from typing import List, Optional
from datetime import date as date_type
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Achat, LigneAchat, Utilisateur, ReglementFournisseur
from app.schemas import AchatCreate, AchatOut, AchatUpdate
from app.api.deps import get_current_user, require_roles
from app.services.achat_service import create_achat_fournisseur
from app.services.log_service import log_system_action
from app.services.numbering_service import generate_next_number
from decimal import Decimal

router = APIRouter()

@router.get("/", response_model=List[AchatOut])
def list_achats(
    fournisseur_id: Optional[int] = Query(None),
    statut_paiement: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user)
):
    query = db.query(Achat)
    if fournisseur_id:
        query = query.filter(Achat.id_fournisseur == fournisseur_id)
    if statut_paiement:
        query = query.filter(Achat.statut_paiement == statut_paiement)
    return query.order_by(Achat.date_creation.desc()).all()

@router.get("/{achat_id}", response_model=AchatOut)
def get_achat(
    achat_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user)
):
    achat = db.query(Achat).filter(Achat.id_achat == achat_id).first()
    if not achat:
        raise HTTPException(status_code=404, detail="Facture d'achat non trouvée")
    return achat

@router.post("/", response_model=AchatOut, status_code=status.HTTP_201_CREATED)
def create_achat(
    achat_in: AchatCreate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_roles(["admin", "gestionnaire_stock"]))
):
    achat = create_achat_fournisseur(db, achat_in, user_id=current_user.id_utilisateur)
    log_system_action(
        db, type_action="creation", table_concernee="achats", id_enregistrement=achat.id_achat,
        description=f"Création facture d'achat Fournisseur ID {achat.id_fournisseur} (Montant TTC: {achat.montant_ttc} TND)",
        id_utilisateur=current_user.id_utilisateur
    )
    db.commit()
    db.refresh(achat)
    return achat

@router.put("/{achat_id}", response_model=AchatOut)
def update_achat(
    achat_id: int,
    achat_in: AchatUpdate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_roles(["admin", "gestionnaire_stock"]))
):
    achat = db.query(Achat).filter(Achat.id_achat == achat_id).first()
    if not achat:
        raise HTTPException(status_code=404, detail="Facture d'achat non trouvée")
    if achat_in.numero_facture_fournisseur is not None:
        achat.numero_facture_fournisseur = achat_in.numero_facture_fournisseur or None
    if achat_in.date_achat is not None:
        achat.date_achat = achat_in.date_achat
    if achat_in.notes is not None:
        achat.notes = achat_in.notes or None
    db.commit()
    db.refresh(achat)
    log_system_action(
        db, type_action="modification", table_concernee="achats", id_enregistrement=achat.id_achat,
        description=f"Modification facture d'achat #{achat_id}",
        id_utilisateur=current_user.id_utilisateur
    )
    db.commit()
    return achat

class PaiementAchatIn:
    pass

from pydantic import BaseModel as _BM
class PaiementAchatBody(_BM):
    montant: Decimal
    mode_paiement: str
    reference_paiement: Optional[str] = None
    notes: Optional[str] = None

@router.post("/{achat_id}/paiements", response_model=AchatOut)
def add_paiement_achat(
    achat_id: int,
    body: PaiementAchatBody,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_roles(["admin", "gestionnaire_stock", "caissier"]))
):
    achat = db.query(Achat).filter(Achat.id_achat == achat_id).first()
    if not achat:
        raise HTTPException(status_code=404, detail="Facture d'achat non trouvée")

    montant = Decimal(str(body.montant))
    if montant <= 0:
        raise HTTPException(status_code=400, detail="Montant invalide")

    # Create reglement
    numero = generate_next_number(db, "reglement_fournisseur")
    statut_chq = "en_attente" if body.mode_paiement in ("cheque", "traite") else None
    reglement = ReglementFournisseur(
        numero=numero,
        id_fournisseur=achat.id_fournisseur,
        id_achat=achat.id_achat,
        montant=montant,
        mode_paiement=body.mode_paiement,
        reference_paiement=body.reference_paiement,
        statut_cheque=statut_chq,
        notes=body.notes,
        id_utilisateur=current_user.id_utilisateur
    )
    db.add(reglement)

    # Update achat payment status
    achat.montant_paye = Decimal(str(achat.montant_paye)) + montant
    achat.montant_restant = Decimal(str(achat.montant_ttc)) - achat.montant_paye
    if achat.montant_restant <= 0:
        achat.montant_restant = Decimal('0.000')
        achat.statut_paiement = "paye"
    elif achat.montant_paye > 0:
        achat.statut_paiement = "partiellement_paye"

    db.commit()
    db.refresh(achat)
    return achat

# ── Update lignes ─────────────────────────────────────────────────────────────
from pydantic import BaseModel as _BM2
class LigneAchatUpdate(_BM2):
    id_article: int
    quantite: Decimal
    prix_achat_ht: Decimal
    # Si fourni, prime sur prix_achat_ht pour le calcul du total (voir LigneAchatCreate)
    prix_achat_ttc: Optional[Decimal] = None
    taux_tva_achat: Decimal = Decimal('19.00')
    taux_taxe_supplementaire: Decimal = Decimal('0.00')
    remise_pourcentage: Decimal = Decimal('0.00')
    nouveau_prix_vente_ttc: Optional[Decimal] = None
    nouvelle_remise_vente: Optional[Decimal] = None

class LignesAchatUpdateBody(_BM2):
    lignes: List[LigneAchatUpdate]

@router.put("/{achat_id}/lignes", response_model=AchatOut)
def update_lignes_achat(
    achat_id: int,
    body: LignesAchatUpdateBody,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_roles(["admin", "gestionnaire_stock"]))
):
    from app.models import Article
    from app.services.article_service import adjust_stock

    achat = db.query(Achat).filter(Achat.id_achat == achat_id).first()
    if not achat:
        raise HTTPException(status_code=404, detail="Facture d'achat non trouvée")
    if not body.lignes:
        raise HTTPException(status_code=400, detail="Au moins une ligne est requise")

    # Reverse old stock movements for existing lines
    for old_line in achat.lignes:
        adjust_stock(db, old_line.id_article, -old_line.quantite, allow_negative=True)

    # Delete old lines
    db.query(LigneAchat).filter(LigneAchat.id_achat == achat_id).delete()

    montant_ht = Decimal('0.000')
    montant_tva = Decimal('0.000')
    montant_taxe_supplementaire = Decimal('0.000')
    montant_ttc = Decimal('0.000')

    for l in body.lignes:
        article = db.query(Article).filter(Article.id_article == l.id_article).first()
        if not article:
            raise HTTPException(status_code=404, detail=f"Article ID {l.id_article} introuvable")

        qty = Decimal(str(l.quantite))
        tva_pct = Decimal(str(l.taux_tva_achat))
        taxe_suppl_pct = Decimal(str(l.taux_taxe_supplementaire))
        remise_pct = Decimal(str(l.remise_pourcentage))

        # TTC = HT x (1+TVA%) x (1-Remise%) x (1+Taxe Suppl.%), dans cet ordre
        # (voir achat_service.create_achat_fournisseur pour le détail).
        multiplicateur = (
            (Decimal('1') + tva_pct / Decimal('100'))
            * (Decimal('1') - remise_pct / Decimal('100'))
            * (Decimal('1') + taxe_suppl_pct / Decimal('100'))
        )

        if l.prix_achat_ttc is not None:
            p_ttc = Decimal(str(l.prix_achat_ttc))
            p_ht = p_ttc / multiplicateur if multiplicateur > 0 else Decimal('0.000')
        else:
            p_ht = Decimal(str(l.prix_achat_ht))
            p_ttc = p_ht * multiplicateur

        line_ttc = qty * p_ttc

        line_ht = qty * p_ht
        apres_tva = line_ht * (Decimal('1') + tva_pct / Decimal('100'))
        line_tva = apres_tva - line_ht
        apres_remise = apres_tva * (Decimal('1') - remise_pct / Decimal('100'))
        line_taxe_suppl = (apres_remise * (Decimal('1') + taxe_suppl_pct / Decimal('100'))) - apres_remise

        p_ttc_unit = p_ttc

        montant_ht += line_ht
        montant_tva += line_tva
        montant_taxe_supplementaire += line_taxe_suppl
        montant_ttc += line_ttc

        new_line = LigneAchat(
            id_achat=achat_id,
            id_article=l.id_article,
            quantite=qty,
            prix_achat_ht=p_ht,
            taux_tva_achat=tva_pct,
            taux_taxe_supplementaire=taxe_suppl_pct,
            remise_pourcentage=remise_pct,
            prix_achat_ttc=p_ttc_unit,
            montant_ligne_ttc=line_ttc,
            nouveau_prix_vente_ttc=Decimal(str(l.nouveau_prix_vente_ttc)) if l.nouveau_prix_vente_ttc is not None else None,
            nouvelle_remise_vente=Decimal(str(l.nouvelle_remise_vente)) if l.nouvelle_remise_vente is not None else None,
        )
        db.add(new_line)

        # Update article prices if provided
        if l.nouveau_prix_vente_ttc is not None:
            article.prix_vente_ttc = Decimal(str(l.nouveau_prix_vente_ttc))
        if l.nouvelle_remise_vente is not None:
            article.remise_max_pourcentage = Decimal(str(l.nouvelle_remise_vente))

        # Apply new stock
        adjust_stock(db, l.id_article, qty, allow_negative=True)

    # Recalculate achat totals (keep montant_paye, recalc restant)
    achat.montant_ht = montant_ht
    achat.montant_tva = montant_tva
    achat.montant_taxe_supplementaire = montant_taxe_supplementaire
    achat.montant_ttc = montant_ttc
    achat.montant_restant = max(Decimal('0.000'), montant_ttc - Decimal(str(achat.montant_paye)))
    if achat.montant_restant <= 0:
        achat.statut_paiement = "paye"
    elif Decimal(str(achat.montant_paye)) > 0:
        achat.statut_paiement = "partiellement_paye"
    else:
        achat.statut_paiement = "non_paye"

    db.commit()
    db.refresh(achat)
    log_system_action(
        db, type_action="modification", table_concernee="achats", id_enregistrement=achat.id_achat,
        description=f"Modification des lignes facture d'achat #{achat_id}",
        id_utilisateur=current_user.id_utilisateur
    )
    db.commit()
    return achat
