from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal

# --- AUTH & USER SCHEMAS ---
class UserLogin(BaseModel):
    email: EmailStr
    mot_de_passe: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    nom: str
    prenom: Optional[str]
    role: str

class UserCreate(BaseModel):
    nom: str
    prenom: Optional[str] = None
    email: EmailStr
    mot_de_passe: str
    role: str = "vendeur"  # admin, vendeur, caissier, gestionnaire_stock
    telephone: Optional[str] = None

class UserUpdate(BaseModel):
    nom: Optional[str] = None
    prenom: Optional[str] = None
    email: Optional[EmailStr] = None
    mot_de_passe: Optional[str] = None
    role: Optional[str] = None
    telephone: Optional[str] = None
    actif: Optional[bool] = None

class UserOut(BaseModel):
    id_utilisateur: int
    nom: str
    prenom: Optional[str]
    email: EmailStr
    role: str
    telephone: Optional[str]
    actif: bool
    date_creation: datetime

    class Config:
        from_attributes = True

# --- ENTREPRISE ---
class EnterpriseSchema(BaseModel):
    raison_sociale: str
    matricule_fiscal: Optional[str] = None
    adresse: Optional[str] = None
    telephone: Optional[str] = None
    email: Optional[str] = None
    rib: Optional[str] = None

class EnterpriseOut(EnterpriseSchema):
    id_entreprise: int
    class Config:
        from_attributes = True

# --- CLIENTS ---
class ClientCreate(BaseModel):
    type_client: str  # physique, societe
    nom: str
    prenom: Optional[str] = None
    matricule_fiscal: Optional[str] = None
    telephone: Optional[str] = None
    email: Optional[str] = None
    adresse: Optional[str] = None
    plafond_credit: Decimal = Decimal('0.000')
    delai_relance_jours: int = 30

class ClientUpdate(BaseModel):
    type_client: Optional[str] = None
    nom: Optional[str] = None
    prenom: Optional[str] = None
    matricule_fiscal: Optional[str] = None
    telephone: Optional[str] = None
    email: Optional[str] = None
    adresse: Optional[str] = None
    plafond_credit: Optional[Decimal] = None
    delai_relance_jours: Optional[int] = None
    actif: Optional[bool] = None

class ClientOut(ClientCreate):
    id_client: int
    solde_compte: Decimal
    actif: bool
    date_creation: datetime

    class Config:
        from_attributes = True

# --- FOURNISSEURS ---
class FournisseurCreate(BaseModel):
    nom: str
    matricule_fiscal: Optional[str] = None
    telephone: Optional[str] = None
    email: Optional[str] = None
    adresse: Optional[str] = None

class FournisseurUpdate(BaseModel):
    nom: Optional[str] = None
    matricule_fiscal: Optional[str] = None
    telephone: Optional[str] = None
    email: Optional[str] = None
    adresse: Optional[str] = None
    actif: Optional[bool] = None

class FournisseurOut(FournisseurCreate):
    id_fournisseur: int
    actif: bool
    date_creation: datetime

    class Config:
        from_attributes = True

# --- CATEGORIES ---
class CategoryCreate(BaseModel):
    nom: str
    id_categorie_parente: Optional[int] = None

class CategoryOut(CategoryCreate):
    id_categorie: int

    class Config:
        from_attributes = True

# --- ARTICLES ---
class ArticleCreate(BaseModel):
    reference: Optional[str] = None
    nom: str
    description: Optional[str] = None
    id_categorie: Optional[int] = None
    prix_vente_ttc: Decimal
    taux_tva_vente: Decimal = Decimal('19.00')
    remise_max_pourcentage: Decimal = Decimal('0.00')
    unite: str = "piece"
    quantite_stock: Decimal = Decimal('0.000')
    seuil_alerte_stock: Decimal = Decimal('0.000')
    id_externe_depot: Optional[str] = None

