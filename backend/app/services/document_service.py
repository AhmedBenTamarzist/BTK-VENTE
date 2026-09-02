from decimal import Decimal
from typing import List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models import Document, LigneDocument, Article, Client, Reglement, BonRetour
from app.schemas import DocumentCreate, DeliveryBatchCreate, LigneDocumentCreate
from app.services.numbering_service import generate_next_number
from app.services.article_service import adjust_stock

def compute_line_delivery_status(qty: Decimal, qty_livree: Decimal) -> str:
    if qty_livree <= 0:
        return "non_livre"
    elif qty_livree >= qty:
        return "livre"
    else:
        return "partiellement_livre"

def compute_document_delivery_status(lignes: List[LigneDocument]) -> str:
    if not lignes:
        return "non_livre"
    
    all_fully_delivered = True
    any_delivered = False

    for l in lignes:
        if l.quantite_livree > 0:
            any_delivered = True
        if l.quantite_livree < l.quantite:
            all_fully_delivered = False

    if all_fully_delivered:
        return "livre"
    elif any_delivered:
        return "partiellement_livre"
    else:
        return "non_livre"

def _resolve_client(db: Session, id_client: Optional[int]) -> Client:
    """Resolve client from id, or fall back to the reserved 'Client Passage' record."""
    if id_client is not None:
        client = db.query(Client).filter(Client.id_client == id_client, Client.actif == True).first()
        if not client:
            raise HTTPException(status_code=404, detail="Client introuvable ou inactif")
        return client
    # Fallback: chercher le client passage
    passage = db.query(Client).filter(Client.nom == "Client Passage").first()
    if not passage:
        raise HTTPException(status_code=500, detail="Client Passage non trouvé en base. Veuillez relancer l'initialisation.")
    return passage


