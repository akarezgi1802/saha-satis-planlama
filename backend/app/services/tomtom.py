"""
TomTom Routing API entegrasyonu.

Saat bazlı trafik verisiyle gerçek yol rotalaması.
- Routing API: https://developer.tomtom.com/routing-api/documentation
- Kayıt: https://developer.tomtom.com/ (ücretsiz, 2500 tx/gün)
- Env var: TOMTOM_API_KEY

Key yoksa fallback: düz çizgi polyline + euclidean mesafe + tahmini süre.
Mobil/web hep aynı endpoint'i çağırır, transparan.
"""
import os
import math
from datetime import datetime
from typing import Iterable, Optional

import requests

# Aynı TOMTOM_API_KEY env var'i hem burada (Routing API) hem
# services/routing.py'da (Matrix API) kullanılır. Env yoksa eski
# hardcoded key fallback (services/routing.py ile uyumlu).
TOMTOM_API_KEY = (
    os.getenv("TOMTOM_API_KEY", "").strip()
    or "RqucU21MbLqBahCSnZh1KkyYttdSlR7m"
)
TOMTOM_ROUTING_BASE = "https://api.tomtom.com/routing/1/calculateRoute"

# Ortalama şehir içi hız (km/sa) — fallback'te tahmini süre için
FALLBACK_SPEED_KMH = 35


def is_available() -> bool:
    return bool(TOMTOM_API_KEY)


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """İki nokta arasındaki büyük çember mesafesi (km)."""
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    return 2 * R * math.asin(math.sqrt(a))


def _format_coords(coords: Iterable[tuple[float, float]]) -> str:
    """TomTom URL formatı: 'lat,lng:lat,lng:...' (en az 2 nokta)."""
    return ":".join(f"{lat:.6f},{lng:.6f}" for lat, lng in coords)


def calculate_route(
    coords: list[tuple[float, float]],
    depart_at: Optional[datetime] = None,
    traffic: bool = True,
) -> dict:
    """
    Sıralı koordinatlar için TomTom'dan rota hesapla.

    Args:
        coords: [(lat, lng), ...] en az 2 nokta (origin → ... → destination)
        depart_at: Trafik tahmini için kalkış zamanı (None = şimdi)
        traffic: Trafik verilerini kullan

    Returns:
        {
            "polyline": [(lat, lng), ...],     # rotanın yol noktaları
            "distance_m": int,                 # toplam mesafe (metre)
            "travel_time_sec": int,            # serbest akış (trafiksiz) süre
            "traffic_time_sec": int,           # trafikli gerçek süre
            "traffic_delay_sec": int,          # gecikme (traffic - travel)
            "depart_at": str (ISO),
            "arrival_at": str (ISO),
            "provider": "tomtom" | "fallback",
            "warnings": [...]
        }
    """
    if len(coords) < 2:
        raise ValueError("En az 2 koordinat gerekli")

    depart_at = depart_at or datetime.now()

    # TomTom key yoksa fallback hesaplama
    if not is_available():
        return _fallback_route(coords, depart_at)

    try:
        url_coords = _format_coords(coords)
        url = f"{TOMTOM_ROUTING_BASE}/{url_coords}/json"

        params = {
            "key": TOMTOM_API_KEY,
            "traffic": "true" if traffic else "false",
            "departAt": depart_at.strftime("%Y-%m-%dT%H:%M:%S"),
            "routeType": "fastest",
            "travelMode": "car",
            "instructionsType": "text",
            "language": "tr-TR",
        }

        r = requests.get(url, params=params, timeout=20)
        if r.status_code != 200:
            return _fallback_route(
                coords, depart_at,
                warning=f"TomTom hata {r.status_code}: {r.text[:100]}",
            )

        data = r.json()
        routes = data.get("routes", [])
        if not routes:
            return _fallback_route(coords, depart_at, warning="TomTom rota döndürmedi")

        route = routes[0]
        summary = route.get("summary", {})

        # Polyline: tüm leg'lerin points'ini birleştir
        polyline = []
        for leg in route.get("legs", []):
            for pt in leg.get("points", []):
                polyline.append((pt["latitude"], pt["longitude"]))

        distance_m = summary.get("lengthInMeters", 0)
        travel_time_sec = summary.get("noTrafficTravelTimeInSeconds", summary.get("travelTimeInSeconds", 0))
        traffic_time_sec = summary.get("travelTimeInSeconds", travel_time_sec)
        traffic_delay_sec = max(0, traffic_time_sec - travel_time_sec)

        departure_time = summary.get("departureTime", depart_at.isoformat())
        arrival_time = summary.get("arrivalTime", "")

        return {
            "polyline": polyline,
            "distance_m": distance_m,
            "travel_time_sec": travel_time_sec,
            "traffic_time_sec": traffic_time_sec,
            "traffic_delay_sec": traffic_delay_sec,
            "depart_at": departure_time,
            "arrival_at": arrival_time,
            "provider": "tomtom",
            "warnings": [],
        }

    except requests.RequestException as e:
        return _fallback_route(coords, depart_at, warning=f"TomTom bağlantı hatası: {e}")
    except Exception as e:
        return _fallback_route(coords, depart_at, warning=f"TomTom işlem hatası: {e}")


