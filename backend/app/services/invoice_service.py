from decimal import Decimal
from typing import List, Optional, Dict
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models import Document, Facturation, FacturationDocument, LigneFacturation, Article, Client, Reglement, BonRetour, FacturationRetour
from app.schemas import FacturationCreate, FacturationUpdate
from app.services.numbering_service import generate_next_number

def create_fiscal_invoice_from_bls(
    db: Session,
    facturation_in: FacturationCreate,
    user_id: Optional[int] = None
) -> Facturation:
    client = db.query(Client).filter(Client.id_client == facturation_in.id_client).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client introuvable")

    if not facturation_in.document_ids:
        raise HTTPException(status_code=400, detail="Veuillez sélectionner au moins un Bon de Livraison")

    bls = db.query(Document).filter(
        Document.id_document.in_(facturation_in.document_ids),
        Document.type_document == "bon_livraison",
        Document.id_client == facturation_in.id_client
    ).all()

    if len(bls) != len(facturation_in.document_ids):
        raise HTTPException(status_code=400, detail="Un ou plusieurs Bons de Livraison sont introuvables ou n'appartiennent pas à ce client")

    for bl in bls:
        if bl.facture_dans_facturation:
            raise HTTPException(status_code=400, detail=f"Le Bon de Livraison N° {bl.numero} est déjà inclus dans une facturation")

    retours = []
    montant_total_retours = Decimal('0.000')
    if facturation_in.retour_ids:
        retours = db.query(BonRetour).filter(
            BonRetour.id_retour.in_(facturation_in.retour_ids),
            BonRetour.id_client == facturation_in.id_client
        ).all()
        
        if len(retours) != len(facturation_in.retour_ids):
            raise HTTPException(status_code=400, detail="Un ou plusieurs Bons de Retour sont introuvables")
            
        for r in retours:
            if r.facture_dans_facturation:
                raise HTTPException(status_code=400, detail=f"Le Bon de Retour N° {r.numero} est déjà inclus dans une facturation")
            montant_total_retours += Decimal(str(r.montant_ttc))

    numero_facture = generate_next_number(db, "facturation")
    remise_pct = Decimal(str(facturation_in.remise_pct or 0))

    tot_ht, tot_tva, tot_ttc, lignes_facturation = _aggregate_bls(
        db, 
        bls, 
        retours=retours, 
        mode_traitement_retours=facturation_in.mode_traitement_retours
    )

    # Calculate initial paid amount from grouped BLs
    total_already_paid = sum((Decimal(str(bl.montant_paye)) if bl.montant_paye else Decimal('0.000')) for bl in bls)

    # Apply global discount on totals
    coeff = Decimal('1.00') - (remise_pct / Decimal('100.00'))
    tot_ht_net = tot_ht * coeff
    tot_tva_net = tot_tva * coeff
    montant_timbre = Decimal(str(facturation_in.montant_timbre)) if facturation_in.montant_timbre is not None else Decimal('1.000')
    tot_ttc_net = (tot_ttc * coeff) + montant_timbre

    montant_restant = max(Decimal('0.000'), tot_ttc_net - total_already_paid)

    statut = "validee"
    if montant_restant <= 0:
        statut = "payee"
    elif total_already_paid > 0:
        statut = "partiellement_payee"

    facturation = Facturation(
        numero_facture=numero_facture,
        id_client=facturation_in.id_client,
        periode_debut=facturation_in.periode_debut,
        periode_fin=facturation_in.periode_fin,
        montant_ht=tot_ht_net,
        montant_tva=tot_tva_net,
        montant_timbre=montant_timbre,
        montant_ttc=tot_ttc_net,
        montant_retourne=montant_total_retours if facturation_in.mode_traitement_retours == "separer" else Decimal('0.000'),
        montant_paye=total_already_paid,
        montant_restant=montant_restant,
        remise_pct=remise_pct,
        statut=statut,
        id_utilisateur=user_id,
        lignes=lignes_facturation
    )
    db.add(facturation)
    db.flush()

    for bl in bls:
        link = FacturationDocument(id_facturation=facturation.id_facturation, id_document=bl.id_document)
        db.add(link)
        bl.facture_dans_facturation = True
        
    for r in retours:
        link = FacturationRetour(id_facturation=facturation.id_facturation, id_retour=r.id_retour)
        db.add(link)
        r.facture_dans_facturation = True

    from app.services.payment_service import recalculate_client_payments
    recalculate_client_payments(db, facturation.id_client)

    return facturation


