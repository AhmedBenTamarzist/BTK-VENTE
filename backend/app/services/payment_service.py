from decimal import Decimal
from typing import Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models import Reglement, ReglementFournisseur, Document, Facturation, FacturationDocument, Achat, Client, Fournisseur
from app.schemas import ReglementCreate, ReglementFournisseurCreate
from app.services.numbering_service import generate_next_number

def recalculate_client_payments(db: Session, client_id: int):
    """
    Recalcule entièrement la distribution des paiements d'un client.
    
    RÈGLES DE GESTION :
    - La DETTE du client = somme des BLs + tickets de caisse (les facturations fiscales sont juste des documents fiscaux)
    - Le PAYÉ = somme des règlements (espèces, chèques, virements...)
    - Le CRÉDIT RETOUR = somme de tous les Bons de Retour (qu'ils soient intégrés en facturation ou non)
    - SOLDE = Payé + Crédit_Retours - Dette_BLs
    """
    client = db.query(Client).filter(Client.id_client == client_id).first()
    if not client:
        return

    # 1. Charger tous les règlements (les chèques/traites rejetés ne comptent pas comme payés)
    all_regs = db.query(Reglement).filter(Reglement.id_client == client_id).all()
    global_paid = sum((Decimal(str(r.montant)) for r in all_regs if not r.id_document and not r.id_facturation and r.statut_cheque != "rejete"), Decimal('0.000'))
    amount_to_distribute = global_paid

    # 2. Charger tous les BLs / tickets de caisse
    all_docs = db.query(Document).filter(
        Document.id_client == client_id,
        Document.type_document.in_(['bon_livraison', 'facture_rapide'])
    ).all()

    # Appliquer les paiements ciblés sur les BLs
    for doc in all_docs:
        restant_initial = max(Decimal('0.000'), Decimal(str(doc.montant_ttc_final)))
        targeted_paid = sum((Decimal(str(r.montant)) for r in all_regs if r.id_document == doc.id_document and r.statut_cheque != "rejete"), Decimal('0.000'))
        doc.montant_paye = min(restant_initial, targeted_paid)
        doc.montant_restant = restant_initial - doc.montant_paye
        doc.statut = "valide" if doc.montant_restant > 0 else "paye"
        surplus = targeted_paid - doc.montant_paye
        if surplus > 0:
            amount_to_distribute += surplus

    # 3. Charger uniquement les Bons de Retour en MODE CRÉDIT
    # Les retours en espèces sont remboursés directement au client, ils ne réduisent pas la dette
    from app.models import BonRetour
    all_retours_credit = db.query(BonRetour).filter(
        BonRetour.id_client == client_id,
        BonRetour.statut == "valide",
        BonRetour.mode_remboursement == "credit"
    ).all()
    total_credit_retours = sum((Decimal(str(r.montant_ttc)) for r in all_retours_credit), Decimal('0.000'))

    # 4. Calculer le solde
    total_debt = sum((Decimal(str(d.montant_ttc_final)) for d in all_docs), Decimal('0.000'))
    total_paid_historique = sum((Decimal(str(r.montant)) for r in all_regs if r.statut_cheque != "rejete"), Decimal('0.000'))
    client.solde_compte = total_paid_historique + total_credit_retours - total_debt

    # 5. Distribuer globalement (règlements non ciblés + crédit retours) chronologiquement sur les BLs
    # Le crédit retour agit comme un paiement virtuel : il réduit le montant_restant des BLs
    amount_to_distribute += total_credit_retours

    sorted_docs = sorted(all_docs, key=lambda x: (x.date_document, x.id_document))
    for doc in sorted_docs:
        if amount_to_distribute <= 0:
            break
        restant_doc = Decimal(str(doc.montant_restant))
        if restant_doc <= 0:
            continue
        pay_for_this = min(amount_to_distribute, restant_doc)
        doc.montant_paye = Decimal(str(doc.montant_paye)) + pay_for_this
        doc.montant_restant = restant_doc - pay_for_this
        doc.statut = "paye" if doc.montant_restant <= 0 else "partiellement_paye"
        amount_to_distribute -= pay_for_this

    # 6. Mettre à jour les facturations fiscales (affichage uniquement, basé sur les BLs liés)
    all_facts = db.query(Facturation).filter(Facturation.id_client == client_id).all()
    for fact in all_facts:
        bl_links = db.query(FacturationDocument).filter(FacturationDocument.id_facturation == fact.id_facturation).all()
        bl_ids = [l.id_document for l in bl_links]
        fact_bls = [d for d in all_docs if d.id_document in bl_ids]
        total_paye_bls = sum(Decimal(str(d.montant_paye)) for d in fact_bls)
        total_ttc_fact = Decimal(str(fact.montant_ttc))
        fact.montant_paye = min(total_ttc_fact, total_paye_bls)
        fact.montant_restant = max(Decimal('0.000'), total_ttc_fact - fact.montant_paye)
        if fact.montant_restant <= 0:
            fact.statut = "payee"
        elif fact.montant_paye > 0:
            fact.statut = "partiellement_payee"
        else:
            fact.statut = "validee"

    db.flush()

