-- =====================================================================
-- BASE DE DONNEES - GESTION DE VENTE QUINCAILLERIE
-- SGBD cible : PostgreSQL
-- =====================================================================

-- 1. PARAMETRES DE L'ENTREPRISE
CREATE TABLE IF NOT EXISTS parametres_entreprise (
    id_entreprise       SERIAL PRIMARY KEY,
    raison_sociale       VARCHAR(150) NOT NULL,
    matricule_fiscal      VARCHAR(50),
    adresse              TEXT,
    telephone            VARCHAR(20),
    email                VARCHAR(100),
    rib                  VARCHAR(50)
);

-- 2. UTILISATEURS
CREATE TABLE IF NOT EXISTS utilisateurs (
    id_utilisateur       SERIAL PRIMARY KEY,
    nom                  VARCHAR(100) NOT NULL,
    prenom               VARCHAR(100),
    email                VARCHAR(150) UNIQUE NOT NULL,
    mot_de_passe_hash     VARCHAR(255) NOT NULL,
    role                 VARCHAR(30) NOT NULL DEFAULT 'vendeur'
                         CHECK (role IN ('admin','vendeur','caissier','gestionnaire_stock')),
    telephone            VARCHAR(20),
    actif                BOOLEAN NOT NULL DEFAULT TRUE,
    date_creation         TIMESTAMP NOT NULL DEFAULT now()
);

-- 3. CLIENTS
CREATE TABLE IF NOT EXISTS clients (
    id_client            SERIAL PRIMARY KEY,
    type_client           VARCHAR(20) NOT NULL CHECK (type_client IN ('physique','societe')),
    nom                  VARCHAR(150) NOT NULL,
    prenom               VARCHAR(100),
    matricule_fiscal      VARCHAR(50),
    telephone            VARCHAR(20),
    email                VARCHAR(150),
    adresse              TEXT,
    plafond_credit        NUMERIC(12,3) NOT NULL DEFAULT 0,
    solde_compte          NUMERIC(12,3) NOT NULL DEFAULT 0,
    delai_relance_jours     INTEGER NOT NULL DEFAULT 30,
    actif                BOOLEAN NOT NULL DEFAULT TRUE,
    date_creation         TIMESTAMP NOT NULL DEFAULT now()
);

-- 4. FOURNISSEURS
CREATE TABLE IF NOT EXISTS fournisseurs (
    id_fournisseur        SERIAL PRIMARY KEY,
    nom                  VARCHAR(150) NOT NULL,
    matricule_fiscal      VARCHAR(50),
    telephone            VARCHAR(20),
    email                VARCHAR(150),
    adresse              TEXT,
    actif                BOOLEAN NOT NULL DEFAULT TRUE,
    date_creation         TIMESTAMP NOT NULL DEFAULT now()
);

-- 5. CATEGORIES
CREATE TABLE IF NOT EXISTS categories (
    id_categorie          SERIAL PRIMARY KEY,
    nom                  VARCHAR(100) NOT NULL,
    id_categorie_parente   INTEGER REFERENCES categories(id_categorie)
);

