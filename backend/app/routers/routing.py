"""
Gerçek zamanlı trafik bazlı rotalama endpoint'leri.
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, Customer, Plan, DailyRoute, RouteStop, AppSettings
from ..auth import get_current_user
from ..services import tomtom

router = APIRouter(prefix="/api/routing", tags=["routing"])


@router.get("/status")
def routing_status():
    """TomTom entegrasyonu aktif mi?"""
    return {
        "tomtom_enabled": tomtom.is_available(),
        "provider": "tomtom" if tomtom.is_available() else "fallback",
    }


@router.get("/live/{plan_id}/{day_of_week}")
def get_live_route(
    plan_id: int,
    day_of_week: int,
    depart_at: Optional[str] = Query(None, description="ISO format: 2024-01-15T08:00:00 (default: şimdi)"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Kullanıcının cluster'ı + belirli gün için TomTom trafikli rotası.

    Args:
        plan_id: Hangi plan
        day_of_week: 1=Pzt..6=Cmt
        depart_at: Kalkış zamanı (ISO, default şimdi)
    """
    plan = db.query(Plan).filter(Plan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan bulunamadı")
    if user.cluster_index is None:
        raise HTTPException(status_code=400, detail="Hesabınıza bölge atanmamış")
    if day_of_week < 1 or day_of_week > 6:
        raise HTTPException(status_code=400, detail="Gün 1-6 arası olmalı (Pzt-Cmt)")

    daily_route = db.query(DailyRoute).filter(
        DailyRoute.plan_id == plan_id,
        DailyRoute.cluster_index == user.cluster_index,
        DailyRoute.day_of_week == day_of_week,
    ).first()
    if not daily_route:
        return {
            "has_route": False,
            "message": "Bu gün için rotanız yok",
        }

    stops = db.query(RouteStop).filter(
        RouteStop.daily_route_id == daily_route.id
    ).order_by(RouteStop.visit_order).all()
    if not stops:
        return {"has_route": False, "message": "Bu gün için durak yok"}

    # Depo koordinatları
    settings = db.query(AppSettings).first()
    depot_lat = settings.depot_x if settings else 38.6567541
    depot_lng = settings.depot_y if settings else 27.3435846

    # Tüm koordinatları topla: depo → stops → depo
    coords = [(depot_lat, depot_lng)]
    stop_details = []
    for stop in stops:
        cust = db.query(Customer).filter(Customer.id == stop.customer_id).first()
        if not cust:
            continue
        coords.append((cust.x, cust.y))
        stop_details.append({
            "visit_order": stop.visit_order,
            "customer_id": cust.id,
            "customer_name": cust.name,
            "lat": cust.x,
            "lng": cust.y,
            "estimated_arrival_minutes": stop.estimated_arrival_minutes,
        })
    coords.append((depot_lat, depot_lng))

    # Depart at parse
    try:
        dep = datetime.fromisoformat(depart_at) if depart_at else datetime.now()
    except ValueError:
        dep = datetime.now()

    # TomTom çağır
    route_result = tomtom.calculate_route(coords, depart_at=dep, traffic=True)
    summary_text = tomtom.get_traffic_summary_text(route_result)

    return {
        "has_route": True,
        "plan_id": plan_id,
        "plan_name": plan.name,
        "cluster_index": user.cluster_index,
        "day_of_week": day_of_week,
        "depot": {"lat": depot_lat, "lng": depot_lng},
        "stops": stop_details,
        "polyline": [{"lat": p[0], "lng": p[1]} for p in route_result["polyline"]],
        "distance_m": route_result["distance_m"],
        "distance_km": round(route_result["distance_m"] / 1000, 1),
        "travel_time_sec": route_result["travel_time_sec"],
        "traffic_time_sec": route_result["traffic_time_sec"],
        "traffic_delay_sec": route_result["traffic_delay_sec"],
        "travel_time_min": round(route_result["travel_time_sec"] / 60),
        "traffic_time_min": round(route_result["traffic_time_sec"] / 60),
        "traffic_delay_min": round(route_result["traffic_delay_sec"] / 60),
        "depart_at": route_result["depart_at"],
        "arrival_at": route_result["arrival_at"],
        "provider": route_result["provider"],
        "summary_text": summary_text,
        "warnings": route_result["warnings"],
    }
