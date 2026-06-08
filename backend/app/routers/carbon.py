from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, timedelta
from collections import defaultdict

from ..database import get_db
from ..models import DailyActualRoute, User, Vehicle, VehicleType
from ..services.carbon import (
    FUEL_CONSTANTS, DEFAULT_FUEL_TYPE, DEFAULT_CONSUMPTION,
    get_user_vehicle_info,
)

router = APIRouter(prefix="/api/carbon", tags=["Karbon Emisyonu"])


def _week_start(d: date) -> date:
    return d - timedelta(days=d.weekday())


def _month_start(d: date) -> date:
    return d.replace(day=1)


@router.get("/daily")
def get_daily_carbon(
    start_date: str | None = None,
    end_date: str | None = None,
    user_id: int | None = None,
    db: Session = Depends(get_db),
):
    """Gunluk karbon emisyonu verileri (tarih araligi + opsiyonel ST filtresi)."""
    q = db.query(DailyActualRoute).join(User, DailyActualRoute.user_id == User.id)

    if start_date:
        q = q.filter(DailyActualRoute.route_date >= date.fromisoformat(start_date))
    if end_date:
        q = q.filter(DailyActualRoute.route_date <= date.fromisoformat(end_date))
    if user_id:
        q = q.filter(DailyActualRoute.user_id == user_id)

    records = q.order_by(DailyActualRoute.route_date.desc()).all()

    data = []
    for r in records:
        user = r.user
        vi = get_user_vehicle_info(db, r.user_id)
        data.append({
            "date": r.route_date.isoformat(),
            "user_id": r.user_id,
            "user_name": user.full_name if user else "?",
            "actual_distance_km": r.actual_distance_km,
            "estimated_distance_km": r.estimated_distance_km,
            "actual_time_min": r.actual_time_minutes,
            "estimated_time_min": r.estimated_time_minutes,
            "co2_kg": r.co2_emission_kg or 0,
            "visit_count": r.visit_count,
            "vehicle_type": vi["vehicle_type_name"],
            "fuel_type": vi["fuel_type"],
            "fuel_consumption": vi["consumption"],
        })
    return {"data": data}


@router.get("/weekly")
def get_weekly_carbon(
    weeks: int = Query(4, ge=1, le=12),
    db: Session = Depends(get_db),
):
    """Son N haftalik toplam karbon emisyonu."""
    today = date.today()
    start = _week_start(today) - timedelta(weeks=weeks - 1)

    records = db.query(DailyActualRoute).filter(
        DailyActualRoute.route_date >= start,
    ).all()

    weekly = defaultdict(lambda: {"co2_kg": 0, "distance_km": 0, "visits": 0})
    for r in records:
        w = _week_start(r.route_date).isoformat()
        weekly[w]["co2_kg"] += r.co2_emission_kg or 0
        weekly[w]["distance_km"] += r.actual_distance_km or 0
        weekly[w]["visits"] += r.visit_count or 0

    data = []
    for i in range(weeks):
        ws = _week_start(today) - timedelta(weeks=weeks - 1 - i)
        key = ws.isoformat()
        entry = weekly.get(key, {"co2_kg": 0, "distance_km": 0, "visits": 0})
        data.append({
            "week_start": key,
            "label": f"Hafta {i + 1}",
            **entry,
        })
    return {"data": data}


@router.get("/monthly")
def get_monthly_carbon(
    months: int = Query(3, ge=1, le=12),
    db: Session = Depends(get_db),
):
    """Son N aylik toplam karbon emisyonu."""
    today = date.today()
    start = today.replace(day=1) - timedelta(days=30 * (months - 1))
    start = start.replace(day=1)

    records = db.query(DailyActualRoute).filter(
        DailyActualRoute.route_date >= start,
    ).all()

    monthly = defaultdict(lambda: {"co2_kg": 0, "distance_km": 0, "visits": 0})
    for r in records:
        m = r.route_date.strftime("%Y-%m")
        monthly[m]["co2_kg"] += r.co2_emission_kg or 0
        monthly[m]["distance_km"] += r.actual_distance_km or 0
        monthly[m]["visits"] += r.visit_count or 0

    data = []
    for i in range(months):
        d = today.replace(day=1) - timedelta(days=30 * (months - 1 - i))
        key = d.strftime("%Y-%m")
        entry = monthly.get(key, {"co2_kg": 0, "distance_km": 0, "visits": 0})
        data.append({
            "month": key,
            "label": d.strftime("%B %Y"),
            **entry,
        })
    return {"data": data}


