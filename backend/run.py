import sys
import traceback

import uvicorn

from app.config import settings

if __name__ == "__main__":
    print(f"Démarrage du serveur Quincaillerie ERP sur http://{settings.HOST}:{settings.PORT}")
    print(f"Documentation Swagger UI disponible sur http://localhost:{settings.PORT}/docs")
    print(f"Base de données : {settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}")
    try:
        uvicorn.run(
            "app.main:app",
            host=settings.HOST,
            port=settings.PORT,
            reload=settings.RELOAD,
            log_level="info",
        )
    except Exception:
        traceback.print_exc()
        sys.exit(1)
