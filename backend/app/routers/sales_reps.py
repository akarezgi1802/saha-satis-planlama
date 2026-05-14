from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import SalesRep
from ..schemas import SalesRepCreate, SalesRepUpdate, SalesRepOut

router = APIRouter(prefix="/api/sales-reps", tags=["Satis Temsilcileri"])


@router.get("/", response_model=list[SalesRepOut])
def list_sales_reps(db: Session = Depends(get_db)):
    return db.query(SalesRep).all()


@router.get("/{rep_id}", response_model=SalesRepOut)
def get_sales_rep(rep_id: int, db: Session = Depends(get_db)):
    rep = db.query(SalesRep).filter(SalesRep.id == rep_id).first()
    if not rep:
        raise HTTPException(status_code=404, detail="Satis temsilcisi bulunamadi")
    return rep


@router.post("/", response_model=SalesRepOut, status_code=201)
def create_sales_rep(data: SalesRepCreate, db: Session = Depends(get_db)):
    rep = SalesRep(**data.model_dump())
    db.add(rep)
    db.commit()
    db.refresh(rep)
    return rep


@router.put("/{rep_id}", response_model=SalesRepOut)
def update_sales_rep(rep_id: int, data: SalesRepUpdate, db: Session = Depends(get_db)):
    rep = db.query(SalesRep).filter(SalesRep.id == rep_id).first()
    if not rep:
        raise HTTPException(status_code=404, detail="Satis temsilcisi bulunamadi")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(rep, key, value)
    db.commit()
    db.refresh(rep)
    return rep


@router.delete("/{rep_id}")
def delete_sales_rep(rep_id: int, db: Session = Depends(get_db)):
    rep = db.query(SalesRep).filter(SalesRep.id == rep_id).first()
    if not rep:
        raise HTTPException(status_code=404, detail="Satis temsilcisi bulunamadi")
    db.delete(rep)
    db.commit()
    return {"detail": "Satis temsilcisi silindi"}
