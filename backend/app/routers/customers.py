from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
import pandas as pd
import io
import requests as http_requests

from ..database import get_db
from ..models import Customer
from ..schemas import CustomerCreate, CustomerUpdate, CustomerOut

router = APIRouter(prefix="/api/customers", tags=["Musteriler"])


@router.get("/", response_model=list[CustomerOut])
def list_customers(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Customer).offset(skip).limit(limit).all()


@router.get("/count")
def count_customers(db: Session = Depends(get_db)):
    from sqlalchemy import func
    stats = db.query(
        func.count(Customer.id),
        func.sum(Customer.monthly_revenue),
        func.sum(Customer.visit_frequency),
    ).first()
    return {
        "count": stats[0],
        "total_revenue": stats[1] or 0,
        "total_visits": stats[2] or 0,
    }


@router.get("/geocode")
def geocode_address(
    address: str = Query(None, min_length=3),
    street: str = Query(None),
    city: str = Query(None),
    county: str = Query(None),
    neighbourhood: str = Query(None),
):
    headers = {"User-Agent": "SahaSatisPlanlama/1.0"}

    def _free(q, country=True):
        params = {"q": q, "format": "json", "limit": 1}
        if country:
            params["countrycodes"] = "tr"
        resp = http_requests.get(
            "https://nominatim.openstreetmap.org/search",
            params=params, headers=headers, timeout=10,
        )
        return resp.json()

    def _structured(**kw):
        params = {"format": "json", "limit": 1, "countrycodes": "tr"}
        params.update({k: v for k, v in kw.items() if v})
        resp = http_requests.get(
            "https://nominatim.openstreetmap.org/search",
            params=params, headers=headers, timeout=10,
        )
        return resp.json()

    try:
        results = []

        # Yapısal parametreler varsa önce onlarla dene (sokak + ilçe + il)
        if city or county:
            street_q = street or ""
            # 1. Sokak + mahalle + ilçe + il
            if street_q and neighbourhood:
                results = _structured(street=f"{street_q}, {neighbourhood}", county=county, city=city)
            # 2. Sokak + ilçe + il
            if not results and street_q:
                results = _structured(street=street_q, county=county, city=city)
            # 3. Mahalle + ilçe + il (serbest sorgu)
            if not results and neighbourhood:
                results = _free(f"{neighbourhood}, {county or ''}, {city or ''}".strip(", "))
            # 4. İlçe + il
            if not results and county:
                results = _structured(county=county, city=city)
            # 5. Sadece il
            if not results and city:
                results = _structured(city=city)

        # Serbest metin adresiyle dene (eski yöntem — fallback)
        if not results and address:
            results = _free(address)
            if not results:
                results = _free(address, country=False)
            if not results:
                parts = [p.strip() for p in address.replace(",", " ").split() if len(p.strip()) > 2]
                if len(parts) > 3:
                    results = _free(" ".join(parts[-3:]))
                if not results and len(parts) > 2:
                    results = _free(" ".join(parts[-2:]))

        if not results:
            raise HTTPException(
                status_code=404,
                detail="Adres bulunamadı. Haritaya tıklayarak konumu seçebilirsiniz."
            )
        return {
            "lat": float(results[0]["lat"]),
            "lon": float(results[0]["lon"]),
            "display_name": results[0].get("display_name", ""),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Geocoding hatası: {str(e)}")


@router.post("/bulk-reverse-geocode")
def bulk_reverse_geocode(db: Session = Depends(get_db)):
    """Adresi olmayan tüm müşterilerin koordinatlarından adres çeker."""
    import time

    customers = db.query(Customer).filter(
        (Customer.address == None) | (Customer.address == "")
    ).all()

    if not customers:
        return {"detail": "Tüm müşterilerin adresi zaten mevcut", "updated": 0, "failed": 0}

    updated = 0
    failed = 0
    errors = []

    for i, c in enumerate(customers):
        try:
            resp = http_requests.get(
                "https://nominatim.openstreetmap.org/reverse",
                params={
                    "lat": c.x,
                    "lon": c.y,
                    "format": "json",
                    "addressdetails": 1,
                    "accept-language": "tr",
                },
                headers={"User-Agent": "SahaSatisPlanlama/1.0"},
                timeout=10,
            )
            data = resp.json()

            if "error" in data:
                failed += 1
                errors.append(f"#{c.id} {c.name}: {data['error']}")
            else:
                addr = data.get("address", {})
                # Türkiye adresi formatı: Mahalle, Sokak, İlçe, İl
                parts = []
                for key in ["neighbourhood", "suburb", "quarter"]:
                    if key in addr:
                        parts.append(addr[key] + " Mah.")
                        break
                for key in ["road", "street"]:
                    if key in addr:
                        parts.append(addr[key])
                        break
                for key in ["town", "county", "city_district"]:
                    if key in addr:
                        parts.append(addr[key])
                        break
                for key in ["city", "province", "state"]:
                    if key in addr:
                        parts.append(addr[key])
                        break

                address_str = ", ".join(parts) if parts else data.get("display_name", "")
                c.address = address_str
                updated += 1

            # Nominatim rate limit: 1 istek/saniye
            if i < len(customers) - 1:
                time.sleep(1.1)

        except Exception as e:
            failed += 1
            errors.append(f"#{c.id} {c.name}: {str(e)}")

    db.commit()

    return {
        "detail": f"{updated} müşterinin adresi güncellendi, {failed} başarısız",
        "updated": updated,
        "failed": failed,
        "total": len(customers),
        "errors": errors[:20],
    }


@router.get("/geocode-suggest")
def geocode_suggest(q: str = Query(..., min_length=2)):
    """Adres yazarken öneri döner (autocomplete)."""
    try:
        resp = http_requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={
                "q": q,
                "format": "json",
                "limit": 5,
                "countrycodes": "tr",
                "addressdetails": 1,
            },
            headers={"User-Agent": "SahaSatisPlanlama/1.0"},
            timeout=10,
        )
        results = resp.json()
        return [
            {
                "display_name": r.get("display_name", ""),
                "lat": float(r["lat"]),
                "lon": float(r["lon"]),
                "address": r.get("address", {}),
            }
            for r in results
        ]
    except Exception:
        return []