def update_fiscal_invoice(
    db: Session,
    facturation_id: int,
    data: FacturationUpdate,
    user_id: Optional[int] = None
) -> Facturation:
    facturation = db.query(Facturation).filter(Facturation.id_facturation == facturation_id).first()
    if not facturation:
        raise HTTPException(status_code=404, detail="Facturation non trouvée")

    if data.numero_facture is not None:
        facturation.numero_facture = data.numero_facture
    if data.periode_debut is not None:
        facturation.periode_debut = data.periode_debut
    if data.periode_fin is not None:
        facturation.periode_fin = data.periode_fin

    if data.document_ids is not None or data.retour_ids is not None:
        # Resolve what we are updating
        new_doc_ids = data.document_ids if data.document_ids is not None else [lnk.id_document for lnk in db.query(FacturationDocument).filter(FacturationDocument.id_facturation == facturation_id).all()]
        new_ret_ids = data.retour_ids if data.retour_ids is not None else [lnk.id_retour for lnk in db.query(FacturationRetour).filter(FacturationRetour.id_facturation == facturation_id).all()]
        
        # Free old BLs
        old_links = db.query(FacturationDocument).filter(FacturationDocument.id_facturation == facturation_id).all()
        old_doc_ids = [lnk.id_document for lnk in old_links]
        for lnk in old_links:
            db.delete(lnk)
        db.query(Document).filter(Document.id_document.in_(old_doc_ids)).update(
            {Document.facture_dans_facturation: False}, synchronize_session=False
        )

        # Free old Retours
        old_ret_links = db.query(FacturationRetour).filter(FacturationRetour.id_facturation == facturation_id).all()
        old_ret_ids = [lnk.id_retour for lnk in old_ret_links]
        for lnk in old_ret_links:
            db.delete(lnk)
        if old_ret_ids:
            db.query(BonRetour).filter(BonRetour.id_retour.in_(old_ret_ids)).update(
                {BonRetour.facture_dans_facturation: False}, synchronize_session=False
            )

        new_bls = db.query(Document).filter(
            Document.id_document.in_(new_doc_ids),
            Document.type_document == "bon_livraison",
            Document.id_client == facturation.id_client
        ).all()
        if len(new_bls) != len(new_doc_ids):
            raise HTTPException(status_code=400, detail="Un ou plusieurs BLs introuvables ou n'appartiennent pas à ce client")
        for bl in new_bls:
            if bl.facture_dans_facturation and bl.id_document not in old_doc_ids:
                raise HTTPException(status_code=400, detail=f"Le BL N° {bl.numero} est déjà dans une autre facturation")

        new_retours = []
        montant_total_retours = Decimal('0.000')
        if new_ret_ids:
            new_retours = db.query(BonRetour).filter(
                BonRetour.id_retour.in_(new_ret_ids),
                BonRetour.id_client == facturation.id_client
            ).all()
            if len(new_retours) != len(new_ret_ids):
                raise HTTPException(status_code=400, detail="Un ou plusieurs Bons de Retour introuvables")
            for r in new_retours:
                if r.facture_dans_facturation and r.id_retour not in old_ret_ids:
                    raise HTTPException(status_code=400, detail=f"Le Bon de Retour N° {r.numero} est déjà dans une autre facturation")
                montant_total_retours += Decimal(str(r.montant_ttc))

        db.query(LigneFacturation).filter(LigneFacturation.id_facturation == facturation_id).delete()
        
        # We need to read mode_traitement_retours from somewhere, we can assume "soustraction" by default unless we add it to Facturation Update.
        mode_traitement = data.mode_traitement_retours if data.mode_traitement_retours is not None else "soustraction"
        tot_ht, tot_tva, tot_ttc, new_lignes = _aggregate_bls(db, new_bls, retours=new_retours, mode_traitement_retours=mode_traitement)
        
        for lg in new_lignes:
            lg.id_facturation = facturation_id
            db.add(lg)
            
        for bl in new_bls:
            link = FacturationDocument(id_facturation=facturation.id_facturation, id_document=bl.id_document)
            db.add(link)
            bl.facture_dans_facturation = True
            
        for r in new_retours:
            link = FacturationRetour(id_facturation=facturation.id_facturation, id_retour=r.id_retour)
            db.add(link)
            r.facture_dans_facturation = True

        remise_pct = Decimal(str(data.remise_pct if data.remise_pct is not None else (facturation.remise_pct or 0)))
        coeff = Decimal('1.00') - (remise_pct / Decimal('100.00'))
        montant_timbre = Decimal(str(data.montant_timbre)) if data.montant_timbre is not None else Decimal(str(facturation.montant_timbre or 1))
        facturation.montant_ht = tot_ht * coeff
        facturation.montant_tva = tot_tva * coeff
        facturation.montant_timbre = montant_timbre
        facturation.montant_ttc = (tot_ttc * coeff) + montant_timbre
        facturation.montant_retourne = montant_total_retours if mode_traitement == "separer" else Decimal('0.000')
        
        # Recalculate total paid amount based on the BLs' actual paid amounts
        # This properly includes global payments and cascaded payments
        total_paid = sum((Decimal(str(bl.montant_paye)) if bl.montant_paye else Decimal('0.000')) for bl in new_bls)
        
        facturation.montant_paye = total_paid
        facturation.montant_restant = max(Decimal('0.000'), facturation.montant_ttc - total_paid)
        facturation.remise_pct = remise_pct

    elif data.remise_pct is not None:
        old_links = db.query(FacturationDocument).filter(
            FacturationDocument.id_facturation == facturation_id
        ).all()
        bls = db.query(Document).filter(
            Document.id_document.in_([lnk.id_document for lnk in old_links])
        ).all()
        db.query(LigneFacturation).filter(LigneFacturation.id_facturation == facturation_id).delete()
        tot_ht, tot_tva, tot_ttc, new_lignes = _aggregate_bls(db, bls)
        for lg in new_lignes:
            lg.id_facturation = facturation_id
            db.add(lg)

        remise_pct = Decimal(str(data.remise_pct))
        coeff = Decimal('1.00') - (remise_pct / Decimal('100.00'))
        montant_timbre = Decimal(str(data.montant_timbre)) if data.montant_timbre is not None else Decimal(str(facturation.montant_timbre or 1))
        facturation.montant_ht = tot_ht * coeff
        facturation.montant_tva = tot_tva * coeff
        facturation.montant_timbre = montant_timbre
        facturation.montant_ttc = (tot_ttc * coeff) + montant_timbre
        facturation.montant_restant = max(Decimal('0.000'), facturation.montant_ttc - facturation.montant_paye)
        facturation.remise_pct = remise_pct

    if facturation.montant_restant <= 0:
        facturation.statut = "payee"
    elif facturation.montant_paye > 0:
        facturation.statut = "partiellement_payee"
    else:
        facturation.statut = "validee"

    from app.services.payment_service import recalculate_client_payments
    recalculate_client_payments(db, facturation.id_client)

    db.refresh(facturation)
    return facturation


