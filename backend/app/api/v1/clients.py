from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Client, Utilisateur
from app.schemas import ClientCreate, ClientUpdate, ClientOut
from app.api.deps import get_current_user, require_roles
from app.services.log_service import log_system_action

router = APIRouter()

@router.get("/", response_model=List[ClientOut])
def list_clients(
    search: Optional[str] = Query(None, description="Recherche par nom, prénom ou téléphone"),
    actif_only: bool = True,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user)
):
    query = db.query(Client)
    if actif_only:
        query = query.filter(Client.actif == True)
    if search:
        s = f"%{search}%"
        query = query.filter(
            (Client.nom.ilike(s)) | (Client.prenom.ilike(s)) | (Client.telephone.ilike(s))
        )
    return query.order_by(Client.nom.asc()).all()

@router.get("/passage", response_model=ClientOut)
def get_passage_client(
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user)
):
    """Retourne le client 'Passage' réservé pour les ventes sans client identifié."""
    passage = db.query(Client).filter(Client.nom == "Client Passage").first()
    if not passage:
        raise HTTPException(status_code=404, detail="Client Passage non trouvé. Relancez l'initialisation de la base.")
    return passage

@router.get("/{client_id}", response_model=ClientOut)
def get_client(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user)
):
    client = db.query(Client).filter(Client.id_client == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client non trouvé")
    return client

@router.post("/", response_model=ClientOut, status_code=status.HTTP_201_CREATED)
def create_client(
    client_in: ClientCreate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_roles(["admin", "vendeur", "caissier"]))
):
    client = Client(
        type_client=client_in.type_client,
        nom=client_in.nom,
        prenom=client_in.prenom,
        matricule_fiscal=client_in.matricule_fiscal,
        telephone=client_in.telephone,
        email=client_in.email,
        adresse=client_in.adresse,
        plafond_credit=client_in.plafond_credit,
        delai_relance_jours=client_in.delai_relance_jours
    )
    db.add(client)
    db.commit()
    db.refresh(client)

    log_system_action(
        db, type_action="creation", table_concernee="clients", id_enregistrement=client.id_client,
        description=f"Création client {client.nom}", id_utilisateur=current_user.id_utilisateur
    )
    db.commit()
    return client

@router.put("/{client_id}", response_model=ClientOut)
def update_client(
    client_id: int,
    client_in: ClientUpdate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_roles(["admin", "vendeur", "caissier"]))
):
    client = db.query(Client).filter(Client.id_client == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client non trouvé")

    for field, val in client_in.dict(exclude_unset=True).items():
        setattr(client, field, val)

    db.commit()
    db.refresh(client)

    log_system_action(
        db, type_action="modification", table_concernee="clients", id_enregistrement=client.id_client,
        description=f"Modification client {client.nom}", id_utilisateur=current_user.id_utilisateur
    )
    db.commit()
    return client

@router.get("/{id_client}/articles-achetes")
def get_articles_achetes_client(
    id_client: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user)
):
    from app.models import Document, LigneDocument
    
    lignes = db.query(LigneDocument.id_article).join(Document).filter(
        Document.id_client == id_client,
        Document.type_document.in_(['bon_livraison', 'facture_rapide'])
    ).distinct().all()
    
    return [l[0] for l in lignes]

@router.get("/{id_client}/historique-article/{id_article}")
def get_historique_article_client(
    id_client: int,
    id_article: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user)
):
    from decimal import Decimal
    from app.models import Document, LigneDocument, BonRetour, LigneRetour
    from sqlalchemy import func

    ligne = db.query(LigneDocument).join(Document).filter(
        Document.id_client == id_client,
        Document.type_document.in_(['bon_livraison', 'facture_rapide']),
        LigneDocument.id_article == id_article
    ).order_by(Document.date_document.desc()).first()

    if not ligne:
        return {"trouve": False, "message": "Cet article n'a jamais été acheté par ce client"}

    total_qty = db.query(func.sum(LigneDocument.quantite)).join(Document).filter(
        Document.id_client == id_client,
        Document.type_document.in_(['bon_livraison', 'facture_rapide']),
        LigneDocument.id_article == id_article
    ).scalar() or 0

    # Quantité déjà retournée pour cet article par ce client (tous documents confondus)
    total_retourne = db.query(func.sum(LigneRetour.quantite)).join(BonRetour).filter(
        BonRetour.id_client == id_client,
        BonRetour.statut == "valide",
        LigneRetour.id_article == id_article
    ).scalar() or 0

    quantite_max = max(Decimal('0.000'), Decimal(str(total_qty)) - Decimal(str(total_retourne)))

    # Détection des prix multiples: le même article a pu être vendu à des prix différents
    # (promo, ancien tarif, remise ponctuelle...). On liste les prix distincts pour que le
    # caissier puisse corriger le prix de retour en un clic plutôt que de deviner.
    prix_distincts = db.query(
        LigneDocument.prix_unitaire_apres_remise,
        func.sum(LigneDocument.quantite).label('qte'),
        func.max(Document.date_document).label('derniere_date')
    ).join(Document).filter(
        Document.id_client == id_client,
        Document.type_document.in_(['bon_livraison', 'facture_rapide']),
        LigneDocument.id_article == id_article
    ).group_by(LigneDocument.prix_unitaire_apres_remise).order_by(func.max(Document.date_document).desc()).all()

    prix_historiques = [
        {
            "prix_unitaire_apres_remise": p.prix_unitaire_apres_remise,
            "quantite": p.qte,
            "derniere_date": p.derniere_date
        }
        for p in prix_distincts
    ]

    return {
        "trouve": True,
        "id_article": id_article,
        "prix_unitaire_ttc": ligne.prix_unitaire_ttc,
        "remise_pourcentage": ligne.remise_pourcentage,
        "prix_unitaire_apres_remise": ligne.prix_unitaire_apres_remise,
        "date_achat": ligne.document.date_document,
        "quantite_max": quantite_max,
        "quantite_totale_achetee": total_qty,
        "quantite_deja_retournee": total_retourne,
        "prix_historiques": prix_historiques,
        "prix_multiples": len(prix_historiques) > 1
    }
