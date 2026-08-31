from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import LogAction, Utilisateur
from app.schemas import LogActionOut
from app.api.deps import require_roles

router = APIRouter()

@router.get("/", response_model=List[LogActionOut])
def list_logs(
    table_concernee: Optional[str] = Query(None),
    id_utilisateur: Optional[int] = Query(None),
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_roles(["admin"]))
):
    query = db.query(LogAction)
    if table_concernee:
        query = query.filter(LogAction.table_concernee == table_concernee)
    if id_utilisateur:
        query = query.filter(LogAction.id_utilisateur == id_utilisateur)
    return query.order_by(LogAction.date_action.desc()).limit(limit).all()
