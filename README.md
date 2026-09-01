git pull
remote: Enumerating objects: 71, done.
remote: Counting objects: 100% (71/71), done.
remote: Compressing objects: 100% (27/27), done.
remote: Total 49 (delta 23), reused 37 (delta 20), pack-reused 0 (from 0)
Unpacking objects: 100% (49/49), 38.65 KiB | 284.00 KiB/s, done.
From https://github.com/AhmedBenTamarzist/BTK-VENTE
   06fe400..c653270  main       -> origin/main
Updating 06fe400..c653270
Fast-forward
 .gitignore                             |   1 +
 README.md                              |  18 ++++
 backend/.env.example                   |  10 ++
 backend/app/api/v1/api.py              |   3 +-
 backend/app/api/v1/backup.py           |  71 +++++++++++++++
 backend/app/config.py                  |  17 +++-
 backend/app/database.py                |  28 +++++-
 backend/app/main.py                    |  16 +++-
 backend/app/models.py                  |  14 +++
 backend/app/scheduler.py               |  83 ++++++++++++++---
 backend/app/schemas.py                 |  26 ++++++
 backend/app/services/backup_service.py | 162 +++++++++++++++++++++++++++++++++
 backend/backup_db.py                   |  22 +++++
 backend/init_schema.sql                |  13 +++
 frontend/src/pages/Settings.jsx        | 159 +++++++++++++++++++++++++++++++-
 frontend/src/services/api.js           |   7 +-
 16 files changed, 631 insertions(+), 19 deletions(-)
 create mode 100644 README.md
 create mode 100644 backend/app/api/v1/backup.py
 create mode 100644 backend/app/services/backup_service.py
 create mode 100644 backend/backup_db.py

C:\VenteApp\backend>python run.py
Démarrage du serveur Quincaillerie ERP sur http://0.0.0.0:8000
Documentation Swagger UI disponible sur http://localhost:8000/docs
--> Attention: Impossible de se connecter à PostgreSQL ('utf-8' codec can't decode byte 0xe9 in position 103: invalid continuation byte).
--> Basculement automatique sur la base de données locale SQLite (quincaillerie.db).
←[32mINFO←[0m:     Started server process [←[36m6132←[0m]
←[32mINFO←[0m:     Waiting for application startup.
Initialisation des tables et données par défaut...
Tables créées avec succès via SQLAlchemy metadata.
--> Initialisation de la base de données terminée avec succès !
INFO:apscheduler.scheduler:Scheduler started
INFO:app.scheduler:Background scheduler started.
←[32mINFO←[0m:     Application startup complete.
←[32mINFO←[0m:     Uvicorn running on ←[1mhttp://0.0.0.0:8000←[0m (Press CTRL+C to quit)













