from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import AppSettings
from ..schemas import DepotUpdate, DepotOut

router = APIRouter(prefix="/api/settings", tags=["Ayarlar"])

DEFAULT_DEPOT_X = 38.6567541
DEFAULT_DEPOT_Y = 27.3435846


def _get_or_create_settings(db: Session) -> AppSettings:
    s = db.query(AppSettings).first()
    if not s:
        s = AppSettings(id=1, depot_x=DEFAULT_DEPOT_X, depot_y=DEFAULT_DEPOT_Y)
        db.add(s)
        db.commit()
        db.refresh(s)
    return s


@router.get("/depot", response_model=DepotOut)
def get_depot(db: Session = Depends(get_db)):
    s = _get_or_create_settings(db)
    return s


@router.put("/depot", response_model=DepotOut)
def update_depot(data: DepotUpdate, db: Session = Depends(get_db)):
    s = _get_or_create_settings(db)
    s.depot_x = data.depot_x
    s.depot_y = data.depot_y
    db.commit()
    db.refresh(s)
    return s
