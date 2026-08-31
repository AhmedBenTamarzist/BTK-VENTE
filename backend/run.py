import uvicorn
from app.config import settings

if __name__ == "__main__":
    print(f"Démarrage du serveur Quincaillerie ERP sur http://{settings.HOST}:{settings.PORT}")
    print(f"Documentation Swagger UI disponible sur http://localhost:{settings.PORT}/docs")
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True
    )
