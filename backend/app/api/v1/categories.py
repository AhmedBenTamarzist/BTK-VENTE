from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Categorie, Utilisateur
from app.schemas import CategoryCreate, CategoryOut
from app.api.deps import get_current_user, require_roles

router = APIRouter()

@router.get("/", response_model=List[CategoryOut])
def list_categories(
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user)
):
    return db.query(Categorie).order_by(Categorie.nom.asc()).all()

@router.post("/", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(
    cat_in: CategoryCreate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_roles(["admin", "gestionnaire_stock"]))
):
    cat = Categorie(**cat_in.dict())
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat

@router.put("/{category_id}", response_model=CategoryOut)
def update_category(
    category_id: int,
    cat_in: CategoryCreate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_roles(["admin", "gestionnaire_stock"]))
):
    cat = db.query(Categorie).filter(Categorie.id_categorie == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Catégorie non trouvée")
    
    cat.nom = cat_in.nom
    cat.id_categorie_parente = cat_in.id_categorie_parente
    db.commit()
    db.refresh(cat)
    return cat
