"""
Karbon Emisyonu Hesaplama Servisi
Formül: E_CO2 = FC × ρ × EF
  FC  = mesafe_km × yakıt_tüketimi_L_per_100km / 100
  ρ   = yakıt yoğunluğu (kg/L)
  EF  = emisyon faktörü (kg CO2 / kg yakıt)
"""
import math
from datetime import date, datetime
from sqlalchemy.orm import Session

from ..models import (
    SalesVisit, Vehicle, VehicleType, DailyActualRoute,
    DailyRoute, AppSettings, User,
)

# ── Fiziksel sabitler (yakıt türüne göre) ─────────────────
FUEL_CONSTANTS = {
    "diesel":   {"density": 0.835, "ef": 3.169},   # kg/L, kg CO2/kg
    "gasoline": {"density": 0.745, "ef": 3.159},
    "lpg":      {"density": 0.540, "ef": 3.020},
    "electric": {"density": 0.0,   "ef": 0.0},
}

DEFAULT_FUEL_TYPE = "diesel"
DEFAULT_CONSUMPTION = 7.5  # L/100km


# ── Haversine (km) ────────────────────────────────────────
def _haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1))
         * math.cos(math.radians(lat2))
         * math.sin(dlon / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ── CO2 hesaplama ─────────────────────────────────────────
def calculate_co2(distance_km: float, consumption_l_per_100km: float,
                  fuel_type: str = "diesel") -> float:
    """
    E_CO2 = FC × ρ × EF  (kg CO2)
    FC = distance_km × consumption / 100
    """
    consts = FUEL_CONSTANTS.get(fuel_type, FUEL_CONSTANTS["diesel"])
    fc = distance_km * consumption_l_per_100km / 100.0
    return fc * consts["density"] * consts["ef"]


def calculate_fuel_consumed(distance_km: float,
                            consumption_l_per_100km: float) -> float:
    """Tüketilen yakıt miktarı (L)."""
    return distance_km * consumption_l_per_100km / 100.0


# ── GPS zincirinden mesafe + süre hesaplama ───────────────
def calculate_actual_route(
    visits: list[SalesVisit],
    depot_x: float,
    depot_y: float,
) -> dict:
    """
    Check-in koordinat zincirinden mesafe ve süre hesapla.
    Sıralama: check_in_at'e göre.
    Zincir: depo → müşteri1 → müşteri2 → ... → depo
    Süre:  ilk check_in → son check_out (dakika)
    """
    # Sadece check-in koordinatı olan ziyaretleri al, zamana göre sırala
    valid = [v for v in visits if v.check_in_lat is not None and v.check_in_lng is not None]
    valid.sort(key=lambda v: v.check_in_at or datetime.min)

    if not valid:
        return {"distance_km": 0.0, "time_minutes": 0.0, "visit_count": 0}

    # Haversine zinciri: depo → v1 → v2 → ... → depo
    total_km = 0.0
    prev_lat, prev_lng = depot_x, depot_y

    for v in valid:
        total_km += _haversine_km(prev_lat, prev_lng, v.check_in_lat, v.check_in_lng)
        # Eğer check-out koordinatı varsa, oradan devam et
        if v.check_out_lat is not None and v.check_out_lng is not None:
            prev_lat, prev_lng = v.check_out_lat, v.check_out_lng
        else:
            prev_lat, prev_lng = v.check_in_lat, v.check_in_lng

    # Son müşteriden depoya dönüş
    total_km += _haversine_km(prev_lat, prev_lng, depot_x, depot_y)

    # Süre: ilk check-in → son check-out (veya son check-in)
    first_time = valid[0].check_in_at
    last_time = valid[-1].check_out_at or valid[-1].check_in_at
    time_minutes = 0.0
    if first_time and last_time:
        time_minutes = (last_time - first_time).total_seconds() / 60.0

    return {
        "distance_km": round(total_km, 2),
        "time_minutes": round(time_minutes, 1),
        "visit_count": len(valid),
    }


# ── Kullanıcının araç tipi bilgisi ────────────────────────
def get_user_vehicle_info(db: Session, user_id: int) -> dict:
    """Kullanıcıya atanmış araç → tip bilgisi. Yoksa default."""
    vehicle = db.query(Vehicle).filter(Vehicle.assigned_user_id == user_id).first()
    if vehicle and vehicle.vehicle_type:
        vt = vehicle.vehicle_type
        return {
            "fuel_type": vt.fuel_type,
            "consumption": vt.fuel_consumption_l_per_100km,
            "vehicle_type_name": vt.name,
        }

    # Default araç tipi
    default_vt = db.query(VehicleType).filter(VehicleType.is_default == True).first()
    if default_vt:
        return {
            "fuel_type": default_vt.fuel_type,
            "consumption": default_vt.fuel_consumption_l_per_100km,
            "vehicle_type_name": default_vt.name,
        }

    return {
        "fuel_type": DEFAULT_FUEL_TYPE,
        "consumption": DEFAULT_CONSUMPTION,
        "vehicle_type_name": "Varsayilan",
    }


# ── Depo koordinatları ─────────────────────────────────────
def get_depot(db: Session) -> tuple[float, float]:
    s = db.query(AppSettings).first()
    if s:
        return s.depot_x, s.depot_y
    return 38.6567541, 27.3435846


# ── DailyActualRoute upsert (check-out sonrası çağrılır) ──
def update_daily_actual_route(db: Session, user_id: int, route_date: date):
    """
    Belirli kullanıcı+gün için GPS verilerinden gerçekleşen rota hesapla,
    planlanan rota ile karşılaştır, CO2 hesapla ve kaydet.
    """
    # O gün tüm ziyaretler
    visits = db.query(SalesVisit).filter(
        SalesVisit.user_id == user_id,
        SalesVisit.visit_date == route_date,
    ).all()

    depot_x, depot_y = get_depot(db)
    actual = calculate_actual_route(visits, depot_x, depot_y)

    # Araç bilgisi ile CO2 hesapla
    vehicle_info = get_user_vehicle_info(db, user_id)
    co2 = calculate_co2(
        actual["distance_km"],
        vehicle_info["consumption"],
        vehicle_info["fuel_type"],
    )

    # Planlanan mesafe/süre (DailyRoute'tan)
    user = db.query(User).filter(User.id == user_id).first()
    est_distance = None
    est_time = None
    if user and user.cluster_index is not None:
        weekday = route_date.isoweekday()  # 1=Mon, 7=Sun
        from ..models import Plan
        plan = db.query(Plan).filter(Plan.status == "completed").order_by(Plan.created_at.desc()).first()
        if plan:
            dr = db.query(DailyRoute).filter(
                DailyRoute.plan_id == plan.id,
                DailyRoute.cluster_index == user.cluster_index,
                DailyRoute.day_of_week == weekday,
            ).first()
            if dr:
                est_distance = dr.total_distance
                est_time = dr.total_time_minutes

    # Upsert
    record = db.query(DailyActualRoute).filter(
        DailyActualRoute.user_id == user_id,
        DailyActualRoute.route_date == route_date,
    ).first()

    if record:
        record.actual_distance_km = actual["distance_km"]
        record.actual_time_minutes = actual["time_minutes"]
        record.estimated_distance_km = est_distance
        record.estimated_time_minutes = est_time
        record.co2_emission_kg = round(co2, 3)
        record.visit_count = actual["visit_count"]
    else:
        record = DailyActualRoute(
            user_id=user_id,
            route_date=route_date,
            actual_distance_km=actual["distance_km"],
            actual_time_minutes=actual["time_minutes"],
            estimated_distance_km=est_distance,
            estimated_time_minutes=est_time,
            co2_emission_kg=round(co2, 3),
            visit_count=actual["visit_count"],
        )
        db.add(record)

    db.commit()
    return record