def _fallback_route(
    coords: list[tuple[float, float]],
    depart_at: datetime,
    warning: Optional[str] = None,
) -> dict:
    """TomTom yoksa euclidean polyline + tahmini süre."""
    polyline = list(coords)

    # Haversine toplam mesafesi
    total_km = 0.0
    for i in range(len(coords) - 1):
        total_km += _haversine_km(*coords[i], *coords[i + 1])

    distance_m = int(total_km * 1000)
    # Ortalama hıza göre süre (saniye)
    travel_time_sec = int((total_km / FALLBACK_SPEED_KMH) * 3600)
    # Mock trafik: yoğun saatlerde %20-40 gecikme
    hour = depart_at.hour
    rush_hour = (7 <= hour < 10) or (17 <= hour < 20)
    delay_factor = 0.30 if rush_hour else 0.10
    traffic_delay_sec = int(travel_time_sec * delay_factor)
    traffic_time_sec = travel_time_sec + traffic_delay_sec

    from datetime import timedelta
    arrival = depart_at + timedelta(seconds=traffic_time_sec)

    warnings = []
    if not is_available():
        warnings.append("TomTom API key tanımlı değil — tahmini hesaplama kullanıldı")
    if warning:
        warnings.append(warning)

    return {
        "polyline": polyline,
        "distance_m": distance_m,
        "travel_time_sec": travel_time_sec,
        "traffic_time_sec": traffic_time_sec,
        "traffic_delay_sec": traffic_delay_sec,
        "depart_at": depart_at.isoformat(),
        "arrival_at": arrival.isoformat(),
        "provider": "fallback",
        "warnings": warnings,
    }


