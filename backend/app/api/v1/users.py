from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Utilisateur
from app.schemas import UserCreate, UserUpdate, UserOut
from app.services.auth_service import get_password_hash
from app.api.deps import require_roles
from app.services.log_service import log_system_action

router = APIRouter()

@router.get("/", response_model=List[UserOut])
def list_users(
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_roles(["admin"]))
):
    return db.query(Utilisateur).all()

@router.post("/", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_roles(["admin"]))
):
    existing = db.query(Utilisateur).filter(Utilisateur.email == user_in.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Un utilisateur avec cet email existe déjà")

    db_user = Utilisateur(
        nom=user_in.nom,
        prenom=user_in.prenom,
        email=user_in.email,
        mot_de_passe_hash=get_password_hash(user_in.mot_de_passe),
        role=user_in.role,
        telephone=user_in.telephone
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    log_system_action(
        db, type_action="creation", table_concernee="utilisateurs", id_enregistrement=db_user.id_utilisateur,
        description=f"Création utilisateur {db_user.nom} {db_user.prenom or ''} ({db_user.role})".strip(),
        id_utilisateur=current_user.id_utilisateur
    )
    db.commit()
    return db_user

@router.put("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    user_in: UserUpdate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_roles(["admin"]))
):
    user = db.query(Utilisateur).filter(Utilisateur.id_utilisateur == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")

    champs_modifies = []
    if user_in.nom is not None:
        user.nom = user_in.nom
        champs_modifies.append("nom")
    if user_in.prenom is not None:
        user.prenom = user_in.prenom
        champs_modifies.append("prénom")
    if user_in.email is not None:
        user.email = user_in.email
        champs_modifies.append("email")
    if user_in.mot_de_passe is not None:
        user.mot_de_passe_hash = get_password_hash(user_in.mot_de_passe)
        champs_modifies.append("mot de passe")
    if user_in.role is not None:
        user.role = user_in.role
        champs_modifies.append(f"rôle → {user_in.role}")
    if user_in.telephone is not None:
        user.telephone = user_in.telephone
        champs_modifies.append("téléphone")
    if user_in.actif is not None:
        user.actif = user_in.actif
        champs_modifies.append("actif → " + ("oui" if user_in.actif else "non"))

    db.commit()
    db.refresh(user)

    log_system_action(
        db, type_action="modification", table_concernee="utilisateurs", id_enregistrement=user.id_utilisateur,
        description=f"Modification utilisateur {user.nom} : {', '.join(champs_modifies) or 'aucun changement'}",
        id_utilisateur=current_user.id_utilisateur
    )
    db.commit()
    return user
