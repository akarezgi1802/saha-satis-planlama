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

# ── ORİJİNAL DAVRANIS ──
# Time limit'lere normalde DOKUNULMAZ: kümeleme 14400s, atama 3600s, rotalama 900s.
# CBC, %5 gap'e ulaşınca zaten erken durur; lokalde bol RAM olduğu için tam
# kaliteli çözüm hedeflenir.

# ── TEST MODU (opsiyonel) ──
# TEST_CLUSTER_LIMIT env varsa SADECE kümeleme time_limit'i bu değerle override
# edilir — refactor (session yenileme + DB yazma akışı) doğrulaması için.
# Atama ve rotalama orijinal değerlerde kalır (zaten kısa biterler).
_test_limit = os.environ.get("TEST_CLUSTER_LIMIT")
if _test_limit:
    _test_limit = int(_test_limit)
    _orig_milp = P.run_milp_clustering
    def _patched_milp(**kw):
        kw["time_limit"] = _test_limit
        return _orig_milp(**kw)
    P.run_milp_clustering = _patched_milp
    print(f"[TEST MODU] MILP kümeleme time_limit override: {_test_limit}s "
          f"({_test_limit/60:.0f} dk) — refactor testi.", flush=True)

print(f"=== Plan {PLAN_ID} LOKAL çözülüyor (MILP, Neon'a yazılacak) ===", flush=True)
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
