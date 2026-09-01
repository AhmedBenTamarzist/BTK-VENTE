from fastapi import APIRouter
from app.api.v1 import (
    auth, users, enterprise, clients, fournisseurs, categories,
    articles, achats, documents, retours, facturations, reglements, relances, logs, backup
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentification"])
api_router.include_router(users.router, prefix="/users", tags=["Utilisateurs"])
api_router.include_router(enterprise.router, prefix="/enterprise", tags=["Entreprise"])
api_router.include_router(clients.router, prefix="/clients", tags=["Clients"])
api_router.include_router(fournisseurs.router, prefix="/fournisseurs", tags=["Fournisseurs"])
api_router.include_router(categories.router, prefix="/categories", tags=["Catégories"])
api_router.include_router(articles.router, prefix="/articles", tags=["Articles & Stock"])
api_router.include_router(achats.router, prefix="/achats", tags=["Achats Fournisseur"])
api_router.include_router(documents.router, prefix="/documents", tags=["Documents de Vente"])
api_router.include_router(retours.router, prefix="/retours", tags=["Bons de Retour"])
api_router.include_router(facturations.router, prefix="/facturations", tags=["Facturation Fiscale"])
api_router.include_router(reglements.router, prefix="/reglements", tags=["Règlements"])
api_router.include_router(relances.router, prefix="/relances", tags=["Relances Crédit"])
api_router.include_router(logs.router, prefix="/logs", tags=["Logs Actions"])
api_router.include_router(backup.router, prefix="/backup", tags=["Sauvegardes"])
