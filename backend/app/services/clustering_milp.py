"""
MILP Kumeleme + Convex Hull Post-Processing (Sapma Kesin Korumali)

Notebook'taki MILP modelini uygulama entegrasyonuna uyarlar.
Girdi/cikti formati run_simulated_annealing() ile aynidir.
"""

import math
import os
import re
import tempfile
import time

import numpy as np
import pulp

# scipy ve shapely opsiyonel — yoksa hull post-processing atlanir
try:
    from scipy.spatial import ConvexHull
    from shapely.geometry import Polygon, Point
    HAS_HULL = True
except ImportError:
    HAS_HULL = False

# Convex Hull buffer (cografi koordinatlar icin ~100 metre)
HULL_BUFFER = 0.001


# ─────────────────────────────────────────────────────────────────────────────
# YARDIMCI FONKSIYONLAR
# ─────────────────────────────────────────────────────────────────────────────

def _compute_distances(x, y):
    """n×n Oklid mesafe matrisi (dict of dict, indeks=0..n-1)."""
    n = len(x)
    mesafe = {}
    for i in range(n):
        mesafe[i] = {}
        for j in range(n):
            mesafe[i][j] = math.hypot(x[i] - x[j], y[i] - y[j])
    return mesafe


def _cbc_log_parse(log_text):
    """CBC log dosyasindan lower bound degerini parse eder."""
    lower_bound = None
    matches = re.findall(r"best possible\s+([-\d.eE+]+)", log_text)
    if matches:
        try:
            lower_bound = float(matches[-1])
        except Exception:
            pass
    if lower_bound is None and "Optimal solution found" in log_text:
        m = re.search(r"Objective value:\s+([-\d.eE+]+)", log_text)
        if m:
            try:
                lower_bound = float(m.group(1))
            except Exception:
                pass
    return lower_bound


# ─────────────────────────────────────────────────────────────────────────────
# MILP COZUCU
# ─────────────────────────────────────────────────────────────────────────────

def _solve_milp(I, x, y, rev, vis, mesafe, K, tau_ciro, tau_ziyaret, time_limit):
    """
    P-medyan tabanli MILP kumeleme modeli.

    I        : musteri indeks listesi [0, 1, ..., n-1]
    mesafe   : dict-of-dict mesafe matrisi
    K        : bolge (ST) sayisi
    tau_ciro : hasilat sapma toleransi (orn. 0.02)
    tau_ziyaret: ziyaret sapma toleransi (orn. 0.05)
    time_limit: CBC icin saniye cinsinden sure siniri
    """
    hedef_ciro = sum(rev[i] for i in I) / K
    hedef_ziyaret = sum(vis[i] for i in I) / K

    print(f"  [MILP] Model kuruluyor (n={len(I)}, K={K})...", flush=True)
    t_kur = time.time()

    prob = pulp.LpProblem("Bolgeleme", pulp.LpMinimize)

    # Karar degiskenleri
    y_var = pulp.LpVariable.dicts("y", I, cat="Binary")           # j merkez mi?
    x_var = pulp.LpVariable.dicts("x", [(i, j) for i in I for j in I], cat="Binary")  # i->j atamasi

    # Amac: toplam mesafeyi minimize et
    prob += pulp.lpSum(mesafe[i][j] * x_var[(i, j)] for i in I for j in I)

    # Tam K tane merkez sec
    prob += pulp.lpSum(y_var[j] for j in I) == K

    # Her musteri tam 1 merkeze atansin
    for i in I:
        prob += pulp.lpSum(x_var[(i, j)] for j in I) == 1

    # Atama sadece merkeze yapilabilir
    for i in I:
        for j in I:
            prob += x_var[(i, j)] <= y_var[j]

    # Ciro ve ziyaret sapma kisitlari
    for j in I:
        prob += (pulp.lpSum(rev[i] * x_var[(i, j)] for i in I)
                 >= hedef_ciro * (1 - tau_ciro) * y_var[j])
        prob += (pulp.lpSum(rev[i] * x_var[(i, j)] for i in I)
                 <= hedef_ciro * (1 + tau_ciro) * y_var[j])
        prob += (pulp.lpSum(vis[i] * x_var[(i, j)] for i in I)
                 >= hedef_ziyaret * (1 - tau_ziyaret) * y_var[j])
        prob += (pulp.lpSum(vis[i] * x_var[(i, j)] for i in I)
                 <= hedef_ziyaret * (1 + tau_ziyaret) * y_var[j])

    print(f"  [MILP] Model: {time.time() - t_kur:.1f}s | Kisit: {len(prob.constraints):,}", flush=True)
    print(f"  [MILP] CBC cozumu basliyor (time_limit={time_limit}s = {time_limit / 3600:.1f} saat)", flush=True)

    log_dosya = tempfile.NamedTemporaryFile(mode="w", suffix=".log", delete=False).name

    t_solve = time.time()
    solver = pulp.PULP_CBC_CMD(
        msg=True,
        timeLimit=time_limit,
        logPath=log_dosya,
        options=[
            "sec", str(time_limit),
            "maxNodes", "1000000",
            "ratio", "0.05",
            "preprocess", "on",
            "cuts", "on",
            "heuristics", "on",
        ],
    )
    prob.solve(solver)
    solve_time = time.time() - t_solve

    durum = pulp.LpStatus[prob.status]
    print(f"  [MILP] CBC bitti: {solve_time:.1f}s | Durum: {durum}", flush=True)

    try:
        amac = pulp.value(prob.objective)
    except Exception:
        amac = None

    # Lower bound parse
    lower_bound = None
    try:
        with open(log_dosya, "r") as f:
            log_text = f.read()
        lower_bound = _cbc_log_parse(log_text)
        os.unlink(log_dosya)
    except Exception:
        pass

    if amac is not None and durum == "Optimal" and lower_bound is None:
        lower_bound = amac

    # Gap hesabi
    gap = None
    if amac is not None and lower_bound is not None and abs(amac) > 1e-9:
        gap = abs(amac - lower_bound) / abs(amac) * 100

    if amac is None:
        return None, None, None, durum, lower_bound, gap, solve_time

    # Sonuclari topla
    secilen = [j for j in I if y_var[j].varValue is not None and y_var[j].varValue > 0.5]
    bolgeler = {m: [] for m in secilen}
    for i in I:
        for j in secilen:
            if x_var[(i, j)].varValue is not None and x_var[(i, j)].varValue > 0.5:
                bolgeler[j].append(i)

    return amac, secilen, bolgeler, durum, lower_bound, gap, solve_time