def get_incidents(bbox: tuple[float, float, float, float], limit: int = 20) -> dict:
    """
    Rotanın çevresinde TomTom Traffic Incidents — kaza, yol kapanması, yoğunluk.

    bbox = (min_lng, min_lat, max_lng, max_lat)
    Return: {"available": bool, "incidents": [{type, severity, description, ...}], "warnings": []}
    """
    if not is_available():
        return {"available": False, "incidents": [], "warnings": ["TomTom API key tanımlı değil"]}

    url = "https://api.tomtom.com/traffic/services/5/incidentDetails"
    params = {
        "key": TOMTOM_API_KEY,
        "bbox": f"{bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]}",
        "fields": "{incidents{type,geometry{type,coordinates},properties{iconCategory,magnitudeOfDelay,events{description,iconCategory},delay,length,startTime,endTime,from,to}}}",
        "language": "tr-TR",
        "timeValidityFilter": "present",
    }
    try:
        r = requests.get(url, params=params, timeout=15)
        if r.status_code != 200:
            return {"available": False, "incidents": [], "warnings": [f"TomTom incident hata {r.status_code}"]}
        data = r.json()
        raw_incidents = data.get("incidents", [])[:limit]

        # ICON kategorileri (TomTom dokümanından)
        icon_labels = {
            0: ("Bilinmiyor", "ℹ️"),
            1: ("Kaza", "🚨"),
            2: ("Sis", "🌫️"),
            3: ("Tehlikeli koşullar", "⚠️"),
            4: ("Yağmur", "🌧️"),
            5: ("Buzlanma", "🧊"),
            6: ("Yol kapalı", "⛔"),
            7: ("Şerit kapalı", "🚧"),
            8: ("Yol çalışması", "🚧"),
            9: ("Rüzgar", "💨"),
            10: ("Sel", "🌊"),
            11: ("Detour", "↪️"),
            14: ("Trafik yoğun", "🟠"),
        }

        # Magnitude of delay (gecikme şiddeti)
        magnitude_labels = {
            0: "Bilinmiyor",
            1: "Hafif",
            2: "Orta",
            3: "Şiddetli",
            4: "Yol kapanma",
        }

        incidents = []
        for inc in raw_incidents:
            props = inc.get("properties", {})
            icon_cat = props.get("iconCategory", 0)
            label, emoji = icon_labels.get(icon_cat, ("Bilinmiyor", "ℹ️"))
            magnitude = props.get("magnitudeOfDelay", 0)

            events = props.get("events", [])
            description = " · ".join(e.get("description", "") for e in events if e.get("description"))
            if not description:
                description = label

            delay_sec = props.get("delay", 0) or 0
            length_m = props.get("length", 0) or 0

            geometry = inc.get("geometry", {})
            coords = geometry.get("coordinates", [])
            # İlk koordinat (incident'ın başlangıcı)
            first_coord = None
            if coords:
                if isinstance(coords[0], (int, float)):  # Point
                    first_coord = [coords[1], coords[0]]  # lat, lng
                elif isinstance(coords[0], list) and len(coords[0]) >= 2:
                    # LineString veya Polygon
                    pt = coords[0]
                    if isinstance(pt[0], (int, float)):
                        first_coord = [pt[1], pt[0]]

            incidents.append({
                "type": label,
                "icon": emoji,
                "icon_category": icon_cat,
                "severity": magnitude_labels.get(magnitude, "Bilinmiyor"),
                "severity_level": magnitude,
                "description": description,
                "delay_seconds": delay_sec,
                "delay_minutes": round(delay_sec / 60) if delay_sec else 0,
                "length_meters": length_m,
                "from": props.get("from"),
                "to": props.get("to"),
                "location": first_coord,
            })

        # Önem sırasına göre sırala (severity_level azalan)
        incidents.sort(key=lambda x: (-x["severity_level"], -x["delay_seconds"]))

        return {"available": True, "incidents": incidents, "warnings": []}

    except requests.RequestException as e:
        return {"available": False, "incidents": [], "warnings": [f"TomTom bağlantı hatası: {e}"]}
    except Exception as e:
        return {"available": False, "incidents": [], "warnings": [f"İşlem hatası: {e}"]}


def get_traffic_summary_text(result: dict) -> str:
    """Trafik durumunu insan dilinde özetle."""
    delay = result.get("traffic_delay_sec", 0)
    total = result.get("traffic_time_sec", 0)

    def _fmt_min(s):
        m = round(s / 60)
        if m < 60:
            return f"{m} dk"
        h, mm = divmod(m, 60)
        return f"{h}sa {mm}dk"

    if delay < 60:
        return f"🟢 Akıcı trafik · Tahmini varış: {_fmt_min(total)}"
    elif delay < 600:
        return f"🟡 Hafif yoğun · Tahmini varış: {_fmt_min(total)} ({_fmt_min(delay)} gecikme)"
    elif delay < 1800:
        return f"🟠 Yoğun trafik · Tahmini varış: {_fmt_min(total)} ({_fmt_min(delay)} gecikme)"
    else:
        return f"🔴 Çok yoğun · Tahmini varış: {_fmt_min(total)} ({_fmt_min(delay)} gecikme)"
