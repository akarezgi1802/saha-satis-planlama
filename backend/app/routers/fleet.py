from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import VehicleType, Vehicle, User
from ..schemas import (
    VehicleTypeCreate, VehicleTypeUpdate, VehicleTypeOut,
    VehicleCreate, VehicleUpdate, VehicleOut,
)

router = APIRouter(prefix="/api/fleet", tags=["Filo"])


# ── Araç Tipleri ─────────────────────────────────────

@router.get("/vehicle-types", response_model=list[VehicleTypeOut])
def list_vehicle_types(db: Session = Depends(get_db)):
    return db.query(VehicleType).order_by(VehicleType.id).all()


@router.post("/vehicle-types", response_model=VehicleTypeOut, status_code=201)
def create_vehicle_type(data: VehicleTypeCreate, db: Session = Depends(get_db)):
    if data.fuel_type not in ("diesel", "gasoline", "lpg", "electric"):
        raise HTTPException(400, "Gecersiz yakit tipi. diesel/gasoline/lpg/electric olmali.")
    # Eğer is_default=True ise diğerlerini resetle
    if data.is_default:
        db.query(VehicleType).filter(VehicleType.is_default == True).update({"is_default": False})
    vt = VehicleType(**data.model_dump())
    db.add(vt)
    db.commit()
    db.refresh(vt)
    return vt


@router.put("/vehicle-types/{vt_id}", response_model=VehicleTypeOut)
def update_vehicle_type(vt_id: int, data: VehicleTypeUpdate, db: Session = Depends(get_db)):
    vt = db.query(VehicleType).filter(VehicleType.id == vt_id).first()
    if not vt:
        raise HTTPException(404, "Arac tipi bulunamadi")
    updates = data.model_dump(exclude_unset=True)
    if "fuel_type" in updates and updates["fuel_type"] not in ("diesel", "gasoline", "lpg", "electric"):
        raise HTTPException(400, "Gecersiz yakit tipi.")
    if updates.get("is_default"):
        db.query(VehicleType).filter(VehicleType.id != vt_id, VehicleType.is_default == True).update({"is_default": False})
    for k, v in updates.items():
        setattr(vt, k, v)
    db.commit()
    db.refresh(vt)
    return vt


@router.delete("/vehicle-types/{vt_id}")
def delete_vehicle_type(vt_id: int, db: Session = Depends(get_db)):
    vt = db.query(VehicleType).filter(VehicleType.id == vt_id).first()
    if not vt:
        raise HTTPException(404, "Arac tipi bulunamadi")
    # Bağlı araçlar varsa silme
    count = db.query(Vehicle).filter(Vehicle.vehicle_type_id == vt_id).count()
    if count > 0:
        raise HTTPException(400, f"Bu tipe bagli {count} arac var, once araclari silin veya tipi degistirin.")
    db.delete(vt)
    db.commit()
    return {"detail": "Arac tipi silindi"}


# ── Araçlar ──────────────────────────────────────────

@router.get("/vehicles")
def list_vehicles(db: Session = Depends(get_db)):
    vehicles = db.query(Vehicle).order_by(Vehicle.id).all()
    result = []
    for v in vehicles:
        vt = v.vehicle_type
        user = v.assigned_user
        result.append({
            "id": v.id,
            "plate_number": v.plate_number,
            "vehicle_type_id": v.vehicle_type_id,
            "vehicle_type_name": vt.name if vt else None,
            "fuel_type": vt.fuel_type if vt else None,
            "fuel_consumption": vt.fuel_consumption_l_per_100km if vt else None,
            "assigned_user_id": v.assigned_user_id,
            "assigned_user_name": user.full_name if user else None,
            "notes": v.notes,
            "created_at": v.created_at,
        })
    return result


@router.post("/vehicles", status_code=201)
def create_vehicle(data: VehicleCreate, db: Session = Depends(get_db)):
    # Plaka benzersizliği
    exists = db.query(Vehicle).filter(Vehicle.plate_number == data.plate_number).first()
    if exists:
        raise HTTPException(400, f"'{data.plate_number}' plakali arac zaten kayitli.")
    vt = db.query(VehicleType).filter(VehicleType.id == data.vehicle_type_id).first()
    if not vt:
        raise HTTPException(400, "Gecersiz arac tipi ID.")
    # Aynı kullanıcıya birden fazla araç atamasını engelle
    if data.assigned_user_id:
        other = db.query(Vehicle).filter(
            Vehicle.assigned_user_id == data.assigned_user_id
        ).first()
        if other:
            raise HTTPException(400, f"Bu ST'ye zaten '{other.plate_number}' plakali arac atanmis.")
    v = Vehicle(**data.model_dump())
    db.add(v)
    db.commit()
    db.refresh(v)
    return {"id": v.id, "plate_number": v.plate_number, "detail": "Arac eklendi"}


@router.put("/vehicles/{v_id}")
def update_vehicle(v_id: int, data: VehicleUpdate, db: Session = Depends(get_db)):
    v = db.query(Vehicle).filter(Vehicle.id == v_id).first()
    if not v:
        raise HTTPException(404, "Arac bulunamadi")
    updates = data.model_dump(exclude_unset=True)
    if "plate_number" in updates:
        dup = db.query(Vehicle).filter(
            Vehicle.plate_number == updates["plate_number"],
            Vehicle.id != v_id,
        ).first()
        if dup:
            raise HTTPException(400, "Bu plaka zaten kayitli.")
    if "assigned_user_id" in updates and updates["assigned_user_id"]:
        other = db.query(Vehicle).filter(
            Vehicle.assigned_user_id == updates["assigned_user_id"],
            Vehicle.id != v_id,
        ).first()
        if other:
            raise HTTPException(400, f"Bu ST'ye zaten '{other.plate_number}' atanmis.")
    for k, val in updates.items():
        setattr(v, k, val)
    db.commit()
    return {"detail": "Arac guncellendi"}


@router.delete("/vehicles/{v_id}")
def delete_vehicle(v_id: int, db: Session = Depends(get_db)):
    v = db.query(Vehicle).filter(Vehicle.id == v_id).first()
    if not v:
        raise HTTPException(404, "Arac bulunamadi")
    db.delete(v)
    db.commit()
    return {"detail": "Arac silindi"}