# ─────────────────────────────────────────────────────────────────────────────
# CONVEX HULL CAKISMA TESPITI
# ─────────────────────────────────────────────────────────────────────────────

def _detect_overlaps(I, x, y, secilen, bolgeler):
    """Her musterinin baska bolgenin Convex Hull'ina dustugunu tespit eder."""
    if not HAS_HULL:
        return [], {}

    bolge_cokgenleri = {}
    for merkez in secilen:
        noktalar = bolgeler[merkez]
        if len(noktalar) >= 3:
            coords = [[x[n], y[n]] for n in noktalar]
            try:
                hull = ConvexHull(coords)
                hull_points = [coords[v] for v in hull.vertices]
                bolge_cokgenleri[merkez] = Polygon(hull_points)
            except Exception:
                bolge_cokgenleri[merkez] = None
        else:
            bolge_cokgenleri[merkez] = None

    casus_listesi = []
    for i in I:
        sahibi = None
        for m in secilen:
            if i in bolgeler[m]:
                sahibi = m
                break
        if sahibi is None:
            continue

        nokta = Point(x[i], y[i])
        for diger_merkez, cokgen in bolge_cokgenleri.items():
            if sahibi != diger_merkez and cokgen is not None:
                if cokgen.buffer(HULL_BUFFER).contains(nokta):
                    casus_listesi.append(i)
                    break

    return casus_listesi, bolge_cokgenleri


# ─────────────────────────────────────────────────────────────────────────────
# SAPMA UYGUNLUK KONTROLLERI
# ─────────────────────────────────────────────────────────────────────────────

def _sapma_uygun_ekleme(bolge_musterileri, eklenecek, rev, vis,
                        hedef_ciro, hedef_ziyaret, tau_ciro, tau_ziyaret):
    """Ekleme sonrasi sapma siniri korunuyor mu?"""
    yeni_ciro = sum(rev[i] for i in bolge_musterileri) + rev[eklenecek]
    yeni_ziyaret = sum(vis[i] for i in bolge_musterileri) + vis[eklenecek]
    return (hedef_ciro * (1 - tau_ciro) <= yeni_ciro <= hedef_ciro * (1 + tau_ciro) and
            hedef_ziyaret * (1 - tau_ziyaret) <= yeni_ziyaret <= hedef_ziyaret * (1 + tau_ziyaret))


