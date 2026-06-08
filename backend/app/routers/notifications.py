"""Kullanıcıya özel bildirimler (bölge değişikliği vb.)."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Notification, User
from ..schemas import NotificationOut
from ..auth import get_current_user

router = APIRouter(prefix="/api/notifications", tags=["Bildirimler"])


def create_notification(db: Session, user_id: int, title: str, message: str, type: str = "info"):
    """Yardımcı: bir kullanıcıya bildirim oluşturur (commit etmez, çağıran commit eder)."""
    notif = Notification(user_id=user_id, title=title, message=message, type=type)
    db.add(notif)
    return notif


@router.get("", response_model=list[NotificationOut])
@router.get("/", response_model=list[NotificationOut])
def list_notifications(
    limit: int = 50,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return (
        db.query(Notification)
        .filter(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(min(limit, 100))
        .all()
    )


@router.get("/unread-count")
def unread_count(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    count = (
        db.query(Notification)
        .filter(Notification.user_id == user.id, Notification.is_read == 0)
        .count()
    )
    return {"count": count}


@router.post("/{notif_id}/read")
def mark_read(
    notif_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    notif = db.query(Notification).filter(
        Notification.id == notif_id, Notification.user_id == user.id
    ).first()
    if not notif:
        raise HTTPException(404, "Bildirim bulunamadı")
    notif.is_read = 1
    db.commit()
    return {"detail": "okundu"}


@router.post("/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    db.query(Notification).filter(
        Notification.user_id == user.id, Notification.is_read == 0
    ).update({"is_read": 1})
    db.commit()
    return {"detail": "tümü okundu"}


@router.delete("/{notif_id}")
def delete_notification(
    notif_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    notif = db.query(Notification).filter(
        Notification.id == notif_id, Notification.user_id == user.id
    ).first()
    if not notif:
        raise HTTPException(404, "Bildirim bulunamadı")
    db.delete(notif)
    db.commit()
    return {"detail": "silindi"}
