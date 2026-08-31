import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.config import settings
from app.api.v1.api import api_router

# Dossier du build frontend (généré par "npm run build" dans /frontend).
# S'il n'existe pas (ex. dev local avec "npm run dev"), le backend reste
# une API pure et le frontend est servi séparément par Vite.
FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist")
FRONTEND_DIST = os.path.abspath(FRONTEND_DIST)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Créer les tables et insérer les données par défaut au démarrage
    from app.seed import init_db
    from app.scheduler import start_scheduler
    init_db()
    
    # Démarrer le planificateur de tâches en arrière-plan (relances WhatsApp, etc.)
    scheduler = start_scheduler()
    
    yield
    
    # Arrêter proprement le planificateur à l'arrêt de l'application
    scheduler.shutdown()

app = FastAPI(
    lifespan=lifespan,
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    description="API Backend pour Gestion de Vente Quincaillerie (POS & ERP local / distant)"
)

# Enable CORS for local network PCs (192.168.x.x, 10.x.x.x, localhost)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for local network & mobile apps
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/health")
def health_check():
    return {"status": "healthy"}

if os.path.isdir(FRONTEND_DIST):
    # Production : le backend sert aussi les fichiers statiques du frontend
    # (JS/CSS/images) et renvoie index.html pour toute route inconnue afin
    # que le routing côté React (react-router) fonctionne après un refresh.
    assets_dir = os.path.join(FRONTEND_DIST, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        candidate = os.path.join(FRONTEND_DIST, full_path)
        if full_path and os.path.isfile(candidate):
            return FileResponse(candidate)
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))
else:
    @app.get("/")
    def root():
        return {
            "message": "Bienvenue sur l'API Quincaillerie ERP/POS",
            "docs": "/docs",
            "status": "online"
        }