def _sapma_uygun_cikarma(bolge_musterileri, cikarilacak, rev, vis,
                         hedef_ciro, hedef_ziyaret, tau_ciro, tau_ziyaret):
    """Cikarma sonrasi sapma siniri korunuyor mu?"""
    if cikarilacak not in bolge_musterileri:
        return False
    kalanlar = [m for m in bolge_musterileri if m != cikarilacak]
    if not kalanlar:
        return False
    yeni_ciro = sum(rev[i] for i in kalanlar)
    yeni_ziyaret = sum(vis[i] for i in kalanlar)
    return (hedef_ciro * (1 - tau_ciro) <= yeni_ciro <= hedef_ciro * (1 + tau_ciro) and
            hedef_ziyaret * (1 - tau_ziyaret) <= yeni_ziyaret <= hedef_ziyaret * (1 + tau_ziyaret))


# ─────────────────────────────────────────────────────────────────────────────
# HULL POST-PROCESSING (SAPMA KESIN KORUMALI)
# ─────────────────────────────────────────────────────────────────────────────

def _post_process_hull(I, x, y, rev, vis, mesafe, secilen, bolgeler_orig,
                       casus_listesi, K, tau_ciro, tau_ziyaret):
    """
    Sapma kesin korumali Hull post-processing.

    Mantik:
      1. Mevcut bolgeden cikarma sapma sinirini KORUYOR mu?
      2. Yeni bolgeye ekleme sapma sinirini KORUYOR mu?
      3. Ikisi de evet -> tasi
      4. Aksi halde -> mevcut bolgesinde birak (sapma korunur)
    """
    bolgeler = {m: list(v) for m, v in bolgeler_orig.items()}

    if not casus_listesi:
        return bolgeler, 0, 0, 0

    hedef_ciro = sum(rev[i] for i in I) / K
    hedef_ziyaret = sum(vis[i] for i in I) / K

    giderilen = 0
    kalan = 0

    for casus in casus_listesi:
        # Casus su anki bolgesini bul
        eski_sahibi = None
        for m, mst in bolgeler.items():
            if casus in mst:
                eski_sahibi = m
                break
        if eski_sahibi is None:
            continue

        # Cikarma uygun mu?
        if not _sapma_uygun_cikarma(bolgeler[eski_sahibi], casus, rev, vis,
                                     hedef_ciro, hedef_ziyaret, tau_ciro, tau_ziyaret):
            kalan += 1
            continue

        # Adaylari mesafeye gore sirala
        adaylar = sorted(
            [(mesafe[casus][m], m) for m in secilen if m != eski_sahibi]
        )

        # Sapma sinirina uyan ilk adaya tasi
        atandi = False
        for dist, aday in adaylar:
            if _sapma_uygun_ekleme(bolgeler[aday], casus, rev, vis,
                                    hedef_ciro, hedef_ziyaret, tau_ciro, tau_ziyaret):
                bolgeler[eski_sahibi].remove(casus)
                bolgeler[aday].append(casus)
                giderilen += 1
                atandi = True
                break

        if not atandi:
            kalan += 1

    return bolgeler, len(casus_listesi), giderilen, kalan


# ─────────────────────────────────────────────────────────────────────────────
# ANA FONKSIYON — run_simulated_annealing() ILE AYNI ARAYUZ
# ─────────────────────────────────────────────────────────────────────────────

