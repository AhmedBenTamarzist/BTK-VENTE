import os
import sys

# Ensure backend root directory is in sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from sqlalchemy.orm import Session
from sqlalchemy import text, create_engine, inspect
from app.config import settings
from app.database import engine, SessionLocal, Base
from app.models import Utilisateur, ParametresEntreprise, Categorie, Article, Client
from app.services.auth_service import get_password_hash

# Colonnes ajoutées après la création initiale de la base. Comme le projet n'utilise pas
# Alembic, CREATE TABLE IF NOT EXISTS / metadata.create_all() ne touchent pas les tables
# déjà existantes : on ajoute donc ces colonnes manquantes ici, de façon idempotente,
# pour ne jamais casser une base déjà en service (ex: postes déjà déployés).
_PENDING_COLUMNS = [
    ("lignes_achat", "taux_taxe_supplementaire", "NUMERIC(5,2) NOT NULL DEFAULT 0"),
    ("achats", "montant_taxe_supplementaire", "NUMERIC(12,3) NOT NULL DEFAULT 0"),
    ("facturations", "montant_timbre", "NUMERIC(12,3) NOT NULL DEFAULT 1"),
]

def _apply_pending_column_migrations():
    inspector = inspect(engine)
    with engine.connect() as conn:
        for table, column, ddl_type in _PENDING_COLUMNS:
            if not inspector.has_table(table):
                continue
            existing_cols = [c["name"] for c in inspector.get_columns(table)]
            if column in existing_cols:
                continue
            try:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl_type}"))
                conn.commit()
                print(f"--> Colonne '{column}' ajoutée à la table '{table}'.")
            except Exception as e:
                print(f"Note migration colonne {table}.{column}: {e}")

def init_db():
    print("Initialisation des tables et données par défaut...")

    is_postgres = engine.dialect.name == "postgresql"

    if is_postgres:
        sql_file = os.path.join(backend_dir, "init_schema.sql")
        if os.path.exists(sql_file):
            try:
                with open(sql_file, "r", encoding="utf-8") as f:
                    sql_content = f.read()
                with engine.connect() as conn:
                    conn.execute(text(sql_content))
                    conn.commit()
                print("Schéma SQL PostgreSQL (tables, index, vues) exécuté avec succès.")
            except Exception as e:
                print(f"Note SQL execution: {e}. Utilisation de Base.metadata.create_all.")
                Base.metadata.create_all(bind=engine)
        else:
            Base.metadata.create_all(bind=engine)
    else:
        # SQLite or standalone fallback
        Base.metadata.create_all(bind=engine)
        print("Tables créées avec succès via SQLAlchemy metadata.")

    _apply_pending_column_migrations()

    db: Session = SessionLocal()
    try:
        # 1. Admin user
        admin = db.query(Utilisateur).filter(Utilisateur.email == "admin@quincaillerie.com").first()
        if not admin:
            admin = Utilisateur(
                nom="Administrateur",
                prenom="Système",
                email="admin@quincaillerie.com",
                mot_de_passe_hash=get_password_hash("admin123"),
                role="admin",
                telephone="+216 20 000 000"
            )
            db.add(admin)
            print("--> Utilisateur Admin créé: admin@quincaillerie.com / admin123")

        # 1b. Client "Passage" réservé (client anonyme pour ventes sans client identifié)
        passage = db.query(Client).filter(Client.nom == "Client Passage").first()
        if not passage:
            passage = Client(
                type_client="physique",
                nom="Client Passage",
                prenom="",
                telephone="",
                email="",
                adresse="",
                plafond_credit=0,
                solde_compte=0,
                delai_relance_jours=30,
                actif=True
            )
            db.add(passage)
            print("--> Client 'Passage' créé (client anonyme pour ventes sans client identifié)")

        # 2. Enterprise params
        ent = db.query(ParametresEntreprise).first()
        if not ent:
            ent = ParametresEntreprise(
                raison_sociale="Quincaillerie Moderne",
                matricule_fiscal="1458963/B/A/000",
                adresse="Rue des Entrepreneurs, Tunis",
                telephone="+216 71 111 222",
                email="contact@quincailleriemoderne.tn",
                rib="03 000 0100012345678 99"
            )
            db.add(ent)
            print("--> Paramètres entreprise créés")

        # 3. Sample category & article
        cat = db.query(Categorie).first()
        if not cat:
            cat = Categorie(nom="Outillage à main")
            db.add(cat)
            db.flush()

            art = Article(
                reference="HAM-001",
                nom="Marteau de Charpentier 500g",
                description="Marteau acier monobloc avec manche bimatière",
                id_categorie=cat.id_categorie,
                prix_vente_ttc=25.500,
                taux_tva_vente=19.00,
                quantite_stock=50.000,
                seuil_alerte_stock=5.000
            )
            db.add(art)
            print("--> Catégorie et Article de démonstration créés")

        db.commit()
        print("--> Initialisation de la base de données terminée avec succès !")
    except Exception as e:
        db.rollback()
        print(f"Erreur lors du seeding: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    init_db()
