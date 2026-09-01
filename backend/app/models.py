from sqlalchemy import (
    Column, Integer, String, Numeric, Text, Boolean, Date, DateTime,
    ForeignKey, UniqueConstraint, CheckConstraint, JSON
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class ParametresEntreprise(Base):
    __tablename__ = "parametres_entreprise"

    id_entreprise = Column(Integer, primary_key=True, index=True)
    raison_sociale = Column(String(150), nullable=False)
    matricule_fiscal = Column(String(50))
    adresse = Column(Text)
    telephone = Column(String(20))
    email = Column(String(100))
    rib = Column(String(50))


class Utilisateur(Base):
    __tablename__ = "utilisateurs"

    id_utilisateur = Column(Integer, primary_key=True, index=True)
    nom = Column(String(100), nullable=False)
    prenom = Column(String(100))
    email = Column(String(150), unique=True, nullable=False, index=True)
    mot_de_passe_hash = Column(String(255), nullable=False)
    role = Column(String(30), nullable=False, default="vendeur")
    telephone = Column(String(20))
    actif = Column(Boolean, nullable=False, default=True)
    date_creation = Column(DateTime, nullable=False, server_default=func.now())


class Client(Base):
    __tablename__ = "clients"

    id_client = Column(Integer, primary_key=True, index=True)
    type_client = Column(String(20), nullable=False)  # 'physique', 'societe'
    nom = Column(String(150), nullable=False)
    prenom = Column(String(100))
    matricule_fiscal = Column(String(50))
    telephone = Column(String(20))
    email = Column(String(150))
    adresse = Column(Text)
    plafond_credit = Column(Numeric(12, 3), nullable=False, default=0)
    solde_compte = Column(Numeric(12, 3), nullable=False, default=0)
    delai_relance_jours = Column(Integer, nullable=False, default=30)
    actif = Column(Boolean, nullable=False, default=True)
    date_creation = Column(DateTime, nullable=False, server_default=func.now())

    documents = relationship("Document", back_populates="client")
    reglements = relationship("Reglement", back_populates="client")
    relances = relationship("RelanceCredit", back_populates="client")


class Fournisseur(Base):
    __tablename__ = "fournisseurs"

    id_fournisseur = Column(Integer, primary_key=True, index=True)
    nom = Column(String(150), nullable=False)
    matricule_fiscal = Column(String(50))
    telephone = Column(String(20))
    email = Column(String(150))
    adresse = Column(Text)
    actif = Column(Boolean, nullable=False, default=True)
    date_creation = Column(DateTime, nullable=False, server_default=func.now())

    achats = relationship("Achat", back_populates="fournisseur")


class Categorie(Base):
    __tablename__ = "categories"

    id_categorie = Column(Integer, primary_key=True, index=True)
    nom = Column(String(100), nullable=False)
    id_categorie_parente = Column(Integer, ForeignKey("categories.id_categorie"), nullable=True)

    sous_categories = relationship("Categorie")
    articles = relationship("Article", back_populates="categorie")


class Article(Base):
    __tablename__ = "articles"

    id_article = Column(Integer, primary_key=True, index=True)
    reference = Column(String(50), unique=True, index=True)
    nom = Column(String(150), nullable=False)
    description = Column(Text)
    id_categorie = Column(Integer, ForeignKey("categories.id_categorie"))
    prix_vente_ttc = Column(Numeric(12, 3), nullable=False)
    taux_tva_vente = Column(Numeric(5, 2), nullable=False, default=19)
    remise_max_pourcentage = Column(Numeric(5, 2), nullable=False, default=0)
    unite = Column(String(20), default="piece")
    quantite_stock = Column(Numeric(12, 3), nullable=False, default=0)
    seuil_alerte_stock = Column(Numeric(12, 3), default=0)
    id_externe_depot = Column(String(100))
    actif = Column(Boolean, nullable=False, default=True)
    date_creation = Column(DateTime, nullable=False, server_default=func.now())

    categorie = relationship("Categorie", back_populates="articles")
    historique_prix = relationship("HistoriquePrixVente", back_populates="article")


class HistoriquePrixVente(Base):
    __tablename__ = "historique_prix_vente"

    id_historique = Column(Integer, primary_key=True, index=True)
    id_article = Column(Integer, ForeignKey("articles.id_article"), nullable=False)
    prix_ttc = Column(Numeric(12, 3), nullable=False)
    taux_tva = Column(Numeric(5, 2), nullable=False)
    date_effet = Column(DateTime, nullable=False, server_default=func.now())
    id_utilisateur = Column(Integer, ForeignKey("utilisateurs.id_utilisateur"))

    article = relationship("Article", back_populates="historique_prix")


class Achat(Base):
    __tablename__ = "achats"

    id_achat = Column(Integer, primary_key=True, index=True)
    numero_facture_fournisseur = Column(String(50))
    id_fournisseur = Column(Integer, ForeignKey("fournisseurs.id_fournisseur"), nullable=False)
    date_achat = Column(Date, nullable=False, server_default=func.current_date())
    montant_ht = Column(Numeric(12, 3), nullable=False, default=0)
    montant_tva = Column(Numeric(12, 3), nullable=False, default=0)
    montant_taxe_supplementaire = Column(Numeric(12, 3), nullable=False, default=0)
    montant_ttc = Column(Numeric(12, 3), nullable=False, default=0)
    montant_paye = Column(Numeric(12, 3), nullable=False, default=0)
    montant_restant = Column(Numeric(12, 3), nullable=False, default=0)
    statut_paiement = Column(String(20), nullable=False, default="non_paye")
    id_utilisateur = Column(Integer, ForeignKey("utilisateurs.id_utilisateur"))
    notes = Column(Text)
    date_creation = Column(DateTime, nullable=False, server_default=func.now())

    fournisseur = relationship("Fournisseur", back_populates="achats")
    lignes = relationship("LigneAchat", back_populates="achat", cascade="all, delete-orphan")


class LigneAchat(Base):
    __tablename__ = "lignes_achat"

    id_ligne_achat = Column(Integer, primary_key=True, index=True)
    id_achat = Column(Integer, ForeignKey("achats.id_achat", ondelete="CASCADE"), nullable=False)
    id_article = Column(Integer, ForeignKey("articles.id_article"), nullable=False)
    quantite = Column(Numeric(12, 3), nullable=False)
    prix_achat_ht = Column(Numeric(12, 3), nullable=False)
    taux_tva_achat = Column(Numeric(5, 2), nullable=False, default=19)
    # Taxe additionnelle propre à certains articles (ex: droit de consommation), en % du HT,
    # appliquée en plus de la TVA sur la même base (HT après remise).
    taux_taxe_supplementaire = Column(Numeric(5, 2), nullable=False, default=0)
    remise_pourcentage = Column(Numeric(5, 2), nullable=False, default=0)
    prix_achat_ttc = Column(Numeric(12, 3), nullable=False)
    montant_ligne_ttc = Column(Numeric(12, 3), nullable=False)
    nouveau_prix_vente_ttc = Column(Numeric(12, 3), nullable=True)
    nouvelle_remise_vente = Column(Numeric(5, 2), nullable=True)

    achat = relationship("Achat", back_populates="lignes")
    article = relationship("Article")


class ReglementFournisseur(Base):
    __tablename__ = "reglements_fournisseur"

    id_reglement_fournisseur = Column(Integer, primary_key=True, index=True)
    numero = Column(String(30), unique=True)
    id_fournisseur = Column(Integer, ForeignKey("fournisseurs.id_fournisseur"), nullable=False)
    id_achat = Column(Integer, ForeignKey("achats.id_achat"), nullable=True)
    montant = Column(Numeric(12, 3), nullable=False)
    mode_paiement = Column(String(20), nullable=False)
    reference_paiement = Column(String(50))
    date_echeance = Column(Date)
    statut_cheque = Column(String(20))
    date_reglement = Column(DateTime, nullable=False, server_default=func.now())
    id_utilisateur = Column(Integer, ForeignKey("utilisateurs.id_utilisateur"))
    notes = Column(Text)


class CompteurNumerotation(Base):
    __tablename__ = "compteurs_numerotation"

    id_compteur = Column(Integer, primary_key=True, index=True)
    type_compteur = Column(String(20), nullable=False)
    annee = Column(Integer, nullable=False)
    dernier_numero = Column(Integer, nullable=False, default=0)

    __table_args__ = (
        UniqueConstraint("type_compteur", "annee", name="uq_compteur_type_annee"),
    )


class Document(Base):
    __tablename__ = "documents"

    id_document = Column(Integer, primary_key=True, index=True)
    type_document = Column(String(20), nullable=False)  # devis, bon_livraison, facture_rapide
    numero = Column(String(30), nullable=False)
    id_client = Column(Integer, ForeignKey("clients.id_client"), nullable=False)
    id_utilisateur = Column(Integer, ForeignKey("utilisateurs.id_utilisateur"))
    id_document_origine = Column(Integer, ForeignKey("documents.id_document"), nullable=True)
    date_document = Column(DateTime, nullable=False, server_default=func.now())
    montant_ttc_sans_remise = Column(Numeric(12, 3), nullable=False, default=0)
    montant_remise = Column(Numeric(12, 3), nullable=False, default=0)
    montant_ttc_final = Column(Numeric(12, 3), nullable=False, default=0)
    montant_retourne = Column(Numeric(12, 3), nullable=False, default=0)
    montant_paye = Column(Numeric(12, 3), nullable=False, default=0)
    montant_restant = Column(Numeric(12, 3), nullable=False, default=0)
    statut = Column(String(20), nullable=False, default="brouillon")
    statut_livraison = Column(String(20), nullable=False, default="non_livre")  # non_livre, partiellement_livre, livre
    facture_dans_facturation = Column(Boolean, nullable=False, default=False)
    notes = Column(Text)

    __table_args__ = (
        UniqueConstraint("type_document", "numero", name="uq_document_type_numero"),
    )

    client = relationship("Client", back_populates="documents")
    lignes = relationship("LigneDocument", back_populates="document", cascade="all, delete-orphan")


class LigneDocument(Base):
    __tablename__ = "lignes_document"

    id_ligne = Column(Integer, primary_key=True, index=True)
    id_document = Column(Integer, ForeignKey("documents.id_document", ondelete="CASCADE"), nullable=False)
    id_article = Column(Integer, ForeignKey("articles.id_article"), nullable=False)
    quantite = Column(Numeric(12, 3), nullable=False)
    quantite_livree = Column(Numeric(12, 3), nullable=False, default=0)
    quantite_restante_a_livrer = Column(Numeric(12, 3), nullable=False, default=0)
    statut_livraison = Column(String(20), nullable=False, default="non_livre")  # non_livre, partiellement_livre, livre
    prix_unitaire_ttc = Column(Numeric(12, 3), nullable=False)
    remise_pourcentage = Column(Numeric(5, 2), nullable=False, default=0)
    prix_unitaire_apres_remise = Column(Numeric(12, 3), nullable=False)
    ordre_affichage = Column(Integer, default=0)

    document = relationship("Document", back_populates="lignes")
    article = relationship("Article")


class BonRetour(Base):
    __tablename__ = "bons_retour"

    id_retour = Column(Integer, primary_key=True, index=True)
    numero = Column(String(30), unique=True, nullable=False)
    id_document = Column(Integer, ForeignKey("documents.id_document"), nullable=True)
    id_client = Column(Integer, ForeignKey("clients.id_client"), nullable=False)
    date_retour = Column(DateTime, nullable=False, server_default=func.now())
    montant_ttc = Column(Numeric(12, 3), nullable=False, default=0)
    motif = Column(Text)
    id_utilisateur = Column(Integer, ForeignKey("utilisateurs.id_utilisateur"))
    statut = Column(String(20), nullable=False, default="valide")
    facture_dans_facturation = Column(Boolean, nullable=False, default=False)
    mode_remboursement = Column(String(20), nullable=False, default="credit")  # credit, especes

    lignes = relationship("LigneRetour", back_populates="retour", cascade="all, delete-orphan")


class LigneRetour(Base):
    __tablename__ = "lignes_retour"

    id_ligne_retour = Column(Integer, primary_key=True, index=True)
    id_retour = Column(Integer, ForeignKey("bons_retour.id_retour", ondelete="CASCADE"), nullable=False)
    id_article = Column(Integer, ForeignKey("articles.id_article"), nullable=False)
    quantite = Column(Numeric(12, 3), nullable=False)
    prix_unitaire_ttc = Column(Numeric(12, 3), nullable=False)

    retour = relationship("BonRetour", back_populates="lignes")
    article = relationship("Article")


class Facturation(Base):
    __tablename__ = "facturations"

    id_facturation = Column(Integer, primary_key=True, index=True)
    numero_facture = Column(String(30), unique=True, nullable=False)
    id_client = Column(Integer, ForeignKey("clients.id_client"), nullable=False)
    periode_debut = Column(Date)
    periode_fin = Column(Date)
    date_facturation = Column(DateTime, nullable=False, server_default=func.now())
    montant_ht = Column(Numeric(12, 3), nullable=False, default=0)
    montant_tva = Column(Numeric(12, 3), nullable=False, default=0)
    montant_timbre = Column(Numeric(12, 3), nullable=False, default=1)
    montant_ttc = Column(Numeric(12, 3), nullable=False, default=0)
    montant_retourne = Column(Numeric(12, 3), nullable=False, default=0)
    montant_paye = Column(Numeric(12, 3), nullable=False, default=0)
    montant_restant = Column(Numeric(12, 3), nullable=False, default=0)
    remise_pct = Column(Numeric(5, 2), nullable=False, default=0)
    statut = Column(String(20), nullable=False, default="validee")
    id_utilisateur = Column(Integer, ForeignKey("utilisateurs.id_utilisateur"))

    client = relationship("Client")
    lignes = relationship("LigneFacturation", back_populates="facturation", cascade="all, delete-orphan")
    facturation_documents = relationship("FacturationDocument", back_populates="facturation", cascade="all, delete-orphan")
    facturation_retours = relationship("FacturationRetour", back_populates="facturation", cascade="all, delete-orphan")
    retours = relationship("BonRetour", secondary="facturation_retours", viewonly=True)

class FacturationRetour(Base):
    __tablename__ = "facturation_retours"

    id_facturation = Column(Integer, ForeignKey("facturations.id_facturation", ondelete="CASCADE"), primary_key=True)
    id_retour = Column(Integer, ForeignKey("bons_retour.id_retour"), primary_key=True)

    facturation = relationship("Facturation", back_populates="facturation_retours")
    retour = relationship("BonRetour")


class FacturationDocument(Base):
    __tablename__ = "facturation_documents"

    id_facturation = Column(Integer, ForeignKey("facturations.id_facturation", ondelete="CASCADE"), primary_key=True)
    id_document = Column(Integer, ForeignKey("documents.id_document"), primary_key=True)

    facturation = relationship("Facturation", back_populates="facturation_documents")
    document = relationship("Document")


class LigneFacturation(Base):
    __tablename__ = "lignes_facturation"

    id_ligne_facturation = Column(Integer, primary_key=True, index=True)
    id_facturation = Column(Integer, ForeignKey("facturations.id_facturation", ondelete="CASCADE"), nullable=False)
    id_article = Column(Integer, ForeignKey("articles.id_article"), nullable=False)
    quantite_totale = Column(Numeric(12, 3), nullable=False)
    prix_unitaire_moyen_ht = Column(Numeric(12, 3), nullable=False)
    taux_tva = Column(Numeric(5, 2), nullable=False)
    montant_ht = Column(Numeric(12, 3), nullable=False)
    montant_tva = Column(Numeric(12, 3), nullable=False)
    montant_ttc = Column(Numeric(12, 3), nullable=False)

    facturation = relationship("Facturation", back_populates="lignes")
    article = relationship("Article")


class Reglement(Base):
    __tablename__ = "reglements"

    id_reglement = Column(Integer, primary_key=True, index=True)
    numero = Column(String(30), unique=True)
    id_client = Column(Integer, ForeignKey("clients.id_client"), nullable=False)
    id_document = Column(Integer, ForeignKey("documents.id_document"), nullable=True)
    id_facturation = Column(Integer, ForeignKey("facturations.id_facturation"), nullable=True)
    montant = Column(Numeric(12, 3), nullable=False)
    mode_paiement = Column(String(20), nullable=False)
    reference_paiement = Column(String(50))
    date_echeance = Column(Date)
    statut_cheque = Column(String(20))
    date_reglement = Column(DateTime, nullable=False, server_default=func.now())
    id_utilisateur = Column(Integer, ForeignKey("utilisateurs.id_utilisateur"))
    notes = Column(Text)

    client = relationship("Client", back_populates="reglements")
    document = relationship("Document")
    facturation = relationship("Facturation")

    @property
    def numero_document(self):
        return self.document.numero if self.document else None

    @property
    def numero_facturation(self):
        return self.facturation.numero_facture if self.facturation else None


class RelanceCredit(Base):
    __tablename__ = "relances_credit"

    id_relance = Column(Integer, primary_key=True, index=True)
    id_client = Column(Integer, ForeignKey("clients.id_client"), nullable=False)
    date_planifiee = Column(Date, nullable=False)
    delai_jours_utilise = Column(Integer, nullable=False)
    solde_au_moment = Column(Numeric(12, 3))
    canal_prevu = Column(String(20), nullable=False, default="automatique")
    canal_utilise = Column(String(20))
    statut = Column(String(20), nullable=False, default="planifiee")
    date_execution = Column(DateTime)
    id_utilisateur = Column(Integer, ForeignKey("utilisateurs.id_utilisateur"))
    notes = Column(Text)
    date_creation = Column(DateTime, nullable=False, server_default=func.now())

    client = relationship("Client", back_populates="relances")


class LogAction(Base):
    __tablename__ = "logs_actions"

    id_log = Column(Integer, primary_key=True, index=True)
    id_utilisateur = Column(Integer, ForeignKey("utilisateurs.id_utilisateur"))
    type_action = Column(String(30), nullable=False)
    table_concernee = Column(String(50))
    id_enregistrement = Column(Integer)
    description = Column(Text)
    donnees_avant = Column(JSON)
    donnees_apres = Column(JSON)
    adresse_ip = Column(String(45))
    date_action = Column(DateTime, nullable=False, server_default=func.now())

    utilisateur = relationship("Utilisateur")


class ParametresBackup(Base):
    __tablename__ = "parametres_backup"

    id_backup = Column(Integer, primary_key=True, index=True)
    actif = Column(Boolean, nullable=False, default=False)
    heure_envoi = Column(String(5), nullable=False, default="22:00")  # format "HH:MM"
    smtp_email = Column(String(150))
    smtp_password = Column(String(255))
    email_destinataire = Column(String(150))
    derniere_sauvegarde = Column(DateTime)
    dernier_statut = Column(String(20))  # succes, echec
    dernier_message = Column(Text)
