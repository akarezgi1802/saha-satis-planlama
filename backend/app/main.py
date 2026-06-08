import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from sqlalchemy import text

from .database import engine, Base, SessionLocal
from .models import Plan
from .routers import auth, customers, sales_reps, plans, settings, performance, announcements, ai, campaigns, install, routing, tasks, admin_demo, reports, fleet, carbon

Base.metadata.create_all(bind=engine)


# ── Lightweight migration: mevcut tablolara eksik kolonları ekle ──
# (Alembic kullanılmıyor; production DB'de schema değişikliği için)
def _run_migrations():
    migrations = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_target FLOAT DEFAULT 0",
        "ALTER TABLE sales_visits ADD COLUMN IF NOT EXISTS check_in_at TIMESTAMP NULL",
        "ALTER TABLE sales_visits ADD COLUMN IF NOT EXISTS check_out_at TIMESTAMP NULL",
        "ALTER TABLE sales_visits ADD COLUMN IF NOT EXISTS check_in_lat FLOAT NULL",
        "ALTER TABLE sales_visits ADD COLUMN IF NOT EXISTS check_in_lng FLOAT NULL",
        "ALTER TABLE sales_visits ADD COLUMN IF NOT EXISTS check_out_lat FLOAT NULL",
        "ALTER TABLE sales_visits ADD COLUMN IF NOT EXISTS check_out_lng FLOAT NULL",
        "ALTER TABLE sales_visits ADD COLUMN IF NOT EXISTS distance_from_customer_m FLOAT NULL",
        "ALTER TABLE customers ADD COLUMN IF NOT EXISTS tax_number VARCHAR(30) NULL",
        "ALTER TABLE customers ADD COLUMN IF NOT EXISTS tax_office VARCHAR(100) NULL",
        # ── Filo & Karbon tabloları ──
        """CREATE TABLE IF NOT EXISTS vehicle_types (
            id SERIAL PRIMARY KEY,
            name VARCHAR(200) NOT NULL,
            fuel_type VARCHAR(20) NOT NULL DEFAULT 'diesel',
            fuel_consumption_l_per_100km FLOAT NOT NULL DEFAULT 7.5,
            is_default BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT NOW()
        )""",
        """CREATE TABLE IF NOT EXISTS vehicles (
            id SERIAL PRIMARY KEY,
            plate_number VARCHAR(20) UNIQUE NOT NULL,
            vehicle_type_id INTEGER REFERENCES vehicle_types(id),
            assigned_user_id INTEGER REFERENCES users(id),
            notes TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        )""",
        """CREATE TABLE IF NOT EXISTS daily_actual_routes (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            route_date DATE NOT NULL,
            actual_distance_km FLOAT NOT NULL DEFAULT 0,
            actual_time_minutes FLOAT NOT NULL DEFAULT 0,
            estimated_distance_km FLOAT,
            estimated_time_minutes FLOAT,
            co2_emission_kg FLOAT,
            visit_count INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW()
        )""",
    ]
    with engine.connect() as conn:
        for sql in migrations:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception as e:
                print(f"[migration] '{sql[:60]}...' atlandı: {e}")


_run_migrations()

app = FastAPI(
    title="Saha Satis Planlama API",
    description="Kumeleme, haftalik atama ve rota optimizasyonu",
    version="1.0.0",
)


@app.on_event("startup")
def cleanup_stuck_plans():
    """Sunucu yeniden başlatıldığında çalışır durumda kalmış planları iptal et."""
    db = SessionLocal()
    try:
        stuck = db.query(Plan).filter(
            Plan.status.in_(["clustering", "assignment", "routing"])
        ).all()
        for plan in stuck:
            plan.status = "interrupted"
        if stuck:
            db.commit()
            print(f"[startup] {len(stuck)} takılı plan iptal edildi")
    finally:
        db.close()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(customers.router)
app.include_router(sales_reps.router)
app.include_router(plans.router)
app.include_router(settings.router)
app.include_router(performance.router)
app.include_router(announcements.router)
app.include_router(ai.router)
app.include_router(campaigns.router)
app.include_router(install.router)
app.include_router(routing.router)
app.include_router(tasks.router)
app.include_router(admin_demo.router)
app.include_router(reports.router)
app.include_router(fleet.router)
app.include_router(carbon.router)


# ── Frontend static dosyaları (deploy modunda) ──
FRONTEND_DIR = Path(__file__).resolve().parent.parent.parent / "frontend" / "build"

if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR / "static")), name="static-files")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        """API dışındaki tüm istekleri frontend'e yönlendir (SPA)."""
        file_path = FRONTEND_DIR / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(FRONTEND_DIR / "index.html"))
else:
    @app.get("/")
    def root():
        return {"message": "Saha Satis Planlama API", "docs": "/docs"}