def create_sales_document(
    db: Session,
    doc_in: DocumentCreate,
    user_id: Optional[int] = None
) -> Document:
    # 1. Check client (or use Client Passage if none provided)
    client = _resolve_client(db, doc_in.id_client)

    # 2. Generate sequential document number
    doc_type = doc_in.type_document
    if doc_type not in ("devis", "bon_livraison", "facture_rapide"):
        raise HTTPException(status_code=400, detail="Type de document invalide")

    num_doc = generate_next_number(db, doc_type)

    # 3. Process lines and calculate totals & delivery quantities
    montant_ttc_sans_remise = Decimal('0.000')
    montant_remise = Decimal('0.000')
    montant_ttc_final = Decimal('0.000')

    document_lignes = []

    for index, l in enumerate(doc_in.lignes):
        article = db.query(Article).filter(Article.id_article == l.id_article, Article.actif == True).first()
        if not article:
            raise HTTPException(status_code=404, detail=f"Article ID {l.id_article} introuvable")

        # Verify discount limit
        if l.remise_pourcentage > article.remise_max_pourcentage:
            raise HTTPException(
                status_code=400,
                detail=f"La remise de {l.remise_pourcentage}% dépasse le maximum autorisé ({article.remise_max_pourcentage}%) pour l'article {article.nom}"
            )

        pu_ttc = Decimal(str(l.prix_unitaire_ttc))
        remise_pct = Decimal(str(l.remise_pourcentage))
        qty = Decimal(str(l.quantite))

        if l.quantite_livree is not None:
            qty_livree = Decimal(str(l.quantite_livree))
        else:
            qty_livree = Decimal('0.000') if doc_type == "devis" else qty

        if qty_livree < 0 or qty_livree > qty:
            raise HTTPException(
                status_code=400,
                detail=f"La quantité livrée ({qty_livree}) doit être comprise entre 0 et la quantité commandée ({qty}) pour l'article {article.nom}"
            )

        qty_restante = qty - qty_livree
        line_delivery_statut = compute_line_delivery_status(qty, qty_livree)

        pu_apres_remise = pu_ttc * (Decimal('1.00') - (remise_pct / Decimal('100.00')))
        
        line_sans_remise = qty * pu_ttc
        line_final = qty * pu_apres_remise
        line_remise_val = line_sans_remise - line_final

        montant_ttc_sans_remise += line_sans_remise
        montant_remise += line_remise_val
        montant_ttc_final += line_final

        ligne_doc = LigneDocument(
            id_article=l.id_article,
            quantite=qty,
            quantite_livree=qty_livree,
            quantite_restante_a_livrer=qty_restante,
            statut_livraison=line_delivery_statut,
            prix_unitaire_ttc=pu_ttc,
            remise_pourcentage=remise_pct,
            prix_unitaire_apres_remise=pu_apres_remise,
            ordre_affichage=index + 1
        )
        document_lignes.append(ligne_doc)

        if doc_type in ("bon_livraison", "facture_rapide") and qty_livree > 0:
            adjust_stock(db, l.id_article, -qty_livree, allow_negative=True)

    # 4. Check credit ceiling if sale is on credit (BL or Facture Rapide)
    current_debt = abs(client.solde_compte) if client.solde_compte < 0 else Decimal('0.000')
    if doc_type in ("bon_livraison", "facture_rapide") and client.plafond_credit > 0:
        if (current_debt + montant_ttc_final) > client.plafond_credit:
            raise HTTPException(
                status_code=400,
                detail=f"Dépassement du plafond de crédit autorisé ({client.plafond_credit} TND). Dette actuelle: {current_debt} TND."
            )

    montant_paye_init = Decimal('0.000')
    doc_statut = "brouillon"
    if doc_type in ("bon_livraison", "facture_rapide"):
        doc_statut = "valide"
            
    doc_livraison_statut = compute_document_delivery_status(document_lignes)

    document = Document(
        type_document=doc_type,
        numero=num_doc,
        id_client=client.id_client,  # use resolved client (may be Client Passage)
        id_utilisateur=user_id,
        id_document_origine=doc_in.id_document_origine,
        montant_ttc_sans_remise=montant_ttc_sans_remise,
        montant_remise=montant_remise,
        montant_ttc_final=montant_ttc_final,
        montant_paye=Decimal('0.000'),
        montant_restant=montant_ttc_final,
        statut=doc_statut,
        statut_livraison=doc_livraison_statut,
        notes=doc_in.notes,
        lignes=document_lignes
    )

    db.add(document)
    db.flush()
    
    from app.services.payment_service import recalculate_client_payments
    recalculate_client_payments(db, client.id_client)
    
    return document

