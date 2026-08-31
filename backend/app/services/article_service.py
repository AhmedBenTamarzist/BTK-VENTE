from decimal import Decimal
from typing import Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models import Article, HistoriquePrixVente

def record_price_history_if_changed(
    db: Session,
    article: Article,
    new_prix_ttc: Decimal,
    new_taux_tva: Decimal,
    user_id: Optional[int] = None
):
    if article.prix_vente_ttc != new_prix_ttc or article.taux_tva_vente != new_taux_tva:
        hist = HistoriquePrixVente(
            id_article=article.id_article,
            prix_ttc=new_prix_ttc,
            taux_tva=new_taux_tva,
            id_utilisateur=user_id
        )
        db.add(hist)
        article.prix_vente_ttc = new_prix_ttc
        article.taux_tva_vente = new_taux_tva

def adjust_stock(
    db: Session,
    article_id: int,
    quantity_delta: Decimal,
    allow_negative: bool = True
) -> Article:
    article = db.query(Article).filter(Article.id_article == article_id).with_for_update().first()
    if not article:
        raise HTTPException(status_code=404, detail=f"Article ID {article_id} introuvable")
    
    new_stock = Decimal(str(article.quantite_stock)) + Decimal(str(quantity_delta))
    if new_stock < 0 and not allow_negative:
        raise HTTPException(
            status_code=400,
            detail=f"Stock insuffisant pour l'article '{article.nom}' (Réf: {article.reference or 'N/A'}). Stock disponible: {article.quantite_stock}"
        )
    
    article.quantite_stock = new_stock
    return article
