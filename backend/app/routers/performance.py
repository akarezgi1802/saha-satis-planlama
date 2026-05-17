import math
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..database import get_db
from ..models import User, Customer, SalesVisit, Plan, DailyRoute, RouteStop, WeeklyAssignment
from ..schemas import SalesVisitCreate, SalesVisitOut
from ..auth import get_current_user, require_admin


def _haversine_m(lat1, lon1, lat2, lon2):
    """İki nokta arası mesafe (metre)."""
    R = 6371000
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    return 2 * R * math.asin(math.sqrt(a))


class CheckInRequest(BaseModel):
    customer_id: int
    lat: float
    lng: float

# ── Sürdürülebilirlik sabitleri ──
# Naif rotalama (rastgele/kronolojik) vs. optimize: tipik ~30% daha kısa
# Yani tasarruf oranı = (naif - opt) / naif = 0.30 → naif = opt / 0.70 → ek tasarruf = opt × (1/0.70 - 1) ≈ opt × 0.43
NAIVE_OVERHEAD_RATIO = 0.43
# Orta sınıf binek araç CO2 emisyonu (kg/km)
CO2_PER_KM = 0.18
# 1 ağacın 1 yılda yuttuğu ortalama CO2 (kg)
CO2_PER_TREE_YEAR = 22.0


def _user_latest_plan(db, user):
    """Kullanıcının cluster_index'ine sahip son tamamlanmış planı bul."""
    if user.cluster_index is None:
        return None
    return (
        db.query(Plan)
        .filter(Plan.status == "completed")
        .order_by(Plan.created_at.desc())
        .first()
    )

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


