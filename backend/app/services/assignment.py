"""
Model 2: Haftalik Gun Atamasi (MILP)
Orijinal kod: atama_gercek_veri_2.py
Excel bagimliligi kaldirildi. Bir ST'nin musterileri icin calisir.
"""
import math
import numpy as np
from itertools import combinations
import pulp


def _haversine_km(lat1, lon1, lat2, lon2):
    """Iki nokta arasi Haversine mesafesi (km). lat=enlem, lon=boylam."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


DAY_NAMES = {1: "Pzt", 2: "Sal", 3: "Car", 4: "Per", 5: "Cum", 6: "Cmt"}

TEMPLATES = {
    3: [(1, 3, 5), (2, 4, 6), (1, 3, 6), (1, 4, 6)],
    2: [(1, 4), (1, 5), (2, 5), (2, 6), (3, 6)],
    1: [(1,), (2,), (3,), (4,), (5,), (6,)],
}


def run_weekly_assignment(
    customer_indices,
    x_coords,
    y_coords,
    visit_frequencies,
    depot_x=38.6567541,
    depot_y=27.3435846,
    days=None,
    q=3,
    capacity=60,
    delta=2,
    alpha=0.5,
    time_limit=3600,
):
    """
    Bir ST'nin musterilerini haftanin gunlerine atar.

    Args:
        customer_indices: musteri indeksleri (0-based)
        x_coords, y_coords: tum musterilerin koordinatlari
        visit_frequencies: her musterinin haftalik ziyaret sikligi (1, 2, veya 3)
        depot_x, depot_y: depo koordinatlari
        days: kullanilacak gunler listesi, ornegin [1,2,3,4,5] (Pzt-Cum)
        q: her ziyaretin kapasite maliyeti
        capacity: gunluk maks kapasite
        delta: is yuku denge toleransi
        alpha: musteri-arasi mesafe agirligi (lambda = 1-alpha)
        time_limit: cozucu zaman siniri (saniye)

    Returns:
        dict: gun bazli musteri atamalari ve metrikler
    """
    if days is None:
        days = [1, 2, 3, 4, 5, 6]

    I = list(customer_indices)
    G = days
    n = len(I)

    if n == 0:
        return {"assignments": {}, "day_customers": {g: [] for g in G}, "metrics": {}}

    xs = np.array([x_coords[i] for i in I])
    ys = np.array([y_coords[i] for i in I])
    freqs = np.array([visit_frequencies[i] for i in I])

    if depot_x is None:
        depot_x = float(np.mean(xs))
    if depot_y is None:
        depot_y = float(np.mean(ys))

    d = {}
    for a, b in combinations(range(n), 2):
        d[(a, b)] = _haversine_km(xs[a], ys[a], xs[b], ys[b])

    d0 = {}
    for a in range(n):
        d0[a] = _haversine_km(xs[a], ys[a], depot_x, depot_y)

    def mesafe(a, b):
        if a == b:
            return 0.0
        return d[(min(a, b), max(a, b))]

    S = {}
    for a in range(n):
        f = int(freqs[a])
        f = min(f, 3)
        f = max(f, 1)
        available = [t for t in TEMPLATES.get(f, [(1,)]) if all(g in G for g in t)]
        if not available:
            available = [tuple(G[:f])]
        S[a] = available

    total_visits = int(freqs.sum())
    avg = total_visits / len(G)

    model = pulp.LpProblem("WeeklyAssignment", pulp.LpMinimize)

    y = {(i, s_idx): pulp.LpVariable(f"y_{i}_{s_idx}", cat="Binary")
         for i in range(n) for s_idx in range(len(S[i]))}

    z = {(i, j, g): pulp.LpVariable(f"z_{i}_{j}_{g}", cat="Binary")
         for i, j in combinations(range(n), 2) for g in G}

    def varlik(i, g):
        return pulp.lpSum(y[i, s_idx] for s_idx, s in enumerate(S[i]) if g in s)

    lam = 1 - alpha
    t1 = pulp.lpSum(d[i, j] * z[i, j, g] for i, j in combinations(range(n), 2) for g in G)
    t2 = pulp.lpSum(d0[i] * varlik(i, g) for i in range(n) for g in G)
    model += alpha * t1 + lam * t2

    for i in range(n):
        model += pulp.lpSum(y[i, s_idx] for s_idx in range(len(S[i]))) == 1

    for g in G:
        model += pulp.lpSum(q * varlik(i, g) for i in range(n)) <= capacity
        model += pulp.lpSum(varlik(i, g) for i in range(n)) >= avg - delta
        model += pulp.lpSum(varlik(i, g) for i in range(n)) <= avg + delta

    for i, j in combinations(range(n), 2):
        for g in G:
            vi = varlik(i, g)
            vj = varlik(j, g)
            model += z[i, j, g] <= vi
            model += z[i, j, g] <= vj
            model += z[i, j, g] >= vi + vj - 1

    model.solve(pulp.PULP_CBC_CMD(msg=0, timeLimit=time_limit))

    if model.status != pulp.constants.LpStatusOptimal and pulp.value(model.objective) is None:
        return None

    selected = {}
    for i in range(n):
        for s_idx, s in enumerate(S[i]):
            if pulp.value(y[i, s_idx]) is not None and pulp.value(y[i, s_idx]) > 0.5:
                selected[i] = s

    day_customers_local = {g: [i for i in range(n) if g in selected.get(i, ())] for g in G}

    assignments = {}
    for i in range(n):
        real_id = I[i]
        assignments[real_id] = list(selected.get(i, ()))

    day_customers = {}
    for g in G:
        day_customers[g] = [I[i] for i in day_customers_local[g]]

    counts = [len(day_customers_local[g]) for g in G]
    return {
        "assignments": assignments,
        "day_customers": day_customers,
        "metrics": {
            "objective": float(pulp.value(model.objective) or 0),
            "workload_per_day": counts,
            "workload_std": float(np.std(counts)),
            "status": pulp.LpStatus[model.status],
        },
    }
