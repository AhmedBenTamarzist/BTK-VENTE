>python run.py
Démarrage du serveur Quincaillerie ERP sur http://0.0.0.0:8000
Documentation Swagger UI disponible sur http://localhost:8000/docs
--> Attention: Impossible de se connecter à PostgreSQL ('utf-8' codec can't decode byte 0xe9 in position 103: invalid continuation byte).
--> Basculement automatique sur la base de données locale SQLite (quincaillerie.db).
←[32mINFO←[0m:     Started server process [←[36m3568←[0m]
←[32mINFO←[0m:     Waiting for application startup.
Initialisation des tables et données par défaut...
Tables créées avec succès via SQLAlchemy metadata.
--> Utilisateur Admin créé: admin@quincaillerie.com / admin123
--> Client 'Passage' créé (client anonyme pour ventes sans client identifié)
--> Paramètres entreprise créés
--> Catégorie et Article de démonstration créés
--> Initialisation de la base de données terminée avec succès !
←[32mINFO←[0m:     Application startup complete.
←[32mINFO←[0m:     Uvicorn running on ←[1mhttp://0.0.0.0:8000←[0m (Press CTRL+C to quit)
←[32mINFO←[0m:     127.0.0.1:63452 - "←[1mGET /docs HTTP/1.1←[0m" ←[32m200 OK←[0m
←[32mINFO←[0m:     127.0.0.1:63452 - "←[1mGET /api/v1/openapi.json HTTP/1.1←[0m" ←[32m200 OK←[0m
