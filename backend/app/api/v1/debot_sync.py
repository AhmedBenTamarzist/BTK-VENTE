from typing import List, Literal, Optional
from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Article, Utilisateur
from app.api.deps import require_roles
from app.services import debot_service
from app.services.log_service import log_system_action

router = APIRouter()

# Champs partagés comparés entre les deux systèmes : (clé VenteApp, clé Debot, libellé affiché)
COMPARED_FIELDS = [
    ("nom", "nom", "Nom"),
    ("description", "description", "Description"),
    ("unite", "unite", "Unité"),
    ("prix_vente_ttc", "prix_vente_ttc", "Prix de vente TTC"),
    ("taux_tva_vente", "tva_vente", "TVA (%)"),
    ("remise_max_pourcentage", "remise_max_vente", "Remise max (%)"),
]


def _num(v) -> Optional[float]:
    if v is None or v == "":
        return None
    try:
        return round(float(v), 3)
    except (TypeError, ValueError):
        return None


def _norm(key: str, v):
    if v is None:
        return "" if key not in ("prix_vente_ttc", "taux_tva_vente", "remise_max_pourcentage") else 0.0
    if key in ("prix_vente_ttc", "taux_tva_vente", "remise_max_pourcentage"):
        return _num(v)
    return str(v).strip()


class FieldDiff(BaseModel):
    champ: str
    libelle: str
    valeur_venteapp: Optional[str]
    valeur_debot: Optional[str]


class CompareItem(BaseModel):
    reference: str
    id_article_venteapp: Optional[int] = None
    id_article_debot: Optional[int] = None
    statut: Literal["identique", "different", "venteapp_seulement", "debot_seulement"]
    differences: List[FieldDiff] = []


class CompareResult(BaseModel):
    items: List[CompareItem]
    total_venteapp: int
    total_debot: int
    total_differences: int


@router.get("/compare", response_model=CompareResult)
def compare_with_debot(
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_roles(["admin", "gestionnaire_stock"]))
):
    if not debot_service.is_configured():
        raise HTTPException(status_code=400, detail="DEBOT_API_KEY non configurée (backend/.env).")

    try:
        debot_articles = debot_service.get_all_articles()
    except debot_service.DebotSyncError as e:
        raise HTTPException(status_code=502, detail=str(e))

    venteapp_articles = db.query(Article).all()

    debot_by_ref = {(a.get("code_article") or "").strip(): a for a in debot_articles if a.get("code_article")}
    venteapp_by_ref = {(a.reference or "").strip(): a for a in venteapp_articles if a.reference}

    all_refs = set(debot_by_ref.keys()) | set(venteapp_by_ref.keys())
    items: List[CompareItem] = []

    for ref in sorted(all_refs):
        v_art = venteapp_by_ref.get(ref)
        d_art = debot_by_ref.get(ref)

        if v_art and not d_art:
            items.append(CompareItem(
                reference=ref, id_article_venteapp=v_art.id_article,
                statut="venteapp_seulement"
            ))
            continue
        if d_art and not v_art:
            items.append(CompareItem(
                reference=ref, id_article_debot=d_art.get("id_article"),
                statut="debot_seulement"
            ))
            continue

        diffs = []
        for va_key, debot_key, label in COMPARED_FIELDS:
            v_val = getattr(v_art, va_key, None)
            d_val = d_art.get(debot_key)
            if _norm(va_key, v_val) != _norm(va_key, d_val):
                diffs.append(FieldDiff(
                    champ=va_key, libelle=label,
                    valeur_venteapp=str(v_val) if v_val is not None else "—",
                    valeur_debot=str(d_val) if d_val is not None else "—",
                ))

        items.append(CompareItem(
            reference=ref, id_article_venteapp=v_art.id_article, id_article_debot=d_art.get("id_article"),
            statut="different" if diffs else "identique",
            differences=diffs,
        ))

    return CompareResult(
        items=items,
        total_venteapp=len(venteapp_articles),
        total_debot=len(debot_articles),
        total_differences=sum(1 for i in items if i.statut != "identique"),
    )


class Resolution(BaseModel):
    reference: str
    action: Literal["ignore", "use_debot", "use_venteapp", "create_in_venteapp", "create_in_debot"]


class ResolveRequest(BaseModel):
    resolutions: List[Resolution]