@router.get("/{customer_id}", response_model=CustomerOut)
def get_customer(customer_id: int, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Musteri bulunamadi")
    return customer


@router.post("/", response_model=CustomerOut, status_code=201)
def create_customer(data: CustomerCreate, db: Session = Depends(get_db)):
    customer = Customer(**data.model_dump())
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


@router.put("/{customer_id}", response_model=CustomerOut)
def update_customer(customer_id: int, data: CustomerUpdate, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Musteri bulunamadi")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(customer, key, value)
    db.commit()
    db.refresh(customer)
    return customer


@router.delete("/{customer_id}")
def delete_customer(customer_id: int, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Musteri bulunamadi")
    db.delete(customer)
    db.commit()
    return {"detail": "Musteri silindi"}


def _geocode_address(address_text: str):
    """
    Adres metninden koordinat bul. Farklı formatları destekler:
      - "Bornova, İzmir"
      - "Kozağaç Mah. 232 Sok. No:19, Yunusemre, Manisa"
      - "Kozağaç,232,19,Yunusemre,Manisa"
      - "8 Eylül Caddesi 45, Manisa"
    Başarısızsa None döner.
    """
    import re

    headers = {"User-Agent": "SahaSatisPlanlama/1.0"}

    def _try(q, country=True):
        params = {"q": q, "format": "json", "limit": 1, "accept-language": "tr"}
        if country:
            params["countrycodes"] = "tr"
        r = http_requests.get(
            "https://nominatim.openstreetmap.org/search",
            params=params, headers=headers, timeout=10,
        )
        return r.json()

    if not address_text or len(address_text.strip()) < 3:
        return None

    addr = address_text.strip()
    # Normalize: / → boşluk, çoklu boşluk temizle
    addr = addr.replace("/", " ").strip()
    addr = re.sub(r"\s+", " ", addr)

    # Parçalara ayır (virgül veya boşlukla)
    tokens = [t.strip() for t in addr.replace(",", " ").split() if t.strip()]

    # Metin parçaları (sayı olmayanlar) — mahalle, ilçe, il gibi
    text_parts = [t for t in tokens if not re.match(r"^\d+[a-zA-Z]?$", t)
                  and t.lower() not in ("no:", "no", "sok.", "sok", "cad.", "cad", "mah.", "mah")]
    # Sokak numarası olabilecek sayılar
    nums = [t for t in tokens if re.match(r"^\d+[a-zA-Z]?$", t)]

    try:
        # 1. Tam adresle dene
        results = _try(addr)

        # 2. Sayıları çıkarıp sadece metin parçalarıyla dene
        if not results and text_parts:
            results = _try(", ".join(text_parts))

        # 3. Ülke filtresi olmadan dene
        if not results and text_parts:
            results = _try(", ".join(text_parts), country=False)

        # 4. Son 3 metin parçası (mahalle/ilçe/il)
        if not results and len(text_parts) > 3:
            results = _try(", ".join(text_parts[-3:]))

        # 5. Son 2 metin parçası (ilçe/il)
        if not results and len(text_parts) > 1:
            results = _try(", ".join(text_parts[-2:]))

        # 6. Son parça (sadece il)
        if not results and text_parts:
            results = _try(text_parts[-1])

        if results:
            return {
                "lat": float(results[0]["lat"]),
                "lon": float(results[0]["lon"]),
                "display": results[0].get("display_name", ""),
            }
    except Exception:
        pass
    return None


@router.post("/upload-excel")
def upload_customers_from_excel(file: UploadFile = File(...), db: Session = Depends(get_db)):
    import time as _time

    if not file.filename.endswith((".xlsx", ".xls", ".csv")):
        raise HTTPException(status_code=400, detail="Desteklenen formatlar: .xlsx, .xls, .csv")

    content = file.file.read()

    try:
        if file.filename.endswith(".csv"):
            # Farklı encoding'leri dene
            for enc in ["utf-8", "utf-8-sig", "latin-1", "cp1254", "iso-8859-9"]:
                try:
                    df = pd.read_csv(io.BytesIO(content), encoding=enc)
                    break
                except (UnicodeDecodeError, Exception):
                    continue
            else:
                df = pd.read_csv(io.BytesIO(content), encoding="utf-8", errors="replace")
        else:
            df = pd.read_excel(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Dosya okunamadı: {str(e)}")

    df.columns = df.columns.str.strip()

    # ── Geniş sütun eşleme (farklı Excel formatlarını destekle) ──
    column_mapping = {
        # İsim
        "id": "name", "Musteri_ID": "name", "Musteri_Adi": "name",
        "Müşteri Adı": "name", "Müşteri": "name", "musteri": "name",
        "İşletme Adı": "name", "İşletme": "name", "isletme": "name",
        "Firma": "name", "firma": "name", "Firma Adı": "name",
        "Ad": "name", "ad": "name", "Unvan": "name", "unvan": "name",
        # Koordinatlar
        "X_Koordinati": "x", "Enlem": "x", "enlem": "x", "Latitude": "x", "lat": "x", "LAT": "x",
        "Y_Koordinati": "y", "Boylam": "y", "boylam": "y", "Longitude": "y", "lon": "y", "lng": "y", "LON": "y",
        # Ciro
        "Aylik_Ciro": "monthly_revenue", "ciro": "monthly_revenue",
        "Aylık Ciro": "monthly_revenue", "Ciro": "monthly_revenue",
        "Aylık Gelir": "monthly_revenue", "Gelir": "monthly_revenue",
        # Ziyaret
        "Ziyaret_Sikligi": "visit_frequency", "ziyaret": "visit_frequency",
        "Ziyaret Sıklığı": "visit_frequency", "Ziyaret": "visit_frequency",
        "Haftalık Ziyaret": "visit_frequency",
        # Tip
        "Musteri_Tipi": "customer_type", "Müşteri Tipi": "customer_type", "Tip": "customer_type",
        # Adres alanları
        "Adres": "address", "adres": "address", "Address": "address", "address": "address",
        "Tam Adres": "address", "Konum": "address", "konum": "address",
        "Açık Adres": "address", "Adres Bilgisi": "address",
        # İl / İlçe / Mahalle (ayrı sütunlar)
        "İl": "il", "il": "il", "Şehir": "il", "sehir": "il", "City": "il", "city": "il",
        "İlçe": "ilce", "ilce": "ilce", "İlce": "ilce", "County": "ilce",
        "Mahalle": "mahalle", "mahalle": "mahalle", "Semt": "mahalle", "semt": "mahalle",
        "Sokak": "sokak", "sokak": "sokak", "Cadde": "sokak", "cadde": "sokak", "Street": "sokak",
        "Sokak/Cadde": "sokak", "Sokak Adı": "sokak", "Cadde Adı": "sokak",
        # Bina No
        "Bina No": "bina_no", "bina_no": "bina_no", "No": "bina_no", "no": "bina_no",
        "Kapı No": "bina_no", "Kapı": "bina_no", "Numara": "bina_no",
        "Bina": "bina_no", "Dış Kapı No": "bina_no", "Dış No": "bina_no",
        # Telefon
        "Telefon": "phone", "telefon": "phone", "Tel": "phone", "tel": "phone",
        "Phone": "phone", "phone": "phone", "GSM": "phone", "Cep": "phone",
    }

    renamed = {}
    for old_col, new_col in column_mapping.items():
        if old_col in df.columns and new_col not in renamed.values():
            renamed[old_col] = new_col
    df = df.rename(columns=renamed)

    # ── Zorunlu alan kontrolü ──
    has_coords = "x" in df.columns and "y" in df.columns
    has_address = "address" in df.columns
    has_address_parts = any(c in df.columns for c in ["il", "ilce", "mahalle", "sokak", "bina_no"])

    required = ["monthly_revenue", "visit_frequency"]
    if not has_coords and not has_address and not has_address_parts:
        required += ["x", "y"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Eksik sütunlar: {missing}. Mevcut: {df.columns.tolist()}. "
                   f"İpucu: Koordinat (x/y) veya Adres sütunu gereklidir."
        )

    if "name" not in df.columns:
        df["name"] = [f"Musteri_{i+1}" for i in range(len(df))]

    # ── Müşterileri oluştur ──
    created = 0
    geocoded = 0
    geocode_failed = 0
    errors = []

    for idx, row in df.iterrows():
        x_val = float(row["x"]) if has_coords and pd.notna(row.get("x")) else None
        y_val = float(row["y"]) if has_coords and pd.notna(row.get("y")) else None

        # Adres birleştir
        address_str = ""
        if has_address and pd.notna(row.get("address")):
            address_str = str(row["address"]).strip()
        elif has_address_parts:
            parts = []
            # Sokak + Bina No birlikte
            sokak_val = str(row.get("sokak", "")).strip() if pd.notna(row.get("sokak")) else ""
            bina_raw = row.get("bina_no")
            if pd.notna(bina_raw):
                # Sayıysa (45.0 → "45"), metinse olduğu gibi al
                bina_val = str(int(bina_raw)) if isinstance(bina_raw, float) and bina_raw == int(bina_raw) else str(bina_raw).strip()
            else:
                bina_val = ""
            if sokak_val and bina_val:
                parts.append(f"{sokak_val} No:{bina_val}")
            elif sokak_val:
                parts.append(sokak_val)
            for col in ["mahalle", "ilce", "il"]:
                val = row.get(col)
                if pd.notna(val) and str(val).strip():
                    parts.append(str(val).strip())
            address_str = ", ".join(parts)

        # Koordinat yoksa adresden geocode et
        if (x_val is None or y_val is None) and address_str:
            geo = _geocode_address(address_str)
            if geo:
                x_val = geo["lat"]
                y_val = geo["lon"]
                geocoded += 1
            else:
                geocode_failed += 1
                errors.append(f"Satır {idx+2} ({row.get('name','?')}): '{address_str}' adresi bulunamadı")
            # Nominatim rate limit
            _time.sleep(1.1)

        if x_val is None or y_val is None:
            continue  # Koordinatsız müşteriyi atla

        customer = Customer(
            name=str(row.get("name", f"Musteri_{idx+1}")),
            x=x_val,
            y=y_val,
            monthly_revenue=float(row["monthly_revenue"]),
            visit_frequency=int(row["visit_frequency"]),
            customer_type=str(row.get("customer_type", "")) or None,
            phone=str(row.get("phone", "")) or None if pd.notna(row.get("phone")) else None,
            address=address_str or None,
        )
        db.add(customer)
        created += 1

    db.commit()

    # Sonuç raporu
    parts = [f"{created} müşteri başarıyla yüklendi"]
    if geocoded:
        parts.append(f"{geocoded} tanesi adresten konumlandırıldı")
    if geocode_failed:
        parts.append(f"{geocode_failed} tanesi konumlandırılamadı")

    return {
        "detail": ". ".join(parts),
        "created": created,
        "geocoded": geocoded,
        "geocode_failed": geocode_failed,
        "errors": errors[:20],
    }