def delete_fiscal_invoice(db: Session, facturation_id: int) -> None:
    facturation = db.query(Facturation).filter(Facturation.id_facturation == facturation_id).first()
    if not facturation:
        raise HTTPException(status_code=404, detail="Facturation non trouvée")

    # Si c'est la dernière facturation de l'année, on décrémente le compteur pour combler le trou
    numero = facturation.numero_facture
    from datetime import datetime
    from app.models import CompteurNumerotation
    current_year = datetime.now().year
    if numero and numero.endswith(f"/{str(current_year)[-2:]}"):
        try:
            num_int = int(numero.split('/')[0])
            compteur = db.query(CompteurNumerotation).filter(
                CompteurNumerotation.type_compteur == "facturation",
                CompteurNumerotation.annee == current_year,
                CompteurNumerotation.dernier_numero == num_int
            ).first()
            if compteur:
                compteur.dernier_numero -= 1
        except Exception:
            pass

    links = db.query(FacturationDocument).filter(
        FacturationDocument.id_facturation == facturation_id
    ).all()
    doc_ids = [lnk.id_document for lnk in links]
    if doc_ids:
        db.query(Document).filter(Document.id_document.in_(doc_ids)).update(
            {Document.facture_dans_facturation: False}, synchronize_session=False
        )

    client_id = facturation.id_client

    retours_links = db.query(FacturationRetour).filter(
        FacturationRetour.id_facturation == facturation_id
    ).all()
    retour_ids = [lnk.id_retour for lnk in retours_links]
    if retour_ids:
        from app.models import BonRetour
        db.query(BonRetour).filter(BonRetour.id_retour.in_(retour_ids)).update(
            {BonRetour.facture_dans_facturation: False}, synchronize_session=False
        )
    db.delete(facturation)
    db.flush()

    from app.services.payment_service import recalculate_client_payments
    recalculate_client_payments(db, client_id)


