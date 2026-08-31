from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Utilisateur
from app.schemas import Token, UserOut, UserLogin
from app.services.auth_service import verify_password, create_access_token
from app.api.deps import get_current_user

router = APIRouter()

@router.post("/login", response_model=Token)
def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = db.query(Utilisateur).filter(Utilisateur.email == form_data.username, Utilisateur.actif == True).first()
    if not user or not verify_password(form_data.password, user.mot_de_passe_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(data={"sub": user.email, "role": user.role, "id": user.id_utilisateur})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user.id_utilisateur,
        "nom": user.nom,
        "prenom": user.prenom,
        "role": user.role
    }

@router.get("/me", response_model=UserOut)
def read_current_user(current_user: Utilisateur = Depends(get_current_user)):
    return current_user
