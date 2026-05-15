from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from ..database import get_db
from ..models import User, Campaign
from ..schemas import CampaignCreate, CampaignUpdate, CampaignOut
from ..auth import get_current_user, require_admin

router = APIRouter(prefix="/api/campaigns", tags=["campaigns"])

# Frito-Lay marka portföyü — admin'in seçebileceği sabit liste
ALLOWED_BRANDS = ["Lay's", "Doritos", "Cheetos", "Ruffles", "Cipsi", "Tang"]


@router.get("/brands")
def list_brands():
    """Mobil app ve admin panel dropdown için marka listesi."""
    return {"brands": ALLOWED_BRANDS}


@router.get("/", response_model=list[CampaignOut])
def list_campaigns(
    active_only: bool = Query(True),
    brand: str | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(Campaign)
    if active_only:
        today = date.today()
        q = q.filter(Campaign.is_active == 1)
        # Geçerli tarih aralığı (null'lar geçerli sayılır)
        q = q.filter(
            or_(Campaign.valid_from == None, Campaign.valid_from <= today)
        )
        q = q.filter(
            or_(Campaign.valid_until == None, Campaign.valid_until >= today)
        )
    if brand:
        q = q.filter(Campaign.brand == brand)

    campaigns = q.order_by(Campaign.created_at.desc()).limit(100).all()
    result = []
    for c in campaigns:
        author = db.query(User).filter(User.id == c.author_id).first()
        result.append(CampaignOut(
            id=c.id,
            title=c.title,
            brand=c.brand,
            description=c.description,
            discount_text=c.discount_text,
            valid_from=c.valid_from,
            valid_until=c.valid_until,
            author_id=c.author_id,
            author_name=author.full_name if author else "—",
            is_active=c.is_active,
            created_at=c.created_at,
        ))
    return result


@router.post("/", response_model=CampaignOut, status_code=201)
def create_campaign(
    body: CampaignCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    if body.brand not in ALLOWED_BRANDS:
        raise HTTPException(
            status_code=400,
            detail=f"Geçersiz marka. Geçerli olanlar: {', '.join(ALLOWED_BRANDS)}",
        )
    if body.valid_from and body.valid_until and body.valid_from > body.valid_until:
        raise HTTPException(status_code=400, detail="Başlangıç bitişten sonra olamaz")

    camp = Campaign(
        title=body.title,
        brand=body.brand,
        description=body.description,
        discount_text=body.discount_text,
        valid_from=body.valid_from,
        valid_until=body.valid_until,
        author_id=admin.id,
    )
    db.add(camp)
    db.commit()
    db.refresh(camp)
    return CampaignOut(
        id=camp.id, title=camp.title, brand=camp.brand,
        description=camp.description, discount_text=camp.discount_text,
        valid_from=camp.valid_from, valid_until=camp.valid_until,
        author_id=camp.author_id, author_name=admin.full_name,
        is_active=camp.is_active, created_at=camp.created_at,
    )


@router.put("/{campaign_id}", response_model=CampaignOut)
def update_campaign(
    campaign_id: int,
    body: CampaignUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    camp = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not camp:
        raise HTTPException(status_code=404, detail="Kampanya bulunamadı")
    if body.brand and body.brand not in ALLOWED_BRANDS:
        raise HTTPException(status_code=400, detail="Geçersiz marka")

    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(camp, k, v)

    if camp.valid_from and camp.valid_until and camp.valid_from > camp.valid_until:
        raise HTTPException(status_code=400, detail="Başlangıç bitişten sonra olamaz")

    db.commit()
    db.refresh(camp)
    author = db.query(User).filter(User.id == camp.author_id).first()
    return CampaignOut(
        id=camp.id, title=camp.title, brand=camp.brand,
        description=camp.description, discount_text=camp.discount_text,
        valid_from=camp.valid_from, valid_until=camp.valid_until,
        author_id=camp.author_id, author_name=author.full_name if author else "—",
        is_active=camp.is_active, created_at=camp.created_at,
    )


@router.delete("/{campaign_id}")
def delete_campaign(
    campaign_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    camp = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not camp:
        raise HTTPException(status_code=404, detail="Kampanya bulunamadı")
    db.delete(camp)
    db.commit()
    return {"detail": "Kampanya silindi"}
