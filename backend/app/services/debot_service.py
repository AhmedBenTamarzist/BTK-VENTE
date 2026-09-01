"""
Client pour l'API REST de Debot (application séparée de gestion de dépôt/stock,
https://gdstock.ddns.net). Sert à garder le catalogue d'articles aligné entre
les deux systèmes : reference (VenteApp) == code_article (Debot).

Toutes les fonctions sont best-effort : une panne de Debot (indisponible,
timeout) ne doit jamais empêcher une opération VenteApp de réussir — les
appelants doivent capturer DebotSyncError et logguer/ignorer plutôt que de
faire échouer la requête en cours.
"""
import logging
from typing import Optional

import requests

from app.config import settings

logger = logging.getLogger(__name__)

TIMEOUT = 8  # secondes — Debot est hébergé ailleurs (ddns), ne jamais bloquer longtemps


class DebotSyncError(Exception):
    pass


def _headers_params():
    if not settings.DEBOT_API_KEY:
        raise DebotSyncError("DEBOT_API_KEY non configurée (backend/.env).")
    return {"api_key": settings.DEBOT_API_KEY}


def is_configured() -> bool:
    return bool(settings.DEBOT_API_KEY)


def get_all_articles(include_inactive: bool = True) -> list[dict]:
    """Récupère tous les articles Debot (par défaut y compris inactifs, pour
    un rapprochement complet)."""
    try:
        params = _headers_params()
        params["include_inactive"] = "true" if include_inactive else "false"
        r = requests.get(f"{settings.DEBOT_API_URL}/articles", params=params, timeout=TIMEOUT)
        r.raise_for_status()
        data = r.json()
        if not data.get("success"):
            raise DebotSyncError(data.get("error", "Réponse Debot invalide"))
        return data.get("data", [])
    except requests.RequestException as e:
        raise DebotSyncError(f"Impossible de joindre Debot : {e}")


def create_article(payload: dict) -> dict:
    """Crée un article côté Debot. payload attend au minimum code_article + nom.
    Nécessite la route POST /api/articles ajoutée côté Debot (api_server.py)."""
    try:
        params = _headers_params()
        r = requests.post(f"{settings.DEBOT_API_URL}/articles", params=params, json=payload, timeout=TIMEOUT)
        if r.status_code == 409:
            raise DebotSyncError("code_article déjà existant côté Debot")
        r.raise_for_status()
        data = r.json()
        if not data.get("success"):
            raise DebotSyncError(data.get("error", "Échec de création côté Debot"))
        return data.get("data", {})
    except requests.RequestException as e:
        raise DebotSyncError(f"Impossible de joindre Debot : {e}")


def update_article(debot_id: int, payload: dict) -> dict:
    """Met à jour un article Debot existant (champs partagés : nom, description,
    reference, unite, prix_vente_ht/ttc, tva_vente, remise_max_vente).
    Nécessite la route PUT /api/articles/<id>/sync ajoutée côté Debot."""
    try:
        params = _headers_params()
        r = requests.put(f"{settings.DEBOT_API_URL}/articles/{debot_id}/sync", params=params, json=payload, timeout=TIMEOUT)
        r.raise_for_status()
        data = r.json()
        if not data.get("success"):
            raise DebotSyncError(data.get("error", "Échec de mise à jour côté Debot"))
        return data.get("data", {})
    except requests.RequestException as e:
        raise DebotSyncError(f"Impossible de joindre Debot : {e}")


def venteapp_article_to_debot_payload(art) -> dict:
    """Construit le payload Debot à partir d'un Article VenteApp (modèle SQLAlchemy)."""
    return {
        "code_article": art.reference,
        "reference": art.reference,
        "nom": art.nom,
        "description": art.description or "",
        "unite": art.unite or "piece",
        "prix_vente_ttc": float(art.prix_vente_ttc),
        "tva_vente": float(art.taux_tva_vente),
        "remise_max_vente": float(art.remise_max_pourcentage),
        "actif": bool(art.actif),
    }


def push_new_article(db, art) -> Optional[str]:
    """Pousse un article VenteApp fraîchement créé vers Debot (best-effort).
    Retourne un message d'erreur (str) si ça échoue, None si succès — ne lève
    jamais d'exception pour ne pas bloquer la création locale."""
    if not is_configured() or not art.reference:
        return None
    try:
        created = create_article(venteapp_article_to_debot_payload(art))
        if created.get("id_article"):
            art.id_externe_depot = str(created["id_article"])
            db.commit()
        return None
    except DebotSyncError as e:
        logger.warning(f"Push création article vers Debot échoué (réf {art.reference}) : {e}")
        return str(e)


def push_updated_article(db, art) -> Optional[str]:
    """Pousse une mise à jour d'article VenteApp vers Debot (best-effort)."""
    if not is_configured() or not art.reference:
        return None
    try:
        if not art.id_externe_depot:
            # Jamais lié à Debot : tenter de le créer plutôt que de mettre à jour dans le vide
            return push_new_article(db, art)
        update_article(int(art.id_externe_depot), venteapp_article_to_debot_payload(art))
        return None
    except (DebotSyncError, ValueError) as e:
        logger.warning(f"Push mise à jour article vers Debot échoué (réf {art.reference}) : {e}")
        return str(e)