@router.post("/check-in")
def check_in(
    body: CheckInRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """GPS check-in: müşteriye geldim. Mesafe doğrulanır, ziyaret kaydı açılır."""
    customer = db.query(Customer).filter(Customer.id == body.customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Müşteri bulunamadı")

    distance_m = _haversine_m(body.lat, body.lng, customer.x, customer.y)
    today = date.today()
    now = datetime.utcnow()

    # Bugünkü mevcut ziyaret kaydını bul/oluştur
    visit = db.query(SalesVisit).filter(
        SalesVisit.user_id == user.id,
        SalesVisit.customer_id == body.customer_id,
        SalesVisit.visit_date == today,
    ).first()

    if visit:
        # Zaten check-in yapılmışsa hata
        if visit.check_in_at and not visit.check_out_at:
            return {
                "detail": "Zaten check-in yapılmış",
                "check_in_at": visit.check_in_at.isoformat(),
                "distance_m": round(visit.distance_from_customer_m or 0, 1),
                "already_in": True,
            }
        visit.check_in_at = now
        visit.check_in_lat = body.lat
        visit.check_in_lng = body.lng
        visit.distance_from_customer_m = distance_m
        visit.check_out_at = None  # eski check-out'u temizle
    else:
        visit = SalesVisit(
            user_id=user.id,
            customer_id=body.customer_id,
            visit_date=today,
            visited=0,  # henüz tamamlanmadı, sadece check-in
            sale_amount=0,
            check_in_at=now,
            check_in_lat=body.lat,
            check_in_lng=body.lng,
            distance_from_customer_m=distance_m,
        )
        db.add(visit)

    db.commit()
    db.refresh(visit)

    return {
        "detail": "Check-in başarılı",
        "visit_id": visit.id,
        "check_in_at": visit.check_in_at.isoformat(),
        "distance_m": round(distance_m, 1),
        "within_50m": distance_m <= 50,
        "within_200m": distance_m <= 200,
    }


@router.post("/check-out/{customer_id}")
def check_out(
    customer_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Ziyaret tamamlandı: check-out timestamp + süre hesaplanır."""
    today = date.today()
    visit = db.query(SalesVisit).filter(
        SalesVisit.user_id == user.id,
        SalesVisit.customer_id == customer_id,
        SalesVisit.visit_date == today,
    ).first()
    if not visit:
        raise HTTPException(status_code=404, detail="Bugün için check-in kaydı yok")
    if not visit.check_in_at:
        raise HTTPException(status_code=400, detail="Önce check-in yapılmalı")
    if visit.check_out_at:
        return {
            "detail": "Zaten check-out yapılmış",
            "duration_minutes": round(
                (visit.check_out_at - visit.check_in_at).total_seconds() / 60, 1
            ),
        }

    visit.check_out_at = datetime.utcnow()
    duration_sec = (visit.check_out_at - visit.check_in_at).total_seconds()
    db.commit()

    return {
        "detail": "Check-out başarılı",
        "visit_id": visit.id,
        "duration_minutes": round(duration_sec / 60, 1),
        "duration_text": _fmt_duration(duration_sec),
    }


def _fmt_duration(seconds):
    minutes = int(seconds / 60)
    if minutes < 60:
        return f"{minutes} dakika"
    h, m = divmod(minutes, 60)
    return f"{h}sa {m}dk"


@router.get("/check-in-status/{customer_id}")
def check_in_status(
    customer_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Bugün bu müşteriye check-in var mı?"""
    today = date.today()
    visit = db.query(SalesVisit).filter(
        SalesVisit.user_id == user.id,
        SalesVisit.customer_id == customer_id,
        SalesVisit.visit_date == today,
    ).first()
    if not visit or not visit.check_in_at:
        return {"checked_in": False}

    duration_sec = None
    if visit.check_out_at:
        duration_sec = (visit.check_out_at - visit.check_in_at).total_seconds()

    return {
        "checked_in": True,
        "checked_out": visit.check_out_at is not None,
        "check_in_at": visit.check_in_at.isoformat(),
        "check_out_at": visit.check_out_at.isoformat() if visit.check_out_at else None,
        "distance_m": round(visit.distance_from_customer_m or 0, 1),
        "duration_minutes": round(duration_sec / 60, 1) if duration_sec else None,
        "duration_text": _fmt_duration(duration_sec) if duration_sec else None,
        "visit_id": visit.id,
    }


@router.get("/today-target")
def get_today_target(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Bugün için planlanmış ziyaret sayısı vs tamamlanan."""
    today_obj = date.today()
    # Pazartesi=1 ... Cumartesi=6 (backend convention)
    weekday = today_obj.weekday() + 1  # Python: Mon=0..Sun=6; backend: Mon=1..Sat=6
    if weekday == 7:  # Pazar
        return {
            "planned": 0, "completed": 0,
            "percent": 0,
            "is_weekend": True,
            "day_of_week": weekday,
        }

    plan = _user_latest_plan(db, user)
    if not plan or user.cluster_index is None:
        return {"planned": 0, "completed": 0, "percent": 0, "is_weekend": False, "day_of_week": weekday}

    planned_stops = (
        db.query(RouteStop)
        .join(DailyRoute, RouteStop.daily_route_id == DailyRoute.id)
        .filter(
            DailyRoute.plan_id == plan.id,
            DailyRoute.cluster_index == user.cluster_index,
            DailyRoute.day_of_week == weekday,
        )
        .all()
    )
    planned_count = len(planned_stops)
    planned_ids = {s.customer_id for s in planned_stops}

    completed_visits = (
        db.query(SalesVisit)
        .filter(
            SalesVisit.user_id == user.id,
            SalesVisit.visit_date == today_obj,
            SalesVisit.visited == 1,
            SalesVisit.customer_id.in_(planned_ids) if planned_ids else False,
        )
        .count()
    )

    return {
        "planned": planned_count,
        "completed": completed_visits,
        "percent": round((completed_visits / planned_count) * 100, 1) if planned_count else 0,
        "is_weekend": False,
        "day_of_week": weekday,
    }


@router.get("/sustainability")
def get_sustainability(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Optimize rotalama sayesinde tasarruf edilen CO2 + ağaç eşdeğeri."""
    today_obj = date.today()
    week_start = today_obj - timedelta(days=today_obj.weekday())

    plan = _user_latest_plan(db, user)

    def _aggregate(visits, plan):
        """Ziyaret sayısına göre kat edilen mesafeyi ve tasarrufu hesapla."""
        if not visits or not plan or user.cluster_index is None:
            return {"visits": len(visits), "km_actual": 0, "km_saved": 0,
                    "co2_saved_kg": 0, "trees_equivalent": 0}

        # User'ın haftalık planındaki toplam mesafe
        weekly_routes = db.query(DailyRoute).filter(
            DailyRoute.plan_id == plan.id,
            DailyRoute.cluster_index == user.cluster_index,
        ).all()
        weekly_plan_km = sum(r.total_distance or 0 for r in weekly_routes)
        total_stops_in_plan = sum(r.customer_count or 0 for r in weekly_routes)

        if total_stops_in_plan == 0:
            return {"visits": len(visits), "km_actual": 0, "km_saved": 0,
                    "co2_saved_kg": 0, "trees_equivalent": 0}

        # Optimize rota ile kat edilen yaklaşık mesafe
        km_per_visit = weekly_plan_km / total_stops_in_plan
        km_actual = len(visits) * km_per_visit
        # Naif rotalama olsaydı bu kadar fazla yol giderdi
        km_saved = km_actual * NAIVE_OVERHEAD_RATIO
        co2_saved = km_saved * CO2_PER_KM
        trees = co2_saved / CO2_PER_TREE_YEAR
        return {
            "visits": len(visits),
            "km_actual": round(km_actual, 1),
            "km_saved": round(km_saved, 1),
            "co2_saved_kg": round(co2_saved, 2),
            "trees_equivalent": round(trees, 2),
        }

    # Bu hafta tamamlanan ziyaretler
    week_visits = db.query(SalesVisit).filter(
        SalesVisit.user_id == user.id,
        SalesVisit.visit_date >= week_start,
        SalesVisit.visit_date <= today_obj,
        SalesVisit.visited == 1,
    ).all()

    # Lifetime
    all_visits = db.query(SalesVisit).filter(
        SalesVisit.user_id == user.id,
        SalesVisit.visited == 1,
    ).all()

    return {
        "this_week": _aggregate(week_visits, plan),
        "lifetime": _aggregate(all_visits, plan),
        "constants": {
            "naive_overhead_ratio": NAIVE_OVERHEAD_RATIO,
            "co2_per_km": CO2_PER_KM,
            "co2_per_tree_year": CO2_PER_TREE_YEAR,
        },
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