class ResolutionResult(BaseModel):
    reference: str
    action: str
    success: bool
    message: str


class ResolveResponse(BaseModel):
    results: List[ResolutionResult]


@router.post("/resolve", response_model=ResolveResponse)
def resolve_differences(
    body: ResolveRequest,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_roles(["admin", "gestionnaire_stock"]))
):
    if not debot_service.is_configured():
        raise HTTPException(status_code=400, detail="DEBOT_API_KEY non configurée (backend/.env).")

    results: List[ResolutionResult] = []

    for res in body.resolutions:
        ref = res.reference.strip()
        try:
            if res.action == "ignore":
                results.append(ResolutionResult(reference=ref, action=res.action, success=True, message="Ignoré."))
                continue

            v_art = db.query(Article).filter(Article.reference == ref).first()

            if res.action == "use_debot":
                debot_articles = debot_service.get_all_articles()
                d_art = next((a for a in debot_articles if (a.get("code_article") or "").strip() == ref), None)
                if not d_art:
                    raise ValueError("Article introuvable côté Debot.")
                if not v_art:
                    raise ValueError("Article introuvable côté VenteApp.")
                v_art.nom = d_art.get("nom") or v_art.nom
                v_art.description = d_art.get("description") or None
                v_art.unite = d_art.get("unite") or v_art.unite
                if _num(d_art.get("prix_vente_ttc")) is not None:
                    v_art.prix_vente_ttc = Decimal(str(_num(d_art.get("prix_vente_ttc"))))
                if _num(d_art.get("tva_vente")) is not None:
                    v_art.taux_tva_vente = Decimal(str(_num(d_art.get("tva_vente"))))
                if _num(d_art.get("remise_max_vente")) is not None:
                    v_art.remise_max_pourcentage = Decimal(str(_num(d_art.get("remise_max_vente"))))
                if d_art.get("id_article"):
                    v_art.id_externe_depot = str(d_art["id_article"])
                db.commit()
                results.append(ResolutionResult(reference=ref, action=res.action, success=True, message="VenteApp mis à jour depuis Debot."))

            elif res.action == "use_venteapp":
                if not v_art:
                    raise ValueError("Article introuvable côté VenteApp.")
                err = debot_service.push_updated_article(db, v_art)
                if err:
                    raise ValueError(err)
                results.append(ResolutionResult(reference=ref, action=res.action, success=True, message="Debot mis à jour depuis VenteApp."))

            elif res.action == "create_in_venteapp":
                debot_articles = debot_service.get_all_articles()
                d_art = next((a for a in debot_articles if (a.get("code_article") or "").strip() == ref), None)
                if not d_art:
                    raise ValueError("Article introuvable côté Debot.")
                if v_art:
                    raise ValueError("Un article avec cette référence existe déjà côté VenteApp.")
                new_art = Article(
                    reference=ref,
                    nom=d_art.get("nom") or ref,
                    description=d_art.get("description") or None,
                    unite=d_art.get("unite") or "piece",
                    prix_vente_ttc=Decimal(str(_num(d_art.get("prix_vente_ttc")) or 0)),
                    taux_tva_vente=Decimal(str(_num(d_art.get("tva_vente")) or 19)),
                    remise_max_pourcentage=Decimal(str(_num(d_art.get("remise_max_vente")) or 0)),
                    id_externe_depot=str(d_art["id_article"]) if d_art.get("id_article") else None,
                )
                db.add(new_art)
                db.commit()
                results.append(ResolutionResult(reference=ref, action=res.action, success=True, message="Article créé dans VenteApp."))

            elif res.action == "create_in_debot":
                if not v_art:
                    raise ValueError("Article introuvable côté VenteApp.")
                err = debot_service.push_new_article(db, v_art)
                if err:
                    raise ValueError(err)
                results.append(ResolutionResult(reference=ref, action=res.action, success=True, message="Article créé dans Debot."))

        except (ValueError, InvalidOperation, debot_service.DebotSyncError) as e:
            db.rollback()
            results.append(ResolutionResult(reference=ref, action=res.action, success=False, message=str(e)))

    log_system_action(
        db, type_action="synchronisation_debot", table_concernee="articles",
        description=f"Synchronisation Debot : {len(body.resolutions)} résolution(s) appliquée(s)",
        id_utilisateur=current_user.id_utilisateur
    )
    db.commit()

    return ResolveResponse(results=results)
