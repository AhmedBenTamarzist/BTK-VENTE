from decimal import Decimal
from typing import Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models import Achat, LigneAchat, Fournisseur, Article
from app.schemas import AchatCreate
from app.services.article_service import adjust_stock

def create_achat_fournisseur(
    db: Session,
    achat_in: AchatCreate,
    user_id: Optional[int] = None
) -> Achat:
    fournisseur = db.query(Fournisseur).filter(Fournisseur.id_fournisseur == achat_in.id_fournisseur, Fournisseur.actif == True).first()
    if not fournisseur:
        raise HTTPException(status_code=404, detail="Fournisseur introuvable")

    montant_ht = Decimal('0.000')
    montant_tva = Decimal('0.000')
    montant_taxe_supplementaire = Decimal('0.000')
    montant_ttc = Decimal('0.000')

    lignes_achat = []

    for l in achat_in.lignes:
        article = db.query(Article).filter(Article.id_article == l.id_article).first()
        if not article:
            raise HTTPException(status_code=404, detail=f"Article ID {l.id_article} introuvable")

        qty = Decimal(str(l.quantite))
        tva_pct = Decimal(str(l.taux_tva_achat))
        taxe_suppl_pct = Decimal(str(l.taux_taxe_supplementaire))
        remise_pct = Decimal(str(l.remise_pourcentage))

        # TTC = HT x (1+TVA%) x (1-Remise%) x (1+Taxe Suppl.%), dans cet ordre.
        multiplicateur = (
            (Decimal('1.00') + tva_pct / Decimal('100.00'))
            * (Decimal('1.00') - remise_pct / Decimal('100.00'))
            * (Decimal('1.00') + taxe_suppl_pct / Decimal('100.00'))
        )

        if l.prix_achat_ttc is not None:
            # Le TTC saisi fait foi (évite un arrondi intermédiaire qui décalerait le total).
            p_ttc = Decimal(str(l.prix_achat_ttc))
            p_ht = p_ttc / multiplicateur if multiplicateur > 0 else Decimal('0.000')
        else:
            p_ht = Decimal(str(l.prix_achat_ht))
            p_ttc = p_ht * multiplicateur

        montant_line_ttc = qty * p_ttc

        # Détail HT/TVA/Taxe Suppl. informatif, décomposé dans le même ordre que le prix unitaire.
        line_ht = qty * p_ht
        apres_tva = line_ht * (Decimal('1.00') + tva_pct / Decimal('100.00'))
        line_tva = apres_tva - line_ht
        apres_remise = apres_tva * (Decimal('1.00') - remise_pct / Decimal('100.00'))
        line_taxe_suppl = (apres_remise * (Decimal('1.00') + taxe_suppl_pct / Decimal('100.00'))) - apres_remise

        p_ttc_unit = p_ttc

        montant_ht += line_ht
        montant_tva += line_tva
        montant_taxe_supplementaire += line_taxe_suppl
        montant_ttc += montant_line_ttc

        l_achat = LigneAchat(
            id_article=l.id_article,
            quantite=qty,
            prix_achat_ht=p_ht,
            taux_tva_achat=tva_pct,
            taux_taxe_supplementaire=taxe_suppl_pct,
            remise_pourcentage=remise_pct,
            prix_achat_ttc=p_ttc_unit,
            montant_ligne_ttc=montant_line_ttc,
            nouveau_prix_vente_ttc=Decimal(str(l.nouveau_prix_vente_ttc)) if l.nouveau_prix_vente_ttc is not None else None,
            nouvelle_remise_vente=Decimal(str(l.nouvelle_remise_vente)) if l.nouvelle_remise_vente is not None else None,
        )
        lignes_achat.append(l_achat)

        # Update article sales details if provided
        if l.nouveau_prix_vente_ttc is not None:
            article.prix_vente_ttc = Decimal(str(l.nouveau_prix_vente_ttc))
            
            # Log price history (simplified for now, ideally we'd add to historique_prix_vente)
            # We skip history creation here for brevity, assuming standard update is enough for quick entry
            
        if l.nouvelle_remise_vente is not None:
            article.remise_max_pourcentage = Decimal(str(l.nouvelle_remise_vente))

        # Increase stock for purchased item
        adjust_stock(db, l.id_article, qty, allow_negative=True)

    achat = Achat(
        numero_facture_fournisseur=achat_in.numero_facture_fournisseur,
        id_fournisseur=achat_in.id_fournisseur,
        date_achat=achat_in.date_achat,
        montant_ht=montant_ht,
        montant_tva=montant_tva,
        montant_taxe_supplementaire=montant_taxe_supplementaire,
        montant_ttc=montant_ttc,
        montant_paye=Decimal('0.000'),
        montant_restant=montant_ttc,
        statut_paiement="non_paye",
        id_utilisateur=user_id,
        notes=achat_in.notes,
        lignes=lignes_achat
    )

    db.add(achat)
    db.flush()
    return achat