-- 6. ARTICLES
CREATE TABLE IF NOT EXISTS articles (
    id_article           SERIAL PRIMARY KEY,
    reference            VARCHAR(50) UNIQUE,
    nom                  VARCHAR(150) NOT NULL,
    description          TEXT,
    id_categorie          INTEGER REFERENCES categories(id_categorie),
    prix_vente_ttc         NUMERIC(12,3) NOT NULL,
    taux_tva_vente         NUMERIC(5,2) NOT NULL DEFAULT 19,
    remise_max_pourcentage  NUMERIC(5,2) NOT NULL DEFAULT 0,
    unite                VARCHAR(20) DEFAULT 'piece',
    quantite_stock         NUMERIC(12,3) NOT NULL DEFAULT 0,
    seuil_alerte_stock      NUMERIC(12,3) DEFAULT 0,
    id_externe_depot       VARCHAR(100),
    actif                BOOLEAN NOT NULL DEFAULT TRUE,
    date_creation         TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_articles_categorie ON articles(id_categorie);

-- 7. HISTORIQUE DES PRIX DE VENTE
CREATE TABLE IF NOT EXISTS historique_prix_vente (
    id_historique         SERIAL PRIMARY KEY,
    id_article           INTEGER NOT NULL REFERENCES articles(id_article),
    prix_ttc             NUMERIC(12,3) NOT NULL,
    taux_tva             NUMERIC(5,2) NOT NULL,
    date_effet            TIMESTAMP NOT NULL DEFAULT now(),
    id_utilisateur        INTEGER REFERENCES utilisateurs(id_utilisateur)
);

CREATE INDEX IF NOT EXISTS idx_hist_prix_vente_article ON historique_prix_vente(id_article, date_effet);

-- 8. ACHATS
CREATE TABLE IF NOT EXISTS achats (
    id_achat              SERIAL PRIMARY KEY,
    numero_facture_fournisseur VARCHAR(50),
    id_fournisseur          INTEGER NOT NULL REFERENCES fournisseurs(id_fournisseur),
    date_achat             DATE NOT NULL DEFAULT CURRENT_DATE,
    montant_ht             NUMERIC(12,3) NOT NULL DEFAULT 0,
    montant_tva            NUMERIC(12,3) NOT NULL DEFAULT 0,
    montant_taxe_supplementaire NUMERIC(12,3) NOT NULL DEFAULT 0,
    montant_ttc            NUMERIC(12,3) NOT NULL DEFAULT 0,
    montant_paye           NUMERIC(12,3) NOT NULL DEFAULT 0,
    montant_restant         NUMERIC(12,3) NOT NULL DEFAULT 0,
    statut_paiement         VARCHAR(20) NOT NULL DEFAULT 'non_paye'
                          CHECK (statut_paiement IN ('non_paye','paye','partiellement_paye')),
    id_utilisateur          INTEGER REFERENCES utilisateurs(id_utilisateur),
    notes                TEXT,
    date_creation           TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_achats_fournisseur ON achats(id_fournisseur);
CREATE INDEX IF NOT EXISTS idx_achats_date ON achats(date_achat);

-- 9. LIGNES D'ACHAT
CREATE TABLE IF NOT EXISTS lignes_achat (
    id_ligne_achat          SERIAL PRIMARY KEY,
    id_achat              INTEGER NOT NULL REFERENCES achats(id_achat) ON DELETE CASCADE,
    id_article             INTEGER NOT NULL REFERENCES articles(id_article),
    quantite              NUMERIC(12,3) NOT NULL,
    prix_achat_ht           NUMERIC(12,3) NOT NULL,
    taux_tva_achat          NUMERIC(5,2) NOT NULL DEFAULT 19,
    taux_taxe_supplementaire    NUMERIC(5,2) NOT NULL DEFAULT 0,
    remise_pourcentage        NUMERIC(5,2) NOT NULL DEFAULT 0,
    prix_achat_ttc          NUMERIC(12,3) NOT NULL,
    montant_ligne_ttc        NUMERIC(12,3) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lignes_achat_achat ON lignes_achat(id_achat);
CREATE INDEX IF NOT EXISTS idx_lignes_achat_article ON lignes_achat(id_article);

-- 10. VUES FOURNISSEUR
CREATE OR REPLACE VIEW vue_historique_achats AS
SELECT
    la.id_ligne_achat,
    la.id_article,
    a.id_achat,
    a.numero_facture_fournisseur,
    a.date_achat,
    a.statut_paiement,
    f.id_fournisseur,
    f.nom AS nom_fournisseur,
    la.quantite,
    la.prix_achat_ht,
    la.taux_tva_achat,
    la.remise_pourcentage,
    la.prix_achat_ttc,
    la.montant_ligne_ttc
FROM lignes_achat la
JOIN achats a ON a.id_achat = la.id_achat
JOIN fournisseurs f ON f.id_fournisseur = a.id_fournisseur;

CREATE OR REPLACE VIEW vue_dernieres_offres_fournisseur AS
SELECT DISTINCT ON (f.id_fournisseur, la.id_article)
    f.id_fournisseur,
    f.nom AS nom_fournisseur,
    la.id_article,
    la.prix_achat_ht,
    la.taux_tva_achat,
    la.remise_pourcentage,
    la.prix_achat_ttc,
    a.date_achat AS date_derniere_offre
FROM lignes_achat la
JOIN achats a ON a.id_achat = la.id_achat
JOIN fournisseurs f ON f.id_fournisseur = a.id_fournisseur
ORDER BY f.id_fournisseur, la.id_article, a.date_achat DESC, la.id_ligne_achat DESC;

CREATE OR REPLACE VIEW vue_meilleur_prix_par_article AS
SELECT DISTINCT ON (id_article)
    id_article,
    id_fournisseur,
    nom_fournisseur,
    prix_achat_ttc,
    date_derniere_offre
FROM vue_dernieres_offres_fournisseur
ORDER BY id_article, prix_achat_ttc ASC;

-- 11. REGLEMENTS FOURNISSEUR
CREATE TABLE IF NOT EXISTS reglements_fournisseur (
    id_reglement_fournisseur   SERIAL PRIMARY KEY,
    numero                VARCHAR(30) UNIQUE,
    id_fournisseur           INTEGER NOT NULL REFERENCES fournisseurs(id_fournisseur),
    id_achat               INTEGER REFERENCES achats(id_achat),
    montant                NUMERIC(12,3) NOT NULL,
    mode_paiement            VARCHAR(20) NOT NULL
                          CHECK (mode_paiement IN ('espece','cheque','virement','carte','traite')),
    reference_paiement         VARCHAR(50),
    date_echeance            DATE,
    statut_cheque            VARCHAR(20)
                          CHECK (statut_cheque IN ('en_attente','encaisse','rejete') OR statut_cheque IS NULL),
    date_reglement            TIMESTAMP NOT NULL DEFAULT now(),
    id_utilisateur            INTEGER REFERENCES utilisateurs(id_utilisateur),
    notes                  TEXT
);

CREATE INDEX IF NOT EXISTS idx_reglements_fournisseur_fournisseur ON reglements_fournisseur(id_fournisseur);
CREATE INDEX IF NOT EXISTS idx_reglements_fournisseur_achat ON reglements_fournisseur(id_achat);

-- 12. COMPTEURS DE NUMEROTATION
CREATE TABLE IF NOT EXISTS compteurs_numerotation (
    id_compteur           SERIAL PRIMARY KEY,
    type_compteur          VARCHAR(20) NOT NULL
                          CHECK (type_compteur IN ('devis','bon_livraison','facture_rapide','facturation')),
    annee                INTEGER NOT NULL,
    dernier_numero          INTEGER NOT NULL DEFAULT 0,
    UNIQUE(type_compteur, annee)
);

-- 13. DOCUMENTS
CREATE TABLE IF NOT EXISTS documents (
    id_document           SERIAL PRIMARY KEY,
    type_document          VARCHAR(20) NOT NULL
                          CHECK (type_document IN ('facture_rapide','bon_livraison','devis')),
    numero               VARCHAR(30) NOT NULL,
    id_client             INTEGER NOT NULL REFERENCES clients(id_client),
    id_utilisateur         INTEGER REFERENCES utilisateurs(id_utilisateur),
    id_document_origine      INTEGER REFERENCES documents(id_document),
    date_document          TIMESTAMP NOT NULL DEFAULT now(),
    montant_ttc_sans_remise  NUMERIC(12,3) NOT NULL DEFAULT 0,
    montant_remise          NUMERIC(12,3) NOT NULL DEFAULT 0,
    montant_ttc_final        NUMERIC(12,3) NOT NULL DEFAULT 0,
    montant_paye           NUMERIC(12,3) NOT NULL DEFAULT 0,
    montant_restant         NUMERIC(12,3) NOT NULL DEFAULT 0,
    statut               VARCHAR(20) NOT NULL DEFAULT 'brouillon'
                          CHECK (statut IN ('brouillon','valide','annule','paye','partiellement_paye')),
    statut_livraison       VARCHAR(20) NOT NULL DEFAULT 'non_livre'
                          CHECK (statut_livraison IN ('non_livre','partiellement_livre','livre')),
    facture_dans_facturation  BOOLEAN NOT NULL DEFAULT FALSE,
    notes                TEXT,
    UNIQUE(type_document, numero)
);

CREATE INDEX IF NOT EXISTS idx_documents_client ON documents(id_client);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type_document);

-- 14. LIGNES DE DOCUMENT
CREATE TABLE IF NOT EXISTS lignes_document (
    id_ligne             SERIAL PRIMARY KEY,
    id_document           INTEGER NOT NULL REFERENCES documents(id_document) ON DELETE CASCADE,
    id_article            INTEGER NOT NULL REFERENCES articles(id_article),
    quantite             NUMERIC(12,3) NOT NULL,
    quantite_livree       NUMERIC(12,3) NOT NULL DEFAULT 0,
    quantite_restante_a_livrer NUMERIC(12,3) NOT NULL DEFAULT 0,
    statut_livraison       VARCHAR(20) NOT NULL DEFAULT 'non_livre'
                          CHECK (statut_livraison IN ('non_livre','partiellement_livre','livre')),
    prix_unitaire_ttc       NUMERIC(12,3) NOT NULL,
    remise_pourcentage      NUMERIC(5,2) NOT NULL DEFAULT 0,
    prix_unitaire_apres_remise NUMERIC(12,3) NOT NULL,
    ordre_affichage         INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_lignes_document_doc ON lignes_document(id_document);
CREATE INDEX IF NOT EXISTS idx_lignes_document_article ON lignes_document(id_article);

-- 15. BONS DE RETOUR
CREATE TABLE IF NOT EXISTS bons_retour (
    id_retour             SERIAL PRIMARY KEY,
    numero               VARCHAR(30) NOT NULL UNIQUE,
    id_document           INTEGER REFERENCES documents(id_document),
    id_client             INTEGER NOT NULL REFERENCES clients(id_client),
    date_retour            TIMESTAMP NOT NULL DEFAULT now(),
    montant_ttc            NUMERIC(12,3) NOT NULL DEFAULT 0,
    motif                TEXT,
    id_utilisateur          INTEGER REFERENCES utilisateurs(id_utilisateur),
    statut               VARCHAR(20) NOT NULL DEFAULT 'valide'
                          CHECK (statut IN ('valide','annule'))
);

CREATE INDEX IF NOT EXISTS idx_retour_client ON bons_retour(id_client);

-- 16. LIGNES DE RETOUR
CREATE TABLE IF NOT EXISTS lignes_retour (
    id_ligne_retour         SERIAL PRIMARY KEY,
    id_retour             INTEGER NOT NULL REFERENCES bons_retour(id_retour) ON DELETE CASCADE,
    id_article            INTEGER NOT NULL REFERENCES articles(id_article),
    quantite             NUMERIC(12,3) NOT NULL,
    prix_unitaire_ttc       NUMERIC(12,3) NOT NULL
);

-- 17. FACTURATION
CREATE TABLE IF NOT EXISTS facturations (
    id_facturation         SERIAL PRIMARY KEY,
    numero_facture         VARCHAR(30) NOT NULL UNIQUE,
    id_client             INTEGER NOT NULL REFERENCES clients(id_client),
    periode_debut          DATE,
    periode_fin            DATE,
    date_facturation        TIMESTAMP NOT NULL DEFAULT now(),
    montant_ht             NUMERIC(12,3) NOT NULL DEFAULT 0,
    montant_tva            NUMERIC(12,3) NOT NULL DEFAULT 0,
    montant_timbre          NUMERIC(12,3) NOT NULL DEFAULT 1,
    montant_ttc             NUMERIC(12,3) NOT NULL DEFAULT 0,
    montant_paye           NUMERIC(12,3) NOT NULL DEFAULT 0,
    montant_restant         NUMERIC(12,3) NOT NULL DEFAULT 0,
    statut               VARCHAR(20) NOT NULL DEFAULT 'validee'
                          CHECK (statut IN ('validee','annulee','payee','partiellement_payee')),
    id_utilisateur          INTEGER REFERENCES utilisateurs(id_utilisateur)
);

CREATE INDEX IF NOT EXISTS idx_facturation_client ON facturations(id_client);

-- 18. LIAISON FACTURATION <-> BONS DE LIVRAISON
CREATE TABLE IF NOT EXISTS facturation_documents (
    id_facturation         INTEGER NOT NULL REFERENCES facturations(id_facturation) ON DELETE CASCADE,
    id_document           INTEGER NOT NULL REFERENCES documents(id_document),
    PRIMARY KEY (id_facturation, id_document)
);

-- 18b. LIAISON FACTURATION <-> BONS DE RETOUR
CREATE TABLE IF NOT EXISTS facturation_retours (
    id_facturation         INTEGER NOT NULL REFERENCES facturations(id_facturation) ON DELETE CASCADE,
    id_retour             INTEGER NOT NULL REFERENCES bons_retour(id_retour),
    PRIMARY KEY (id_facturation, id_retour)
);

-- 19. LIGNES DE FACTURATION
CREATE TABLE IF NOT EXISTS lignes_facturation (
    id_ligne_facturation      SERIAL PRIMARY KEY,
    id_facturation         INTEGER NOT NULL REFERENCES facturations(id_facturation) ON DELETE CASCADE,
    id_article            INTEGER NOT NULL REFERENCES articles(id_article),
    quantite_totale         NUMERIC(12,3) NOT NULL,
    prix_unitaire_moyen_ht    NUMERIC(12,3) NOT NULL,
    taux_tva             NUMERIC(5,2) NOT NULL,
    montant_ht             NUMERIC(12,3) NOT NULL,
    montant_tva            NUMERIC(12,3) NOT NULL,
    montant_ttc            NUMERIC(12,3) NOT NULL,
    UNIQUE(id_facturation, id_article)
);

-- 20. REGLEMENTS CLIENTS
CREATE TABLE IF NOT EXISTS reglements (
    id_reglement           SERIAL PRIMARY KEY,
    numero               VARCHAR(30) UNIQUE,
    id_client             INTEGER NOT NULL REFERENCES clients(id_client),
    id_document           INTEGER REFERENCES documents(id_document),
    id_facturation         INTEGER REFERENCES facturations(id_facturation),
    montant               NUMERIC(12,3) NOT NULL,
    mode_paiement          VARCHAR(20) NOT NULL
                          CHECK (mode_paiement IN ('espece','cheque','virement','carte','traite')),
    reference_paiement       VARCHAR(50),
    date_echeance          DATE,
    statut_cheque          VARCHAR(20)
                          CHECK (statut_cheque IN ('en_attente','encaisse','rejete') OR statut_cheque IS NULL),
    date_reglement          TIMESTAMP NOT NULL DEFAULT now(),
    id_utilisateur          INTEGER REFERENCES utilisateurs(id_utilisateur),
    notes                TEXT,
    CHECK (id_document IS NULL OR id_facturation IS NULL)
);

CREATE INDEX IF NOT EXISTS idx_reglements_client ON reglements(id_client);
CREATE INDEX IF NOT EXISTS idx_reglements_document ON reglements(id_document);
CREATE INDEX IF NOT EXISTS idx_reglements_facturation ON reglements(id_facturation);

-- 21. RELANCES CREDIT
CREATE TABLE IF NOT EXISTS relances_credit (
    id_relance            SERIAL PRIMARY KEY,
    id_client             INTEGER NOT NULL REFERENCES clients(id_client),
    date_planifiee          DATE NOT NULL,
    delai_jours_utilise      INTEGER NOT NULL,
    solde_au_moment         NUMERIC(12,3),
    canal_prevu            VARCHAR(20) NOT NULL DEFAULT 'automatique'
                          CHECK (canal_prevu IN ('telephone','email','whatsapp','sms','automatique')),
    canal_utilise           VARCHAR(20)
                          CHECK (canal_utilise IN ('telephone','email','whatsapp','sms','automatique') OR canal_utilise IS NULL),
    statut               VARCHAR(20) NOT NULL DEFAULT 'planifiee'
                          CHECK (statut IN ('planifiee','effectuee','annulee','reportee')),
    date_execution          TIMESTAMP,
    id_utilisateur          INTEGER REFERENCES utilisateurs(id_utilisateur),
    notes                TEXT,
    date_creation           TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_relances_client ON relances_credit(id_client);
CREATE INDEX IF NOT EXISTS idx_relances_date_statut ON relances_credit(date_planifiee, statut);

-- 22. LOGS ACTIONS
CREATE TABLE IF NOT EXISTS logs_actions (
    id_log               SERIAL PRIMARY KEY,
    id_utilisateur          INTEGER REFERENCES utilisateurs(id_utilisateur),
    type_action            VARCHAR(30) NOT NULL,
    table_concernee         VARCHAR(50),
    id_enregistrement        INTEGER,
    description            TEXT,
    donnees_avant           JSONB,
    donnees_apres           JSONB,
    adresse_ip             VARCHAR(45),
    date_action            TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_logs_utilisateur ON logs_actions(id_utilisateur);
CREATE INDEX IF NOT EXISTS idx_logs_table_enregistrement ON logs_actions(table_concernee, id_enregistrement);

-- 21. PARAMETRES DE SAUVEGARDE AUTOMATIQUE
CREATE TABLE IF NOT EXISTS parametres_backup (
    id_backup             SERIAL PRIMARY KEY,
    actif                BOOLEAN NOT NULL DEFAULT FALSE,
    heure_envoi            VARCHAR(5) NOT NULL DEFAULT '22:00',
    smtp_email             VARCHAR(150),
    smtp_password           VARCHAR(255),
    email_destinataire        VARCHAR(150),
    derniere_sauvegarde        TIMESTAMP,
    dernier_statut           VARCHAR(20),
    dernier_message          TEXT
);
CREATE INDEX IF NOT EXISTS idx_logs_date ON logs_actions(date_action);
