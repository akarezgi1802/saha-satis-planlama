from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, Announcement
from ..schemas import AnnouncementCreate, AnnouncementOut
from ..auth import get_current_user, require_admin

router = APIRouter(prefix="/api/announcements", tags=["announcements"])


@router.get("/", response_model=list[AnnouncementOut])
def list_announcements(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    anns = db.query(Announcement).filter(
        Announcement.is_active == 1
    ).order_by(Announcement.created_at.desc()).limit(50).all()

    result = []
    for a in anns:
        author = db.query(User).filter(User.id == a.author_id).first()
        result.append(AnnouncementOut(
            id=a.id,
            title=a.title,
            content=a.content,
            category=a.category,
            author_id=a.author_id,
            author_name=author.full_name if author else "—",
            is_active=a.is_active,
            created_at=a.created_at,
        ))
    return result


@router.post("/", response_model=AnnouncementOut, status_code=201)
def create_announcement(
    body: AnnouncementCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    ann = Announcement(
        title=body.title,
        content=body.content,
        category=body.category,
        author_id=admin.id,
    )
    db.add(ann)
    db.commit()
    db.refresh(ann)
    return AnnouncementOut(
        id=ann.id,
        title=ann.title,
        content=ann.content,
        category=ann.category,
        author_id=ann.author_id,
        author_name=admin.full_name,
        is_active=ann.is_active,
        created_at=ann.created_at,
    )


@router.delete("/{ann_id}")
def delete_announcement(
    ann_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    ann = db.query(Announcement).filter(Announcement.id == ann_id).first()
    if not ann:
        raise HTTPException(status_code=404, detail="Duyuru bulunamadı")
    db.delete(ann)
    db.commit()
    return {"detail": "Duyuru silindi"}