def run_milp_clustering(
    x_coords, y_coords, revenue, visit_freq,
    n_st, revenue_tol=0.02, visit_tol=0.05,
    time_limit=14400,
    **kwargs,
):
    """
    MILP tabanli kumeleme + Convex Hull post-processing.

    Parametreler (run_simulated_annealing ile uyumlu):
        x_coords    : numpy array — musterilerin x koordinatlari
        y_coords    : numpy array — musterilerin y koordinatlari
        revenue     : numpy array — aylık ciro
        visit_freq  : numpy array — ziyaret sikligi
        n_st        : int — bolge (ST) sayisi (K)
        revenue_tol : float — ciro sapma toleransi (orn. 0.02 = %2)
        visit_tol   : float — ziyaret sapma toleransi (orn. 0.05 = %5)
        time_limit  : int — CBC icin sure siniri (saniye)

    Donus (run_simulated_annealing ile ayni format):
        {
            "clusters": {
                0: {"center_index": int, "customer_indices": [int, ...]},
                1: {"center_index": int, "customer_indices": [int, ...]},
                ...
            },
            "total_distance": float,
            "solve_time": float,
            "is_feasible": bool,
            "details": {...}
        }
    """
    xx = np.array(x_coords, dtype=float)
    yy = np.array(y_coords, dtype=float)
    rev = np.array(revenue, dtype=float)
    vis = np.array(visit_freq, dtype=float)
    n = len(xx)
    K = n_st

    I = list(range(n))

    print(f"\n[MILP Clustering] n={n}, K={K}, rev_tol={revenue_tol}, vis_tol={visit_tol}", flush=True)
    print(f"  Hedef ciro/bolge: {sum(rev) / K:,.0f}", flush=True)
    print(f"  Hedef ziyaret/bolge: {sum(vis) / K:.1f}", flush=True)

    t_start = time.time()

    # 1. Mesafe matrisi
    print("  Mesafe matrisi hesaplaniyor...", flush=True)
    mesafe = _compute_distances(xx, yy)

    # 2. MILP coz
    amac, secilen, bolgeler, durum, lb, gap, solve_time = _solve_milp(
        I, xx, yy, rev, vis, mesafe, K, revenue_tol, visit_tol, time_limit
    )

    if amac is None:
        # Feasible cozum bulunamadi — bos sonuc don
        print(f"  [MILP] Feasible cozum bulunamadi ({durum})", flush=True)
        # Fallback: her musteriyi en yakin merkeze ata (basit p-medyan)
        # Bosalt, cunku MILP cozemedi
        return {
            "clusters": {},
            "total_distance": 0,
            "solve_time": time.time() - t_start,
            "is_feasible": False,
            "details": {"status": durum, "lower_bound": lb},
        }

    # 3. Convex Hull post-processing
    cakismalar, _ = _detect_overlaps(I, xx, yy, secilen, bolgeler)

    if cakismalar:
        print(f"  [Hull] {len(cakismalar)} cakisma tespit edildi, duzeltiliyor...", flush=True)
        bolgeler, n_casus, giderilen, kalan = _post_process_hull(
            I, xx, yy, rev, vis, mesafe, secilen, bolgeler,
            cakismalar, K, revenue_tol, visit_tol
        )
        print(f"  [Hull] Giderilen: {giderilen} | Kalan: {kalan}", flush=True)
    else:
        print("  [Hull] Cakisma yok, post-processing gerekmiyor", flush=True)

    # 4. Sonucu run_simulated_annealing formatinadonustur
    #    secilen: [merkez_idx, ...]  bolgeler: {merkez_idx: [musteri_idx, ...]}
    clusters = {}
    for ci, merkez in enumerate(secilen):
        musteriler = bolgeler[merkez]
        if not musteriler:
            continue
        clusters[ci] = {
            "center_index": merkez,
            "customer_indices": musteriler,
        }

    # Toplam mesafeyi hesapla (post-processing sonrasi)
    toplam_mesafe = 0
    for merkez, musteriler in bolgeler.items():
        for m in musteriler:
            toplam_mesafe += mesafe[m][merkez]

    total_time = time.time() - t_start

    print(f"\n  [MILP Clustering] Tamamlandi: {total_time:.1f}s ({total_time / 3600:.2f} saat)", flush=True)
    print(f"  Amac (MILP): {amac:.4f} | Mesafe (PP sonrasi): {toplam_mesafe:.4f}", flush=True)
    print(f"  Gap: {gap:.2f}%" if gap else "  Gap: N/A", flush=True)
    print(f"  Bolge sayisi: {len(clusters)} | Feasible: True", flush=True)

    return {
        "clusters": clusters,
        "total_distance": toplam_mesafe,
        "solve_time": total_time,
        "is_feasible": True,
        "details": {
            "status": durum,
            "milp_objective": amac,
            "lower_bound": lb,
            "gap_pct": gap,
            "hull_overlaps_detected": len(cakismalar) if cakismalar else 0,
            "hull_overlaps_resolved": giderilen if cakismalar else 0,
            "hull_overlaps_remaining": kalan if cakismalar else 0,
        },
    }