class ArticleUpdate(BaseModel):
    reference: Optional[str] = None
    nom: Optional[str] = None
    description: Optional[str] = None
    id_categorie: Optional[int] = None
    prix_vente_ttc: Optional[Decimal] = None
    taux_tva_vente: Optional[Decimal] = None
    remise_max_pourcentage: Optional[Decimal] = None
    unite: Optional[str] = None
    quantite_stock: Optional[Decimal] = None
    seuil_alerte_stock: Optional[Decimal] = None
    id_externe_depot: Optional[str] = None
    actif: Optional[bool] = None

class ArticleOut(ArticleCreate):
    id_article: int
    actif: bool
    date_creation: datetime

    class Config:
        from_attributes = True

class PriceHistoryOut(BaseModel):
    id_historique: int
    id_article: int
    prix_ttc: Decimal
    taux_tva: Decimal
    date_effet: datetime
    id_utilisateur: Optional[int]

    class Config:
        from_attributes = True

# --- ACHATS ---
class ArticleInLigne(BaseModel):
    id_article: int
    nom: str
    reference: Optional[str] = None

    class Config:
        from_attributes = True

class LigneAchatCreate(BaseModel):
    id_article: int
    quantite: Decimal
    prix_achat_ht: Decimal
    # Si fourni, prime sur prix_achat_ht pour le calcul du total de ligne (évite l'arrondi
    # intermédiaire HT->TTC qui décale le total quand le prix est saisi en TTC côté UI).
    prix_achat_ttc: Optional[Decimal] = None
    taux_tva_achat: Decimal = Decimal('19.00')
    # Taxe additionnelle propre à certains articles (ex: droit de consommation), en % du HT,
    # appliquée en plus de la TVA. La plupart des articles n'en ont pas (0 par défaut).
    taux_taxe_supplementaire: Decimal = Decimal('0.00')
    remise_pourcentage: Decimal = Decimal('0.00')
    nouveau_prix_vente_ttc: Optional[Decimal] = None
    nouvelle_remise_vente: Optional[Decimal] = None

class LigneAchatOut(BaseModel):
    id_ligne_achat: int
    id_article: int
    quantite: Decimal
    prix_achat_ht: Decimal
    taux_tva_achat: Decimal
    taux_taxe_supplementaire: Decimal
    remise_pourcentage: Decimal
    prix_achat_ttc: Decimal
    montant_ligne_ttc: Decimal
    nouveau_prix_vente_ttc: Optional[Decimal] = None
    nouvelle_remise_vente: Optional[Decimal] = None
    article: Optional[ArticleInLigne] = None

    class Config:
        from_attributes = True

class AchatUpdate(BaseModel):
    numero_facture_fournisseur: Optional[str] = None
    date_achat: Optional[date] = None
    notes: Optional[str] = None

class AchatCreate(BaseModel):
    id_fournisseur: int
    numero_facture_fournisseur: Optional[str] = None
    date_achat: Optional[date] = None
    notes: Optional[str] = None
    lignes: List[LigneAchatCreate]

class FournisseurInAchat(BaseModel):
    id_fournisseur: int
    nom: str
    telephone: Optional[str] = None
    email: Optional[str] = None
    adresse: Optional[str] = None
    class Config:
        from_attributes = True

class AchatOut(BaseModel):
    id_achat: int
    numero_facture_fournisseur: Optional[str]
    id_fournisseur: int
    fournisseur: Optional[FournisseurInAchat] = None
    date_achat: date
    montant_ht: Decimal
    montant_tva: Decimal
    montant_taxe_supplementaire: Decimal = Decimal('0.000')
    montant_ttc: Decimal
    montant_paye: Decimal
    montant_restant: Decimal
    statut_paiement: str
    notes: Optional[str]
    date_creation: datetime
    lignes: List[LigneAchatOut] = []

    class Config:
        from_attributes = True

# --- DOCUMENTS (DEVIS / BL / FACTURE RAPIDE) ---
class LigneDocumentCreate(BaseModel):
    id_article: int
    quantite: Decimal
    quantite_livree: Optional[Decimal] = None  # None = automatic (full delivery for POS/BL, 0 for devis)
    prix_unitaire_ttc: Decimal
    remise_pourcentage: Decimal = Decimal('0.00')


