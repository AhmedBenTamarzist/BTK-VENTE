from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Fournisseur, Utilisateur
from app.schemas import FournisseurCreate, FournisseurUpdate, FournisseurOut
from app.api.deps import get_current_user, require_roles
from app.services.log_service import log_system_action

router = APIRouter()

@router.get("/", response_model=List[FournisseurOut])
def list_fournisseurs(
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user)
):
    query = db.query(Fournisseur).filter(Fournisseur.actif == True)
    if search:
        s = f"%{search}%"
        query = query.filter((Fournisseur.nom.ilike(s)) | (Fournisseur.telephone.ilike(s)))
    return query.order_by(Fournisseur.nom.asc()).all()

@router.get("/{fournisseur_id}", response_model=FournisseurOut)
def get_fournisseur(
    fournisseur_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user)
):
    f = db.query(Fournisseur).filter(Fournisseur.id_fournisseur == fournisseur_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Fournisseur non trouvé")
    return f

@router.post("/", response_model=FournisseurOut, status_code=status.HTTP_201_CREATED)
def create_fournisseur(
    fourn_in: FournisseurCreate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_roles(["admin", "gestionnaire_stock"]))
):
    f = Fournisseur(**fourn_in.dict())
    db.add(f)
    db.commit()
    db.refresh(f)

    log_system_action(
        db, type_action="creation", table_concernee="fournisseurs", id_enregistrement=f.id_fournisseur,
        description=f"Création fournisseur {f.nom}", id_utilisateur=current_user.id_utilisateur
    )
    db.commit()
    return f

@router.put("/{fournisseur_id}", response_model=FournisseurOut)
def update_fournisseur(
    fournisseur_id: int,
    fourn_in: FournisseurUpdate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_roles(["admin", "gestionnaire_stock"]))
):
    f = db.query(Fournisseur).filter(Fournisseur.id_fournisseur == fournisseur_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Fournisseur non trouvé")

    for field, val in fourn_in.dict(exclude_unset=True).items():
        setattr(f, field, val)

    db.commit()
    db.refresh(f)
    return f
