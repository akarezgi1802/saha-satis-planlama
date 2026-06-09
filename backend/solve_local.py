"""
Tek seferlik LOKAL plan çözücü.
Render'ın 512MB limitini aşan MILP kümelemeyi lokalde (bol RAM) çözer,
sonucu doğrudan Neon DB'ye yazar. DATABASE_URL env ile Neon'a bağlanır.

Kullanım:
  cd backend && DATABASE_URL="postgresql://...neon..." ./venv/bin/python solve_local.py [PLAN_ID]
"""
import os
# Lokal çözüm DAİMA MILP kullanır (Render default'u SA; burada override ediyoruz)
os.environ["CLUSTER_SOLVER"] = "milp"

import sys
import app.routers.plans as P

PLAN_ID = int(sys.argv[1]) if len(sys.argv) > 1 else 7

# Time limit'lere DOKUNULMUYOR — uygulamadaki orijinal değerler kullanılır
# (kümeleme 14400s, atama 3600s, rotalama 900s). CBC, %5 gap'e ulaşınca
# zaten erken durur; lokalde bol RAM olduğu için tam kaliteli çözüm hedeflenir.

print(f"=== Plan {PLAN_ID} LOKAL çözülüyor (MILP, orijinal time_limit, Neon'a yazılacak) ===", flush=True)
P._run_full_pipeline(PLAN_ID)

# Sonuç durumu
from app.database import SessionLocal
from app.models import Plan
db = SessionLocal()
p = db.query(Plan).filter(Plan.id == PLAN_ID).first()
if p:
    print(f"=== BİTTİ === Plan {PLAN_ID} durum: {p.status} | mesafe: {p.total_distance}", flush=True)
else:
    print(f"=== Plan {PLAN_ID} bulunamadı (silinmiş olabilir). Önce arayüzden plan oluşturun. ===", flush=True)