class LigneDocumentOut(BaseModel):
    id_ligne: int
    id_article: int
    quantite: Decimal
    quantite_livree: Decimal
    quantite_restante_a_livrer: Decimal
    statut_livraison: str
    prix_unitaire_ttc: Decimal
    remise_pourcentage: Decimal
    prix_unitaire_apres_remise: Decimal
    ordre_affichage: Optional[int]
    article: Optional[ArticleInLigne] = None
    quantite_retournee: Decimal = Decimal('0.000')

    class Config:
        from_attributes = True

class DocumentCreate(BaseModel):
    type_document: str  # devis, bon_livraison, facture_rapide
    id_client: Optional[int] = None  # None = utilise le client "Passage" automatiquement
    id_document_origine: Optional[int] = None
    notes: Optional[str] = None
    lignes: List[LigneDocumentCreate]
    send_whatsapp: Optional[bool] = False

class DocumentOut(BaseModel):
    id_document: int
    type_document: str
    numero: str
    id_client: int
    id_utilisateur: Optional[int]
    id_document_origine: Optional[int]
    date_document: datetime
    montant_ttc_sans_remise: Decimal
    montant_remise: Decimal
    montant_ttc_final: Decimal
    montant_retourne: Decimal = Decimal('0.000')
    montant_paye: Decimal
    montant_restant: Decimal
    statut: str
    statut_livraison: str
    facture_dans_facturation: bool
    notes: Optional[str]
    lignes: List[LigneDocumentOut] = []

    class Config:
        from_attributes = True

class DeliveryItemInput(BaseModel):
    id_ligne: int
    quantite_a_livrer: Decimal

class DeliveryBatchCreate(BaseModel):
    livraisons: List[DeliveryItemInput]
    notes: Optional[str] = None

# --- BONS DE RETOUR ---
class LigneRetourCreate(BaseModel):
    id_article: int
    quantite: Decimal
    prix_unitaire_ttc: Decimal

class LigneRetourOut(BaseModel):
    id_ligne_retour: int
    id_article: int
    quantite: Decimal
    prix_unitaire_ttc: Decimal
    article: Optional[ArticleMinOut] = None

    class Config:
        from_attributes = True

class BonRetourCreate(BaseModel):
    id_document: Optional[int] = None
    id_client: int
    motif: Optional[str] = None
    mode_remboursement: str = "credit"  # credit, especes
    lignes: List[LigneRetourCreate]
    send_whatsapp: Optional[bool] = False

class BonRetourOut(BaseModel):
    id_retour: int
    numero: str
    id_document: Optional[int]
    numero_document: Optional[str] = None
    id_client: int
    date_retour: datetime
    montant_ttc: Decimal
    motif: Optional[str]
    statut: str
    facture_dans_facturation: bool = False
    mode_remboursement: str = "credit"
    lignes: List[LigneRetourOut] = []

    class Config:
        from_attributes = True

# --- FACTURATION ---
class FacturationCreate(BaseModel):
    id_client: int
    document_ids: List[int]  # List of bon_livraison IDs to invoice
    retour_ids: List[int] = [] # List of bon_retour IDs to include
    periode_debut: Optional[date] = None
    periode_fin: Optional[date] = None
    remise_pct: Optional[Decimal] = Decimal('0.00')
    montant_timbre: Optional[Decimal] = Decimal('1.000')  # Droit de timbre fiscal
    mode_traitement_retours: str = "soustraction" # "soustraction" ou "separer"

class FacturationUpdate(BaseModel):
    document_ids: Optional[List[int]] = None  # Nouveaux BLs à regrouper
    retour_ids: Optional[List[int]] = None    # Nouveaux Retours à regrouper
    remise_pct: Optional[Decimal] = None       # Remise globale % sur TTC
    montant_timbre: Optional[Decimal] = None    # Droit de timbre fiscal
    numero_facture: Optional[str] = None        # Modifier le numéro manuellement
    periode_debut: Optional[date] = None
    periode_fin: Optional[date] = None
    mode_traitement_retours: Optional[str] = None

class DocumentLieOut(BaseModel):
    id_document: int
    numero: str
    date_document: datetime
    montant_ttc_final: Decimal
    montant_retourne: Decimal = Decimal('0.000')
    statut: str

    class Config:
        from_attributes = True