@router.get("/summary")
def get_carbon_summary(db: Session = Depends(get_db)):
    """Dashboard icin KPI degerleri."""
    today = date.today()
    week_start = _week_start(today)
    month_start = _month_start(today)

    # Bu hafta
    week_records = db.query(DailyActualRoute).filter(
        DailyActualRoute.route_date >= week_start,
    ).all()

    # Bu ay
    month_records = db.query(DailyActualRoute).filter(
        DailyActualRoute.route_date >= month_start,
    ).all()

    # Bugun
    today_records = [r for r in week_records if r.route_date == today]

    def _agg(records):
        total_co2 = sum(r.co2_emission_kg or 0 for r in records)
        total_distance = sum(r.actual_distance_km or 0 for r in records)
        total_visits = sum(r.visit_count or 0 for r in records)
        days = len(set(r.route_date for r in records)) or 1
        return {
            "total_co2_kg": round(total_co2, 2),
            "total_distance_km": round(total_distance, 2),
            "total_visits": total_visits,
            "avg_daily_co2_kg": round(total_co2 / days, 2),
            "co2_per_visit_kg": round(total_co2 / total_visits, 3) if total_visits else 0,
            "days_count": days,
        }

    return {
        "today": _agg(today_records),
        "this_week": _agg(week_records),
        "this_month": _agg(month_records),
        "fuel_constants": FUEL_CONSTANTS,
    }


@router.get("/comparison")
def get_distance_comparison(
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db),
):
    """ST bazli tahmini vs gerceklesen mesafe/sure karsilastirmasi."""
    today = date.today()
    sd = date.fromisoformat(start_date) if start_date else _week_start(today)
    ed = date.fromisoformat(end_date) if end_date else today

    records = db.query(DailyActualRoute).filter(
        DailyActualRoute.route_date >= sd,
        DailyActualRoute.route_date <= ed,
    ).all()

    # ST bazında aggregate
    by_user = defaultdict(lambda: {
        "actual_distance": 0, "estimated_distance": 0,
        "actual_time": 0, "estimated_time": 0,
        "co2_kg": 0, "visits": 0, "days": 0,
    })

    for r in records:
        uid = r.user_id
        by_user[uid]["actual_distance"] += r.actual_distance_km or 0
        by_user[uid]["estimated_distance"] += r.estimated_distance_km or 0
        by_user[uid]["actual_time"] += r.actual_time_minutes or 0
        by_user[uid]["estimated_time"] += r.estimated_time_minutes or 0
        by_user[uid]["co2_kg"] += r.co2_emission_kg or 0
        by_user[uid]["visits"] += r.visit_count or 0
        by_user[uid]["days"] += 1

    data = []
    for uid, agg in by_user.items():
        user = db.query(User).filter(User.id == uid).first()
        vi = get_user_vehicle_info(db, uid)

        est_d = agg["estimated_distance"]
        act_d = agg["actual_distance"]
        dist_diff_pct = round((act_d - est_d) / est_d * 100, 1) if est_d else None

        est_t = agg["estimated_time"]
        act_t = agg["actual_time"]
        time_diff_pct = round((act_t - est_t) / est_t * 100, 1) if est_t else None

        consumption = vi["consumption"]
        fuel_consumed = act_d * consumption / 100

        data.append({
            "user_id": uid,
            "user_name": user.full_name if user else "?",
            "actual_distance_km": round(act_d, 2),
            "estimated_distance_km": round(est_d, 2),
            "distance_diff_pct": dist_diff_pct,
            "actual_time_min": round(act_t, 1),
            "estimated_time_min": round(est_t, 1),
            "time_diff_pct": time_diff_pct,
            "co2_kg": round(agg["co2_kg"], 2),
            "fuel_consumed": round(fuel_consumed, 2),
            "fuel_consumption": consumption,
            "visit_count": agg["visits"],
            "days": agg["days"],
            "vehicle_type": vi["vehicle_type_name"],
            "fuel_type": vi["fuel_type"],
        })

    # Toplam satır
    total = {
        "actual_distance_km": round(sum(d["actual_distance_km"] for d in data), 2),
        "estimated_distance_km": round(sum(d["estimated_distance_km"] for d in data), 2),
        "actual_time_min": round(sum(d["actual_time_min"] for d in data), 1),
        "estimated_time_min": round(sum(d["estimated_time_min"] for d in data), 1),
        "co2_kg": round(sum(d["co2_kg"] for d in data), 2),
        "visit_count": sum(d["visit_count"] for d in data),
    }

    return {"data": data, "total": total, "period": {"start": sd.isoformat(), "end": ed.isoformat()}}
