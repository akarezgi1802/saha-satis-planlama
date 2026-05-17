"""
Görev yönetimi — yöneticiler atar, sales rep'ler tamamlar.
"""
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, Customer, Task
from ..auth import get_current_user, require_admin

router = APIRouter(prefix="/api/tasks", tags=["tasks"])

PRIORITIES = ["low", "normal", "high", "urgent"]
STATUSES = ["open", "in_progress", "done", "cancelled"]


class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    assigned_to_id: int
    customer_id: Optional[int] = None
    priority: str = "normal"
    due_date: Optional[date] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    customer_id: Optional[int] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    due_date: Optional[date] = None


def _serialize_task(t: Task, db: Session) -> dict:
    customer = None
    if t.customer_id:
        c = db.query(Customer).filter(Customer.id == t.customer_id).first()
        if c:
            customer = {"id": c.id, "name": c.name}
    assigned_to = db.query(User).filter(User.id == t.assigned_to_id).first()
    assigned_by = db.query(User).filter(User.id == t.assigned_by_id).first() if t.assigned_by_id else None
    return {
        "id": t.id,
        "title": t.title,
        "description": t.description,
        "assigned_to_id": t.assigned_to_id,
        "assigned_to_name": assigned_to.full_name if assigned_to else "—",
        "assigned_by_id": t.assigned_by_id,
        "assigned_by_name": assigned_by.full_name if assigned_by else None,
        "customer": customer,
        "priority": t.priority,
        "status": t.status,
        "due_date": t.due_date.isoformat() if t.due_date else None,
        "completed_at": t.completed_at.isoformat() if t.completed_at else None,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }


@router.get("/")
def list_tasks(
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Kullanıcının kendi görevleri (sales_rep) ya da admin için tümü."""
    q = db.query(Task)
    if user.role != "admin":
        q = q.filter(Task.assigned_to_id == user.id)
    if status_filter and status_filter in STATUSES:
        q = q.filter(Task.status == status_filter)

    tasks = q.order_by(
        Task.status,  # open önce
        Task.due_date.asc().nullslast(),
        Task.created_at.desc(),
    ).limit(200).all()
    return [_serialize_task(t, db) for t in tasks]


@router.get("/summary")
def task_summary(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Kullanıcının görev özeti (dashboard widget'ı için)."""
    q = db.query(Task).filter(Task.assigned_to_id == user.id)
    open_count = q.filter(Task.status == "open").count()
    in_progress_count = q.filter(Task.status == "in_progress").count()
    done_count = q.filter(Task.status == "done").count()

    today = date.today()
    overdue = q.filter(
        Task.due_date < today,
        Task.status.in_(["open", "in_progress"]),
    ).count()
    due_today = q.filter(
        Task.due_date == today,
        Task.status.in_(["open", "in_progress"]),
    ).count()

    return {
        "open": open_count,
        "in_progress": in_progress_count,
        "done": done_count,
        "overdue": overdue,
        "due_today": due_today,
        "total_active": open_count + in_progress_count,
    }


@router.post("/", status_code=201)
def create_task(
    body: TaskCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    if body.priority not in PRIORITIES:
        raise HTTPException(status_code=400, detail=f"Geçersiz öncelik: {PRIORITIES}")
    if not db.query(User).filter(User.id == body.assigned_to_id).first():
        raise HTTPException(status_code=404, detail="Atanan kullanıcı bulunamadı")

    task = Task(
        title=body.title,
        description=body.description,
        assigned_to_id=body.assigned_to_id,
        assigned_by_id=admin.id,
        customer_id=body.customer_id,
        priority=body.priority,
        due_date=body.due_date,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return _serialize_task(task, db)


@router.put("/{task_id}")
def update_task(
    task_id: int,
    body: TaskUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Görev bulunamadı")

    # Sales rep sadece kendi görevini düzenleyebilir, sadece status alanını
    if user.role != "admin" and task.assigned_to_id != user.id:
        raise HTTPException(status_code=403, detail="Bu görevi değiştirme yetkin yok")

    data = body.model_dump(exclude_unset=True)
    if "priority" in data and data["priority"] not in PRIORITIES:
        raise HTTPException(status_code=400, detail="Geçersiz öncelik")
    if "status" in data:
        if data["status"] not in STATUSES:
            raise HTTPException(status_code=400, detail="Geçersiz durum")
        # Sales rep yalnızca status değiştirebilir
        if user.role != "admin":
            data = {"status": data["status"]}
        if data.get("status") == "done" and task.status != "done":
            task.completed_at = datetime.utcnow()
        elif data.get("status") != "done":
            task.completed_at = None

    for k, v in data.items():
        setattr(task, k, v)

    db.commit()
    db.refresh(task)
    return _serialize_task(task, db)


@router.delete("/{task_id}")
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Görev bulunamadı")
    db.delete(task)
    db.commit()
    return {"detail": "Görev silindi"}