def _aggregate_bls(db: Session, bls: list, retours: list = None, mode_traitement_retours: str = "soustraction"):
    """Aggregate BL lines by article. Subtracts returns if requested. Returns (tot_ht, tot_tva, tot_ttc, lignes_facturation)."""
    aggregated_lines: Dict[int, dict] = {}
    retours = retours or []

    for bl in bls:
        for line in bl.lignes:
            art_id = line.id_article
            article = db.query(Article).filter(Article.id_article == art_id).first()
            if not article:
                continue
            taux_tva = article.taux_tva_vente
            pu_apres_remise_ttc = Decimal(str(line.prix_unitaire_apres_remise))
            qty = Decimal(str(line.quantite))
            pu_ht = pu_apres_remise_ttc / (Decimal('1.00') + (taux_tva / Decimal('100.00')))
            line_ht = qty * pu_ht
            line_ttc = qty * pu_apres_remise_ttc
            line_tva = line_ttc - line_ht

            if art_id not in aggregated_lines:
                aggregated_lines[art_id] = {
                    "quantite_totale": Decimal('0.000'),
                    "montant_ht": Decimal('0.000'),
                    "montant_tva": Decimal('0.000'),
                    "montant_ttc": Decimal('0.000'),
                    "taux_tva": taux_tva
                }
            aggregated_lines[art_id]["quantite_totale"] += qty
            aggregated_lines[art_id]["montant_ht"] += line_ht
            aggregated_lines[art_id]["montant_tva"] += line_tva
            aggregated_lines[art_id]["montant_ttc"] += line_ttc

    if mode_traitement_retours == "soustraction":
        for retour in retours:
            for line in retour.lignes:
                art_id = line.id_article
                article = db.query(Article).filter(Article.id_article == art_id).first()
                if not article:
                    continue
                taux_tva = article.taux_tva_vente
                pu_ttc = Decimal(str(line.prix_unitaire_ttc))
                qty = Decimal(str(line.quantite))
                pu_ht = pu_ttc / (Decimal('1.00') + (taux_tva / Decimal('100.00')))
                line_ht = qty * pu_ht
                line_ttc = qty * pu_ttc
                line_tva = line_ttc - line_ht

                if art_id not in aggregated_lines:
                    raise HTTPException(status_code=400, detail=f"L'article {article.nom} retourné n'existe pas dans les BLs sélectionnés.")

                aggregated_lines[art_id]["quantite_totale"] -= qty
                aggregated_lines[art_id]["montant_ht"] -= line_ht
                aggregated_lines[art_id]["montant_tva"] -= line_tva
                aggregated_lines[art_id]["montant_ttc"] -= line_ttc

                if aggregated_lines[art_id]["quantite_totale"] < 0:
                    raise HTTPException(status_code=400, detail=f"La quantité retournée de {article.nom} dépasse la quantité facturée.")

    tot_ht = Decimal('0.000')
    tot_tva = Decimal('0.000')
    tot_ttc = Decimal('0.000')
    lignes_facturation = []

    for art_id, item in aggregated_lines.items():
        qty_tot = item["quantite_totale"]
        if qty_tot <= 0:
            continue
            
        m_ht = item["montant_ht"]
        m_tva = item["montant_tva"]
        m_ttc = item["montant_ttc"]
        pu_moyen_ht = m_ht / qty_tot if qty_tot > 0 else Decimal('0.000')
        tot_ht += m_ht
        tot_tva += m_tva
        tot_ttc += m_ttc
        lf = LigneFacturation(
            id_article=art_id,
            quantite_totale=qty_tot,
            prix_unitaire_moyen_ht=pu_moyen_ht,
            taux_tva=item["taux_tva"],
            montant_ht=m_ht,
            montant_tva=m_tva,
            montant_ttc=m_ttc
        )
        lignes_facturation.append(lf)

    return tot_ht, tot_tva, tot_ttc, lignes_facturation
