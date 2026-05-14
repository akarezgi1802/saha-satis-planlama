from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, timedelta

from ..database import get_db
from ..models import User, Customer, SalesVisit
from ..schemas import SalesVisitCreate, SalesVisitOut
from ..auth import get_current_user, require_admin

router = APIRouter(prefix="/api/performance", tags=["performance"])


@router.post("/visits", response_model=SalesVisitOut)
def create_visit(
    body: SalesVisitCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    cust = db.query(Customer).filter(Customer.id == body.customer_id).first()
    if not cust:
        raise HTTPException(status_code=404, detail="Müşteri bulunamadı")

    existing = db.query(SalesVisit).filter(
        SalesVisit.user_id == user.id,
        SalesVisit.customer_id == body.customer_id,
        SalesVisit.visit_date == body.visit_date,
    ).first()
    if existing:
        existing.sale_amount = body.sale_amount
        existing.visited = body.visited
        existing.notes = body.notes
        db.commit()
        db.refresh(existing)
        return SalesVisitOut(
            **{c.name: getattr(existing, c.name) for c in existing.__table__.columns},
            customer_name=cust.name,
        )

    visit = SalesVisit(
        user_id=user.id,
        customer_id=body.customer_id,
        visit_date=body.visit_date,
        sale_amount=body.sale_amount,
        visited=body.visited,
        notes=body.notes,
    )
    db.add(visit)
    db.commit()
    db.refresh(visit)
    return SalesVisitOut(
        **{c.name: getattr(visit, c.name) for c in visit.__table__.columns},
        customer_name=cust.name,
    )


@router.get("/visits")
def list_visits(
    start_date: date = Query(None),
    end_date: date = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(SalesVisit).filter(SalesVisit.user_id == user.id)
    if start_date:
        q = q.filter(SalesVisit.visit_date >= start_date)
    if end_date:
        q = q.filter(SalesVisit.visit_date <= end_date)
    visits = q.order_by(SalesVisit.visit_date.desc()).all()

    result = []
    for v in visits:
        cust = db.query(Customer).filter(Customer.id == v.customer_id).first()
        result.append(SalesVisitOut(
            **{c.name: getattr(v, c.name) for c in v.__table__.columns},
            customer_name=cust.name if cust else "—",
        ))
    return result


@router.delete("/visits/{visit_id}")
def delete_visit(
    visit_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    visit = db.query(SalesVisit).filter(
        SalesVisit.id == visit_id, SalesVisit.user_id == user.id
    ).first()
    if not visit:
        raise HTTPException(status_code=404, detail="Kayıt bulunamadı")
    db.delete(visit)
    db.commit()
    return {"detail": "Silindi"}


@router.get("/summary")
def get_summary(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)

    def stats_for_range(start, end):
        q = db.query(SalesVisit).filter(
            SalesVisit.user_id == user.id,
            SalesVisit.visit_date >= start,
            SalesVisit.visit_date <= end,
        )
        visits = q.all()
        total_sales = sum(v.sale_amount for v in visits)
        visit_count = sum(1 for v in visits if v.visited)
        customer_count = len(set(v.customer_id for v in visits))
        return {
            "total_sales": total_sales,
            "visit_count": visit_count,
            "customer_count": customer_count,
        }

    daily = stats_for_range(today, today)
    weekly = stats_for_range(week_start, today)
    monthly = stats_for_range(month_start, today)

    daily_breakdown = []
    for i in range(7):
        d = week_start + timedelta(days=i)
        day_visits = db.query(SalesVisit).filter(
            SalesVisit.user_id == user.id,
            SalesVisit.visit_date == d,
        ).all()
        daily_breakdown.append({
            "date": d.isoformat(),
            "day_name": ["Pzt", "Salı", "Çar", "Per", "Cum", "Cmt", "Paz"][d.weekday()],
            "sales": sum(v.sale_amount for v in day_visits),
            "visits": sum(1 for v in day_visits if v.visited),
        })

    return {
        "today": daily,
        "this_week": weekly,
        "this_month": monthly,
        "daily_breakdown": daily_breakdown,
    }


@router.get("/admin/all")
def admin_all_performance(
    start_date: date = Query(None),
    end_date: date = Query(None),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    today_ = date.today()
    if not start_date:
        start_date = today_ - timedelta(days=today_.weekday())
    if not end_date:
        end_date = today_

    reps = db.query(User).filter(User.role == "sales_rep").order_by(User.full_name).all()
    result = []
    for rep in reps:
        visits = db.query(SalesVisit).filter(
            SalesVisit.user_id == rep.id,
            SalesVisit.visit_date >= start_date,
            SalesVisit.visit_date <= end_date,
        ).all()

        total_sales = sum(v.sale_amount for v in visits)
        visit_count = sum(1 for v in visits if v.visited)
        customer_count = len(set(v.customer_id for v in visits))

        daily = {}
        for v in visits:
            d_str = v.visit_date.isoformat()
            if d_str not in daily:
                daily[d_str] = {"date": d_str, "sales": 0, "visits": 0}
            daily[d_str]["sales"] += v.sale_amount
            if v.visited:
                daily[d_str]["visits"] += 1

        result.append({
            "user_id": rep.id,
            "full_name": rep.full_name,
            "email": rep.email,
            "cluster_index": rep.cluster_index,
            "is_active": rep.is_active,
            "total_sales": total_sales,
            "visit_count": visit_count,
            "customer_count": customer_count,
            "daily_breakdown": sorted(daily.values(), key=lambda x: x["date"]),
        })

    return result


@router.get("/admin/visits")
def admin_list_visits(
    user_id: int = Query(None),
    start_date: date = Query(None),
    end_date: date = Query(None),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    q = db.query(SalesVisit)
    if user_id:
        q = q.filter(SalesVisit.user_id == user_id)
    if start_date:
        q = q.filter(SalesVisit.visit_date >= start_date)
    if end_date:
        q = q.filter(SalesVisit.visit_date <= end_date)

    visits = q.order_by(SalesVisit.visit_date.desc()).limit(500).all()
    result = []
    for v in visits:
        cust = db.query(Customer).filter(Customer.id == v.customer_id).first()
        user = db.query(User).filter(User.id == v.user_id).first()
        result.append({
            "id": v.id,
            "user_id": v.user_id,
            "user_name": user.full_name if user else "—",
            "customer_id": v.customer_id,
            "customer_name": cust.name if cust else "—",
            "visit_date": v.visit_date.isoformat(),
            "sale_amount": v.sale_amount,
            "visited": v.visited,
            "notes": v.notes,
        })
    return result
