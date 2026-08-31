from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import ParametresEntreprise, Utilisateur
from app.schemas import EnterpriseSchema, EnterpriseOut
from app.api.deps import get_current_user, require_roles

router = APIRouter()

@router.get("/", response_model=EnterpriseOut)
def get_enterprise_settings(db: Session = Depends(get_db)):
    settings_obj = db.query(ParametresEntreprise).first()
    if not settings_obj:
        # Default placeholder
        settings_obj = ParametresEntreprise(
            raison_sociale="Quincaillerie Générale",
            matricule_fiscal="1234567/A/M/000",
            adresse="Avenue Habib Bourguiba, Tunis",
            telephone="+216 71 000 000",
            email="contact@quincaillerie.tn"
        )
        db.add(settings_obj)
        db.commit()
        db.refresh(settings_obj)
    return settings_obj

@router.put("/", response_model=EnterpriseOut)
def update_enterprise_settings(
    ent_in: EnterpriseSchema,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_roles(["admin"]))
):
    settings_obj = db.query(ParametresEntreprise).first()
    if not settings_obj:
        settings_obj = ParametresEntreprise(**ent_in.dict())
        db.add(settings_obj)
    else:
        for k, v in ent_in.dict(exclude_unset=True).items():
            setattr(settings_obj, k, v)

    db.commit()
    db.refresh(settings_obj)
    return settings_obj
