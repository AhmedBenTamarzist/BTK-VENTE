from datetime import datetime
from sqlalchemy.orm import Session
from app.models import CompteurNumerotation

def generate_next_number(db: Session, type_compteur: str) -> str:
    current_year = datetime.now().year
    
    # Query row with locking FOR UPDATE to ensure atomic counter increments across multi-user environments
    compteur = (
        db.query(CompteurNumerotation)
        .filter(
            CompteurNumerotation.type_compteur == type_compteur,
            CompteurNumerotation.annee == current_year
        )
        .with_for_update()
        .first()
    )

    if not compteur:
        compteur = CompteurNumerotation(
            type_compteur=type_compteur,
            annee=current_year,
            dernier_numero=1
        )
        db.add(compteur)
        db.flush()
    else:
        compteur.dernier_numero += 1
        db.flush()

    num = compteur.dernier_numero
    year_short = str(current_year)[-2:]

    if type_compteur == "devis":
        return f"{current_year}{num:04d}"
    elif type_compteur == "bon_livraison":
        return f"BL{current_year}{num:04d}"
    elif type_compteur == "facture_rapide":
        return f"{current_year}{num:04d}"
    elif type_compteur == "facturation":
        return f"{num:04d}/{year_short}"
    elif type_compteur == "bon_retour":
        return f"BR{current_year}{num:04d}"
    elif type_compteur in ("reglement", "reglement_fournisseur"):
        return f"REG{current_year}{num:04d}"
    else:
        return f"{type_compteur.upper()}-{current_year}-{num:04d}"