def add_client_payment(
    db: Session,
    reglement_in: ReglementCreate,
    user_id: Optional[int] = None
) -> Reglement:
    client = db.query(Client).filter(Client.id_client == reglement_in.id_client).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client introuvable")

    num_reg = generate_next_number(db, "reglement")
    montant_paye = Decimal(str(reglement_in.montant))
    statut_chq = "en_attente" if reglement_in.mode_paiement in ("cheque", "traite") else None

    reglement = Reglement(
        numero=num_reg,
        id_client=reglement_in.id_client,
        id_document=reglement_in.id_document,
        id_facturation=reglement_in.id_facturation,
        montant=montant_paye,
        mode_paiement=reglement_in.mode_paiement,
        reference_paiement=reglement_in.reference_paiement,
        date_echeance=reglement_in.date_echeance,
        statut_cheque=statut_chq,
        id_utilisateur=user_id,
        notes=reglement_in.notes
    )

    db.add(reglement)
    db.flush()
    
    # Recalculer l'ensemble des paiements et soldes du client
    recalculate_client_payments(db, client.id_client)
    
    return reglement

def recalculate_achat_payment(db: Session, achat_id: int):
    """
    Recalcule montant_paye/montant_restant/statut_paiement d'un achat à partir de
    ses règlements liés (les chèques/traites rejetés ne comptent pas comme payés).
    """
    achat = db.query(Achat).filter(Achat.id_achat == achat_id).first()
    if not achat:
        return

    regs = db.query(ReglementFournisseur).filter(ReglementFournisseur.id_achat == achat_id).all()
    total_paye = sum((Decimal(str(r.montant)) for r in regs if r.statut_cheque != "rejete"), Decimal('0.000'))

    achat.montant_paye = total_paye
    achat.montant_restant = max(Decimal('0.000'), Decimal(str(achat.montant_ttc)) - total_paye)
    if achat.montant_restant <= 0 and total_paye > 0:
        achat.statut_paiement = "paye"
    elif total_paye > 0:
        achat.statut_paiement = "partiellement_paye"
    else:
        achat.statut_paiement = "non_paye"

    db.flush()

def add_supplier_payment(
    db: Session,
    reglement_in: ReglementFournisseurCreate,
    user_id: Optional[int] = None
) -> ReglementFournisseur:
    fournisseur = db.query(Fournisseur).filter(Fournisseur.id_fournisseur == reglement_in.id_fournisseur).first()
    if not fournisseur:
        raise HTTPException(status_code=404, detail="Fournisseur introuvable")

    num_reg = generate_next_number(db, "reglement_fournisseur")
    montant_paye = Decimal(str(reglement_in.montant))

    if reglement_in.id_achat:
        achat = db.query(Achat).filter(Achat.id_achat == reglement_in.id_achat).first()
        if not achat:
            raise HTTPException(status_code=404, detail="Achat introuvable")

        achat.montant_paye = Decimal(str(achat.montant_paye)) + montant_paye
        achat.montant_restant = Decimal(str(achat.montant_ttc)) - Decimal(str(achat.montant_paye))

        if achat.montant_restant <= 0:
            achat.montant_restant = Decimal('0.000')
            achat.statut_paiement = "paye"
        else:
            achat.statut_paiement = "partiellement_paye"

    statut_chq = "en_attente" if reglement_in.mode_paiement in ("cheque", "traite") else None

    reg_fourn = ReglementFournisseur(
        numero=num_reg,
        id_fournisseur=reglement_in.id_fournisseur,
        id_achat=reglement_in.id_achat,
        montant=montant_paye,
        mode_paiement=reglement_in.mode_paiement,
        reference_paiement=reglement_in.reference_paiement,
        date_echeance=reglement_in.date_echeance,
        statut_cheque=statut_chq,
        id_utilisateur=user_id,
        notes=reglement_in.notes
    )

    db.add(reg_fourn)
    db.flush()
    return reg_fourn