def update_sales_document(
    db: Session,
    document_id: int,
    doc_in: DocumentCreate,
    user_id: Optional[int] = None
) -> Document:
    doc = db.query(Document).filter(Document.id_document == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document introuvable")

    old_client_id = doc.id_client
    old_total_ttc = Decimal(str(doc.montant_ttc_final))
    old_type = doc.type_document

    # Resolve new client (or keep same client passage if none provided)
    new_client = _resolve_client(db, doc_in.id_client)

    # Clear old lines
    db.query(LigneDocument).filter(LigneDocument.id_document == document_id).delete()

    montant_ttc_sans_remise = Decimal('0.000')
    montant_remise = Decimal('0.000')
    montant_ttc_final = Decimal('0.000')

    document_lignes = []

    for index, l in enumerate(doc_in.lignes):
        article = db.query(Article).filter(Article.id_article == l.id_article, Article.actif == True).first()
        if not article:
            raise HTTPException(status_code=404, detail=f"Article ID {l.id_article} introuvable")

        pu_ttc = Decimal(str(l.prix_unitaire_ttc))
        remise_pct = Decimal(str(l.remise_pourcentage))
        qty = Decimal(str(l.quantite))

        qty_livree = Decimal(str(l.quantite_livree)) if l.quantite_livree is not None else (Decimal('0.000') if doc.type_document == "devis" else qty)
        qty_restante = qty - qty_livree
        line_delivery_statut = compute_line_delivery_status(qty, qty_livree)

        pu_apres_remise = pu_ttc * (Decimal('1.00') - (remise_pct / Decimal('100.00')))
        line_sans_remise = qty * pu_ttc
        line_final = qty * pu_apres_remise
        line_remise_val = line_sans_remise - line_final

        montant_ttc_sans_remise += line_sans_remise
        montant_remise += line_remise_val
        montant_ttc_final += line_final

        ligne_doc = LigneDocument(
            id_document=document_id,
            id_article=l.id_article,
            quantite=qty,
            quantite_livree=qty_livree,
            quantite_restante_a_livrer=qty_restante,
            statut_livraison=line_delivery_statut,
            prix_unitaire_ttc=pu_ttc,
            remise_pourcentage=remise_pct,
            prix_unitaire_apres_remise=pu_apres_remise,
            ordre_affichage=index + 1
        )
        document_lignes.append(ligne_doc)

    doc.id_client = new_client.id_client  # use resolved client (may be Client Passage)
    doc.montant_ttc_sans_remise = montant_ttc_sans_remise
    doc.montant_remise = montant_remise
    doc.montant_ttc_final = montant_ttc_final
    # Les statuts et montants payés/restants seront recalculés par recalculate_client_payments
    doc.statut_livraison = compute_document_delivery_status(document_lignes)
    if doc_in.notes:
        doc.notes = doc_in.notes

    doc.lignes = document_lignes
    db.flush()
    
    from app.services.payment_service import recalculate_client_payments
    recalculate_client_payments(db, new_client.id_client)
    if old_client_id != new_client.id_client:
        recalculate_client_payments(db, old_client_id)
    
    # ── PROPAGATION VERS FACTURATION SI NÉCESSAIRE ──
    if doc.facture_dans_facturation:
        from app.models import FacturationDocument
        from app.services.invoice_service import update_fiscal_invoice
        from app.schemas import FacturationUpdate
        
        link = db.query(FacturationDocument).filter(FacturationDocument.id_document == document_id).first()
        if link:
            fact_links = db.query(FacturationDocument).filter(FacturationDocument.id_facturation == link.id_facturation).all()
            fact_doc_ids = [l.id_document for l in fact_links]
            update_fiscal_invoice(db, link.id_facturation, FacturationUpdate(document_ids=fact_doc_ids))

    return doc

def delete_sales_document(db: Session, document_id: int) -> None:
    """Supprime un document (devis/BL/facture rapide) — uniquement s'il n'a
    aucun impact financier déjà enregistré ailleurs, pour ne jamais corrompre
    l'historique des paiements/retours/facturations."""
    doc = db.query(Document).filter(Document.id_document == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document introuvable")

    if doc.facture_dans_facturation:
        raise HTTPException(
            status_code=400,
            detail="Ce document est inclus dans une facturation groupée. Retirez-le de la facturation avant de le supprimer."
        )

    if db.query(Reglement).filter(Reglement.id_document == document_id).first():
        raise HTTPException(
            status_code=400,
            detail="Ce document a des règlements enregistrés. Impossible de le supprimer directement."
        )

    if db.query(BonRetour).filter(BonRetour.id_document == document_id).first():
        raise HTTPException(
            status_code=400,
            detail="Un bon de retour est lié à ce document. Impossible de le supprimer directement."
        )

    # Reverser le stock déduit à la livraison (BL / facture rapide)
    for line in doc.lignes:
        qty_livree = Decimal(str(line.quantite_livree or 0))
        if qty_livree > 0:
            adjust_stock(db, line.id_article, qty_livree, allow_negative=True)

    client_id = doc.id_client
    db.delete(doc)
    db.flush()

    from app.services.payment_service import recalculate_client_payments
    recalculate_client_payments(db, client_id)


def record_partial_delivery(
    db: Session,
    document_id: int,
    delivery_batch: DeliveryBatchCreate,
    user_id: Optional[int] = None
) -> Document:
    doc = db.query(Document).filter(Document.id_document == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document introuvable")

    if doc.statut == "annule":
        raise HTTPException(status_code=400, detail="Impossible d'effectuer une livraison sur un document annulé")

    lines_by_id = {l.id_ligne: l for l in doc.lignes}

    for item in delivery_batch.livraisons:
        if item.id_ligne not in lines_by_id:
            raise HTTPException(status_code=404, detail=f"Ligne de document ID {item.id_ligne} non trouvée dans ce document")

        line = lines_by_id[item.id_ligne]
        qty_delivered_now = Decimal(str(item.quantite_a_livrer))

        if qty_delivered_now <= 0:
            continue

        if qty_delivered_now > line.quantite_restante_a_livrer:
            raise HTTPException(
                status_code=400,
                detail=f"Quantité à livrer ({qty_delivered_now}) supérieure au reste à livrer ({line.quantite_restante_a_livrer}) pour la ligne ID {line.id_ligne}"
            )

        line.quantite_livree += qty_delivered_now
        line.quantite_restante_a_livrer -= qty_delivered_now
        line.statut_livraison = compute_line_delivery_status(line.quantite, line.quantite_livree)

        adjust_stock(db, line.id_article, -qty_delivered_now, allow_negative=True)

    doc.statut_livraison = compute_document_delivery_status(doc.lignes)
    if delivery_batch.notes:
        doc.notes = f"{doc.notes or ''}\nLivraison: {delivery_batch.notes}".strip()

    db.flush()
    return doc

def convert_devis_to_bl(db: Session, devis_id: int, user_id: Optional[int] = None) -> Document:
    devis = db.query(Document).filter(Document.id_document == devis_id, Document.type_document == "devis").first()
    if not devis:
        raise HTTPException(status_code=404, detail="Devis introuvable")
    
    if devis.statut == "annule":
        raise HTTPException(status_code=400, detail="Impossible de convertir un devis annulé")

    bl_lignes = [
        LigneDocumentCreate(
            id_article=l.id_article,
            quantite=l.quantite,
            quantite_livree=l.quantite,
            prix_unitaire_ttc=l.prix_unitaire_ttc,
            remise_pourcentage=l.remise_pourcentage
        ) for l in devis.lignes
    ]

    doc_in = DocumentCreate(
        type_document="bon_livraison",
        id_client=devis.id_client,
        id_document_origine=devis.id_document,
        notes=f"Créé à partir du devis N° {devis.numero}. {devis.notes or ''}".strip(),
        lignes=bl_lignes
    )

    bl = create_sales_document(db, doc_in, user_id=user_id)
    devis.statut = "valide"
    db.flush()
    return bl

def convert_devis_to_facture(db: Session, devis_id: int, user_id: Optional[int] = None) -> Document:
    devis = db.query(Document).filter(Document.id_document == devis_id, Document.type_document == "devis").first()
    if not devis:
        raise HTTPException(status_code=404, detail="Devis introuvable")

    if devis.statut == "annule":
        raise HTTPException(status_code=400, detail="Impossible de convertir un devis annulé")

    facture_lignes = [
        LigneDocumentCreate(
            id_article=l.id_article,
            quantite=l.quantite,
            quantite_livree=l.quantite,
            prix_unitaire_ttc=l.prix_unitaire_ttc,
            remise_pourcentage=l.remise_pourcentage
        ) for l in devis.lignes
    ]

    doc_in = DocumentCreate(
        type_document="facture_rapide",
        id_client=devis.id_client,
        id_document_origine=devis.id_document,
        notes=f"Créé à partir du devis N° {devis.numero}. {devis.notes or ''}".strip(),
        lignes=facture_lignes
    )

    facture = create_sales_document(db, doc_in, user_id=user_id)
    devis.statut = "valide"
    db.flush()
    return facture