class RetourLieOut(BaseModel):
    id_retour: int
    numero: str
    date_retour: datetime
    montant_ttc: Decimal
    statut: str

    class Config:
        from_attributes = True

class ArticleMinOut(BaseModel):
    id_article: int
    nom: str
    reference: Optional[str] = None

    class Config:
        from_attributes = True

class LigneFacturationOut(BaseModel):
    id_ligne_facturation: int
    id_article: int
    quantite_totale: Decimal
    prix_unitaire_moyen_ht: Decimal
    taux_tva: Decimal
    montant_ht: Decimal
    montant_tva: Decimal
    montant_ttc: Decimal
    article: Optional[ArticleMinOut] = None

    class Config:
        from_attributes = True

class FacturationOut(BaseModel):
    id_facturation: int
    numero_facture: str
    id_client: int
    periode_debut: Optional[date]
    periode_fin: Optional[date]
    date_facturation: datetime
    montant_ht: Decimal
    montant_tva: Decimal
    montant_timbre: Decimal = Decimal('1.000')
    montant_ttc: Decimal
    montant_retourne: Decimal = Decimal('0.000')
    montant_paye: Decimal
    montant_restant: Decimal
    remise_pct: Optional[Decimal] = Decimal('0.00')
    statut: str
    lignes: List[LigneFacturationOut] = []
    retours: List[RetourLieOut] = []
    client: Optional[ClientOut] = None

    class Config:
        from_attributes = True

# --- REGLEMENTS ---
class ReglementCreate(BaseModel):
    id_client: int
    id_document: Optional[int] = None
    id_facturation: Optional[int] = None
    montant: Decimal
    mode_paiement: str  # espece, cheque, virement, carte, traite
    reference_paiement: Optional[str] = None
    date_echeance: Optional[date] = None
    notes: Optional[str] = None
    send_whatsapp: Optional[bool] = False

class ReglementOut(ReglementCreate):
    id_reglement: int
    numero: Optional[str]
    statut_cheque: Optional[str]
    date_reglement: datetime
    id_utilisateur: Optional[int]
    numero_document: Optional[str] = None
    numero_facturation: Optional[str] = None

    class Config:
        from_attributes = True

class ReglementFournisseurCreate(BaseModel):
    id_fournisseur: int
    id_achat: Optional[int] = None
    montant: Decimal
    mode_paiement: str
    reference_paiement: Optional[str] = None
    date_echeance: Optional[date] = None
    notes: Optional[str] = None

class ReglementFournisseurOut(ReglementFournisseurCreate):
    id_reglement_fournisseur: int
    numero: Optional[str]
    statut_cheque: Optional[str]
    date_reglement: datetime
    id_utilisateur: Optional[int]

    class Config:
        from_attributes = True

class StatutChequeUpdate(BaseModel):
    statut_cheque: str  # en_attente, encaisse, rejete

# --- RELANCES CREDIT ---
class RelanceCreate(BaseModel):
    id_client: int
    date_planifiee: Optional[date] = None  # jour précis choisi manuellement, prime sur delai_override_jours
    delai_override_jours: Optional[int] = None
    canal_prevu: str = "automatique"
    notes: Optional[str] = None

class RelanceUpdate(BaseModel):
    statut: str  # effectuee, annulee, reportee
    canal_utilise: Optional[str] = None
    notes: Optional[str] = None

class RelanceOut(BaseModel):
    id_relance: int
    id_client: int
    date_planifiee: date
    delai_jours_utilise: int
    solde_au_moment: Optional[Decimal]
    canal_prevu: str
    canal_utilise: Optional[str]
    statut: str
    date_execution: Optional[datetime]
    notes: Optional[str]
    date_creation: datetime
    client: Optional[ClientOut] = None

    class Config:
        from_attributes = True

# --- LOGS ---
class LogActionOut(BaseModel):
    id_log: int
    id_utilisateur: Optional[int]
    type_action: str
    table_concernee: Optional[str]
    id_enregistrement: Optional[int]
    description: Optional[str]
    adresse_ip: Optional[str]
    date_action: datetime
    utilisateur: Optional[UserOut] = None

    class Config:
        from_attributes = True
