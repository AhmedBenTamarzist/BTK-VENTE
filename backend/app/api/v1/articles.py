from typing import List, Optional
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import get_db
from app.models import Article, HistoriquePrixVente, Utilisateur
from app.schemas import ArticleCreate, ArticleUpdate, ArticleOut, PriceHistoryOut
from app.api.deps import get_current_user, require_roles
from app.services.article_service import record_price_history_if_changed, adjust_stock
from app.services.log_service import log_system_action
from app.services import debot_service

router = APIRouter()

@router.get("/", response_model=List[ArticleOut])
def list_articles(
    search: Optional[str] = Query(None, description="Recherche par nom ou référence"),
    id_categorie: Optional[int] = Query(None),
    low_stock_only: bool = False,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user)
):
    query = db.query(Article).filter(Article.actif == True)
    if id_categorie:
        query = query.filter(Article.id_categorie == id_categorie)
    if search:
        words = [w.strip() for w in search.split() if w.strip()]
        for word in words:
            w_pattern = f"%{word}%"
            query = query.filter(
                (Article.nom.ilike(w_pattern)) | 
                (Article.reference.ilike(w_pattern)) | 
                (Article.description.ilike(w_pattern))
            )
    if low_stock_only:
        query = query.filter(Article.quantite_stock <= Article.seuil_alerte_stock)

    return query.order_by(Article.nom.asc()).all()

@router.get("/{article_id}", response_model=ArticleOut)
def get_article(
    article_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user)
):
    art = db.query(Article).filter(Article.id_article == article_id).first()
    if not art:
        raise HTTPException(status_code=404, detail="Article non trouvé")
    return art

@router.post("/", response_model=ArticleOut, status_code=status.HTTP_201_CREATED)
def create_article(
    article_in: ArticleCreate,
    db: Session = Depends(get_db),
    # vendeur/caissier inclus : necessaire pour la "Creation rapide" d'article
    # depuis l'ecran de vente quand un produit n'existe pas encore au catalogue
    current_user: Utilisateur = Depends(require_roles(["admin", "gestionnaire_stock", "vendeur", "caissier"]))
):
    if article_in.reference:
        existing = db.query(Article).filter(Article.reference == article_in.reference).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Un article avec la référence '{article_in.reference}' existe déjà")

    art = Article(
        reference=article_in.reference,
        nom=article_in.nom,
        description=article_in.description,
        id_categorie=article_in.id_categorie,
        prix_vente_ttc=article_in.prix_vente_ttc,
        taux_tva_vente=article_in.taux_tva_vente,
        remise_max_pourcentage=article_in.remise_max_pourcentage,
        unite=article_in.unite,
        quantite_stock=article_in.quantite_stock,
        seuil_alerte_stock=article_in.seuil_alerte_stock,
        id_externe_depot=article_in.id_externe_depot
    )
    db.add(art)
    db.commit()
    db.refresh(art)

    # Initial price history record
    hist = HistoriquePrixVente(
        id_article=art.id_article,
        prix_ttc=art.prix_vente_ttc,
        taux_tva=art.taux_tva_vente,
        id_utilisateur=current_user.id_utilisateur
    )
    db.add(hist)

    log_system_action(
        db, type_action="creation", table_concernee="articles", id_enregistrement=art.id_article,
        description=f"Création article {art.nom} (Réf: {art.reference or 'N/A'})",
        id_utilisateur=current_user.id_utilisateur
    )
    db.commit()

    # Best-effort : ne bloque jamais la création locale si Debot est injoignable
    debot_service.push_new_article(db, art)

    return art

@router.put("/{article_id}", response_model=ArticleOut)
def update_article(
    article_id: int,
    article_in: ArticleUpdate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_roles(["admin", "gestionnaire_stock"]))
):
    art = db.query(Article).filter(Article.id_article == article_id).first()
    if not art:
        raise HTTPException(status_code=404, detail="Article non trouvé")

    # If sale price changes, auto record history
    if article_in.prix_vente_ttc is not None or article_in.taux_tva_vente is not None:
        new_prix = article_in.prix_vente_ttc if article_in.prix_vente_ttc is not None else art.prix_vente_ttc
        new_tva = article_in.taux_tva_vente if article_in.taux_tva_vente is not None else art.taux_tva_vente
        record_price_history_if_changed(db, art, new_prix, new_tva, user_id=current_user.id_utilisateur)

    for field, val in article_in.dict(exclude={"prix_vente_ttc", "taux_tva_vente"}, exclude_unset=True).items():
        setattr(art, field, val)

    db.commit()
    db.refresh(art)

    log_system_action(
        db, type_action="modification", table_concernee="articles", id_enregistrement=art.id_article,
        description=f"Modification article {art.nom}", id_utilisateur=current_user.id_utilisateur
    )
    db.commit()

    # Best-effort : ne bloque jamais la modification locale si Debot est injoignable
    debot_service.push_updated_article(db, art)

    return art

@router.post("/{article_id}/adjust-stock", response_model=ArticleOut)
def manual_stock_adjustment(
    article_id: int,
    delta: Decimal,
    reason: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_roles(["admin", "gestionnaire_stock"]))
):
    art = adjust_stock(db, article_id, delta, allow_negative=False)
    log_system_action(
        db, type_action="ajustement_stock", table_concernee="articles", id_enregistrement=art.id_article,
        description=f"Ajustement manuel stock article {art.nom}: delta {delta}. Raison: {reason or 'N/A'}",
        id_utilisateur=current_user.id_utilisateur
    )
    db.commit()
    db.refresh(art)
    return art

@router.get("/{article_id}/price-history", response_model=List[PriceHistoryOut])
def get_price_history(
    article_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user)
):
    return db.query(HistoriquePrixVente).filter(HistoriquePrixVente.id_article == article_id).order_by(HistoriquePrixVente.date_effet.desc()).all()

@router.get("/{article_id}/best-supplier-price")
def get_best_supplier_price(
    article_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user)
):
    from app.models import LigneAchat, Achat, Fournisseur
    best = db.query(LigneAchat, Achat, Fournisseur)\
        .join(Achat, Achat.id_achat == LigneAchat.id_achat)\
        .join(Fournisseur, Fournisseur.id_fournisseur == Achat.id_fournisseur)\
        .filter(LigneAchat.id_article == article_id)\
        .order_by(LigneAchat.prix_achat_ht.asc())\
        .first()

    if not best:
        return {"detail": "Aucune offre fournisseur enregistrée pour cet article"}

    ligne, achat, fourn = best
    
    return {
        "id_article": article_id,
        "id_fournisseur": fourn.id_fournisseur,
        "nom_fournisseur": fourn.nom,
        "meilleur_prix_ht": ligne.prix_achat_ht,
        "derniere_date_achat": achat.date_achat
    }
