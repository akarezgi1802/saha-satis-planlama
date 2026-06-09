# -*- coding: utf-8 -*-
import os
import time
import random
import numpy as np


PENALTY_MULTIPLIER = 10.0
FEASIBILITY_EPS = 1e-9


# =========================================================
# 2) MESAFE HESAPLARI
# =========================================================
def compute_depot_distances(x_coords, y_coords, depot_coord):
    depot_x, depot_y = depot_coord
    return np.sqrt((x_coords - depot_x) ** 2 + (y_coords - depot_y) ** 2)


def compute_customer_distance_matrix(x_coords, y_coords):
    dx = x_coords[:, None] - x_coords[None, :]
    dy = y_coords[:, None] - y_coords[None, :]
    return np.sqrt(dx ** 2 + dy ** 2)


# =========================================================
# 3) COZUM TEMSILI (P-MEDIAN UYUMLU)
# =========================================================
def assign_customers_to_nearest_centers(centers, distance_matrix):
    n_customers = distance_matrix.shape[0]
    assignments = np.empty(n_customers, dtype=int)

    for i in range(n_customers):
        best_center = min(centers, key=lambda c: distance_matrix[i, c])
        assignments[i] = best_center

    return assignments


def generate_initial_solution_pmedian(n_customers, n_st, distance_matrix):
    if n_st > n_customers:
        raise ValueError("ST sayisi musteri sayisindan fazla olamaz.")

    centers = sorted(np.random.choice(n_customers, size=n_st, replace=False).tolist())
    assignments = assign_customers_to_nearest_centers(centers, distance_matrix)

    return {
        "centers": centers,
        "assignments": assignments,
    }


# =========================================================
# 4) FEASIBILITY VE METRIKLER
# =========================================================
def is_feasible(solution, n_st):
    centers = solution["centers"]
    if len(centers) != n_st:
        return False
    if len(set(centers)) != n_st:
        return False
    return True


def compute_st_metrics(solution, revenue, visit_freq):
    centers = solution["centers"]
    assignments = solution["assignments"]

    n_st = len(centers)
    st_revenues = np.zeros(n_st)
    st_visits = np.zeros(n_st)

    center_to_st = {center: st_idx for st_idx, center in enumerate(centers)}

    for i, assigned_center in enumerate(assignments):
        st_idx = center_to_st[assigned_center]
        st_revenues[st_idx] += revenue[i]
        st_visits[st_idx] += visit_freq[i]

    return st_revenues, st_visits


def is_solution_feasible_by_tolerance(
    solution,
    revenue,
    visit_freq,
    revenue_tol=0.10,
    visit_tol=0.10
):
    n_st = len(solution["centers"])
    st_revenues, st_visits = compute_st_metrics(solution, revenue, visit_freq)

    target_revenue = np.sum(revenue) / n_st
    target_visits = np.sum(visit_freq) / n_st

    revenue_dev_ratio = np.abs(st_revenues - target_revenue) / (target_revenue + 1e-9)
    visit_dev_ratio = np.abs(st_visits - target_visits) / (target_visits + 1e-9)

    revenue_ok = np.all(revenue_dev_ratio <= revenue_tol + 1e-12)
    visit_ok = np.all(visit_dev_ratio <= visit_tol + 1e-12)

    return revenue_ok and visit_ok


# =========================================================
# 5) AMAC FONKSIYONU
# =========================================================
def compute_pmedian_distance_objective(solution, distance_matrix):
    centers = solution["centers"]
    assignments = solution["assignments"]

    total_distance = 0.0
    st_distances = np.zeros(len(centers))

    center_to_st = {center: st_idx for st_idx, center in enumerate(centers)}

    for i, assigned_center in enumerate(assignments):
        d = distance_matrix[i, assigned_center]
        total_distance += d
        st_idx = center_to_st[assigned_center]
        st_distances[st_idx] += d

    return total_distance, st_distances, np.array(centers, dtype=int)


def compute_objectives(solution, distance_matrix):
    return compute_pmedian_distance_objective(solution, distance_matrix)


def compute_tolerance_penalty(
    solution,
    revenue,
    visit_freq,
    revenue_tol=0.10,
    visit_tol=0.10,
    penalty_factor=100000,
):
    n_st = len(solution["centers"])
    st_revenues, st_visits = compute_st_metrics(solution, revenue, visit_freq)

    target_revenue = np.sum(revenue) / n_st
    target_visits = np.sum(visit_freq) / n_st

    allowed_revenue_dev = revenue_tol * target_revenue
    allowed_visit_dev = visit_tol * target_visits

    revenue_dev_abs = np.abs(st_revenues - target_revenue)
    visit_dev_abs = np.abs(st_visits - target_visits)

    revenue_excess = np.maximum(0, revenue_dev_abs - allowed_revenue_dev)
    visit_excess = np.maximum(0, visit_dev_abs - allowed_visit_dev)

    revenue_violation_ratio = revenue_excess / (target_revenue + 1e-9)
    visit_violation_ratio = visit_excess / (target_visits + 1e-9)

    total_violation = np.sum(revenue_violation_ratio) + np.sum(visit_violation_ratio)
    penalty = PENALTY_MULTIPLIER * penalty_factor * total_violation

    revenue_dev_pct_abs = (revenue_dev_abs / (target_revenue + 1e-9)) * 100
    visit_dev_pct_abs = (visit_dev_abs / (target_visits + 1e-9)) * 100

    violation_details = {
        "target_revenue": target_revenue,
        "target_visits": target_visits,
        "allowed_revenue_dev": allowed_revenue_dev,
        "allowed_visit_dev": allowed_visit_dev,
        "allowed_revenue_dev_pct": revenue_tol * 100,
        "allowed_visit_dev_pct": visit_tol * 100,
        "st_revenues": st_revenues,
        "st_visits": st_visits,
        "revenue_dev_abs": revenue_dev_abs,
        "visit_dev_abs": visit_dev_abs,
        "revenue_excess": revenue_excess,
        "visit_excess": visit_excess,
        "revenue_violation_ratio": revenue_violation_ratio,
        "visit_violation_ratio": visit_violation_ratio,
        "total_violation": total_violation,
        "penalty_multiplier": PENALTY_MULTIPLIER,
        "max_revenue_dev_pct": float(np.max(revenue_dev_pct_abs)) if len(revenue_dev_pct_abs) else 0.0,
        "max_visit_dev_pct": float(np.max(visit_dev_pct_abs)) if len(visit_dev_pct_abs) else 0.0,
        "avg_revenue_dev_pct": float(np.mean(revenue_dev_pct_abs)) if len(revenue_dev_pct_abs) else 0.0,
        "avg_visit_dev_pct": float(np.mean(visit_dev_pct_abs)) if len(visit_dev_pct_abs) else 0.0,
    }

    return penalty, violation_details


def evaluate_solution_value(
    solution,
    distance_matrix,
    revenue,
    visit_freq,
    revenue_tol,
    visit_tol,
    penalty_factor,
):
    distance, _, _ = compute_objectives(solution, distance_matrix)
    penalty, violation_details = compute_tolerance_penalty(
        solution=solution,
        revenue=revenue,
        visit_freq=visit_freq,
        revenue_tol=revenue_tol,
        visit_tol=visit_tol,
        penalty_factor=penalty_factor,
    )
    total_value = distance + penalty
    return total_value, distance, penalty, violation_details


# =========================================================
# 6) CLONE
# =========================================================
def clone_solution(solution):
    return {
        "centers": solution["centers"].copy(),
        "assignments": solution["assignments"].copy()
    }


# =========================================================
# 7) REPAIR MEKANIZMASI
# =========================================================
def compute_load_deviation_info(solution, revenue, visit_freq):
    centers = solution["centers"]
    n_st = len(centers)

    st_revenues, st_visits = compute_st_metrics(solution, revenue, visit_freq)

    target_revenue = np.sum(revenue) / n_st
    target_visits = np.sum(visit_freq) / n_st

    rev_dev_ratio = (st_revenues - target_revenue) / (target_revenue + 1e-9)
    visit_dev_ratio = (st_visits - target_visits) / (target_visits + 1e-9)

    return {
        "st_revenues": st_revenues,
        "st_visits": st_visits,
        "target_revenue": target_revenue,
        "target_visits": target_visits,
        "rev_dev_ratio": rev_dev_ratio,
        "visit_dev_ratio": visit_dev_ratio,
    }


def get_st_customer_lists(solution):
    centers = solution["centers"]
    assignments = solution["assignments"]
    center_to_st = {center: idx for idx, center in enumerate(centers)}

    st_customers = [[] for _ in range(len(centers))]
    for i, assigned_center in enumerate(assignments):
        st_idx = center_to_st[assigned_center]
        st_customers[st_idx].append(i)

    return st_customers


def try_single_repair_move(
    solution,
    distance_matrix,
    revenue,
    visit_freq,
    revenue_tol,
    visit_tol,
    penalty_factor
):
    repaired = clone_solution(solution)
    centers = repaired["centers"]

    info = compute_load_deviation_info(repaired, revenue, visit_freq)
    st_customers = get_st_customer_lists(repaired)

    rev_dev_ratio = info["rev_dev_ratio"]
    visit_dev_ratio = info["visit_dev_ratio"]

    overloaded_st = []
    underloaded_st = []

    for st_idx in range(len(centers)):
        if (rev_dev_ratio[st_idx] > revenue_tol) or (visit_dev_ratio[st_idx] > visit_tol):
            overloaded_st.append(st_idx)

        if (rev_dev_ratio[st_idx] < -revenue_tol) or (visit_dev_ratio[st_idx] < -visit_tol):
            underloaded_st.append(st_idx)

    if not overloaded_st or not underloaded_st:
        return repaired, False

    current_value, _, _, _ = evaluate_solution_value(
        repaired,
        distance_matrix,
        revenue,
        visit_freq,
        revenue_tol,
        visit_tol,
        penalty_factor
    )

    best_solution = clone_solution(repaired)
    best_value = current_value
    improved = False

    for st_from in overloaded_st:
        from_center = centers[st_from]

        movable_customers = [c for c in st_customers[st_from] if c != from_center]
        if not movable_customers:
            continue

        candidate_scores = []
        for cust in movable_customers:
            current_dist = distance_matrix[cust, from_center]

            feasible_targets = [st_to for st_to in underloaded_st if st_to != st_from]
            if not feasible_targets:
                continue

            alt_dist = min(distance_matrix[cust, centers[st_to]] for st_to in feasible_targets)
            gap = abs(alt_dist - current_dist)
            candidate_scores.append((gap, cust))

        candidate_scores.sort(key=lambda x: x[0])

        for _, cust in candidate_scores[:5]:
            for st_to in underloaded_st:
                if st_to == st_from:
                    continue

                to_center = centers[st_to]

                test_solution = clone_solution(repaired)
                test_solution["assignments"][cust] = to_center

                test_value, _, _, _ = evaluate_solution_value(
                    test_solution,
                    distance_matrix,
                    revenue,
                    visit_freq,
                    revenue_tol,
                    visit_tol,
                    penalty_factor
                )

                if test_value < best_value:
                    best_value = test_value
                    best_solution = clone_solution(test_solution)
                    improved = True

    return best_solution, improved


def repair_solution(
    solution,
    distance_matrix,
    revenue,
    visit_freq,
    revenue_tol,
    visit_tol,
    penalty_factor,
    max_repair_iters=3
):
    repaired = clone_solution(solution)

    for _ in range(max_repair_iters):
        if is_solution_feasible_by_tolerance(
            repaired,
            revenue,
            visit_freq,
            revenue_tol=revenue_tol,
            visit_tol=visit_tol
        ):
            break

        new_solution, improved = try_single_repair_move(
            repaired,
            distance_matrix,
            revenue,
            visit_freq,
            revenue_tol,
            visit_tol,
            penalty_factor
        )

        if not improved:
            break

        repaired = new_solution

    return repaired



# =========================================================
# 7.5) CONVEX HULL REMOVE & REASSIGN DUZELTME
#     Matematiksel modeldeki mantik SA cozum temsiline uyarlandi:
#     1) Her bolgenin convex hull siniri cikarilir.
#     2) Kendi bolgesi disindaki baska bir hull icinde kalan musteri "casus" sayilir.
#     3) Casuslar mevcut bolgesinden REMOVE edilir.
#     4) Temiz bolge hull'lari yeniden kurulur.
#     5) Casus temiz hull'lardan birinin icindeyse Kural A ile oraya atanir.
#        Degilse en yakin 2 merkez arasindan ziyaret yuku daha dusuk olana atanir.
# =========================================================
def _convex_dependencies_available():
    try:
        from scipy.spatial import ConvexHull  # noqa: F401
        from shapely.geometry import Polygon, Point  # noqa: F401
        return True
    except Exception:
        return False


def _solution_to_region_lists(solution):
    centers = solution["centers"]
    assignments = solution["assignments"]
    center_to_st = {center: idx for idx, center in enumerate(centers)}
    regions = {center: [] for center in centers}

    for customer_idx, assigned_center in enumerate(assignments):
        if assigned_center in center_to_st:
            regions[assigned_center].append(customer_idx)

    return regions


def _build_region_convex_polygons(regions, x_coords, y_coords):
    from scipy.spatial import ConvexHull
    from shapely.geometry import Polygon

    polygons = {}
    for center, customer_list in regions.items():
        if len(customer_list) >= 3:
            coords = np.array([[x_coords[i], y_coords[i]] for i in customer_list], dtype=float)
            try:
                hull = ConvexHull(coords)
                hull_points = coords[hull.vertices]
                polygons[center] = Polygon(hull_points)
            except Exception:
                polygons[center] = None
        else:
            polygons[center] = None
    return polygons


def find_convex_hull_spies(solution, x_coords, y_coords, buffer_distance=0.1):
    from shapely.geometry import Point

    centers = solution["centers"]
    assignments = solution["assignments"]
    polygons = _build_region_convex_polygons(
        _solution_to_region_lists(solution), x_coords, y_coords
    )

    spies = []
    for customer_idx, real_owner in enumerate(assignments):
        # Merkez musteriyi sokmek P-Median temsilini bozabilecegi icin merkezler korunur.
        if customer_idx in centers:
            continue

        point = Point(float(x_coords[customer_idx]), float(y_coords[customer_idx]))
        for other_center, polygon in polygons.items():
            if polygon is None:
                continue
            if real_owner != other_center and polygon.buffer(buffer_distance).contains(point):
                spies.append(customer_idx)
                break

    return spies


def apply_convex_hull_remove_reassign(
    solution,
    x_coords,
    y_coords,
    visit_freq,
    buffer_distance=0.1,
    verbose=False,
):
    if not _convex_dependencies_available():
        raise ImportError(
            "Convex hull duzeltmesi icin scipy ve shapely gerekli. "
            "Kurulum: pip install scipy shapely"
        )

    from shapely.geometry import Point

    corrected = clone_solution(solution)
    centers = corrected["centers"].copy()
    assignments = corrected["assignments"].copy()

    spies = find_convex_hull_spies(
        corrected, x_coords=x_coords, y_coords=y_coords, buffer_distance=buffer_distance
    )

    if not spies:
        return corrected, []

    regions = _solution_to_region_lists(corrected)

    # REMOVE: casuslari mevcut bolgelerinden sok.
    for spy in spies:
        old_owner = assignments[spy]
        if old_owner in regions and spy in regions[old_owner]:
            regions[old_owner].remove(spy)
            if verbose:
                print(f"REMOVE: Musteri index {spy}, merkez {old_owner} bolgesinden sokuldu.")

    # Temiz/saf hull'lari tekrar kur.
    clean_polygons = _build_region_convex_polygons(regions, x_coords, y_coords)

    # REASSIGN
    for spy in spies:
        point = Point(float(x_coords[spy]), float(y_coords[spy]))

        inside_center = None
        for center, polygon in clean_polygons.items():
            if polygon is not None and polygon.buffer(buffer_distance).contains(point):
                inside_center = center
                break

        if inside_center is not None:
            chosen_center = inside_center
            if verbose:
                print(f"KURAL A: Musteri index {spy}, saf hull icindeki merkez {chosen_center}'e atandi.")
        else:
            # Matematiksel modeldeki Kural B: en yakin 2 merkez + balance.
            # SA'nin revize halinde is_yuku yerine ziyaret sikligi kullaniliyor.
            distances = []
            for center in centers:
                d = np.sqrt((x_coords[spy] - x_coords[center]) ** 2 + (y_coords[spy] - y_coords[center]) ** 2)
                distances.append((d, center))
            distances.sort(key=lambda x: x[0])
            candidate_centers = [c for _, c in distances[:2]] if len(distances) >= 2 else [distances[0][1]]

            loads = []
            for center in candidate_centers:
                current_visit_load = sum(visit_freq[i] for i in regions.get(center, []))
                loads.append((current_visit_load, center))
            loads.sort(key=lambda x: x[0])
            chosen_center = loads[0][1]
            if verbose:
                print(f"KURAL B: Musteri index {spy}, en yakin iki merkez icinde ziyaret yuku dusuk olan {chosen_center}'e atandi.")

        regions[chosen_center].append(spy)
        assignments[spy] = chosen_center

    corrected["assignments"] = assignments
    return corrected, spies


# =========================================================
# 8) HEDEFLI KOMSULUKLAR
# =========================================================
def generate_center_swap_neighbor(solution, distance_matrix):
    centers = solution["centers"].copy()
    assignments = solution["assignments"].copy()
    n_customers = len(assignments)

    center_to_remove = random.choice(centers)
    non_centers = [i for i in range(n_customers) if i not in centers]

    if not non_centers:
        return clone_solution(solution)

    new_center = random.choice(non_centers)
    centers.remove(center_to_remove)
    centers.append(new_center)
    centers = sorted(centers)
    assignments = assign_customers_to_nearest_centers(centers, distance_matrix)

    return {
        "centers": centers,
        "assignments": assignments
    }


def generate_random_shift_neighbor(solution):
    centers = solution["centers"].copy()
    assignments = solution["assignments"].copy()
    n_customers = len(assignments)

    non_centers = [i for i in range(n_customers) if i not in centers]
    if not non_centers:
        return clone_solution(solution)

    node = random.choice(non_centers)
    current_center = assignments[node]
    possible_centers = [c for c in centers if c != current_center]

    if possible_centers:
        new_center = random.choice(possible_centers)
        assignments[node] = new_center

    return {
        "centers": centers,
        "assignments": assignments
    }


def generate_best_insertion_neighbor(
    solution,
    distance_matrix,
    revenue,
    visit_freq,
    revenue_tol,
    visit_tol,
    penalty_factor,
    candidate_sample_size=10,
):
    centers = solution["centers"]
    assignments = solution["assignments"]
    n_customers = len(assignments)

    non_centers = [i for i in range(n_customers) if i not in centers]
    if not non_centers:
        return clone_solution(solution)

    current_value, _, _, _ = evaluate_solution_value(
        solution, distance_matrix, revenue, visit_freq,
        revenue_tol, visit_tol, penalty_factor
    )

    sample_size = min(candidate_sample_size, len(non_centers))
    candidate_nodes = random.sample(non_centers, sample_size)

    best_neighbor = clone_solution(solution)
    best_value = float("inf")

    for node in candidate_nodes:
        current_center = assignments[node]
        for new_center in centers:
            if new_center == current_center:
                continue

            test_solution = clone_solution(solution)
            test_solution["assignments"][node] = new_center

            test_value, _, _, _ = evaluate_solution_value(
                test_solution,
                distance_matrix,
                revenue,
                visit_freq,
                revenue_tol,
                visit_tol,
                penalty_factor,
            )

            if test_value < best_value:
                best_value = test_value
                best_neighbor = test_solution

    if best_value == float("inf"):
        return clone_solution(solution)

    return best_neighbor


def get_boundary_customer_candidates(solution, distance_matrix, top_k=10):
    centers = solution["centers"]
    assignments = solution["assignments"]

    boundary_scores = []
    for i in range(len(assignments)):
        if i in centers:
            continue

        current_center = assignments[i]
        current_dist = distance_matrix[i, current_center]
        alt_dists = sorted(
            [(c, distance_matrix[i, c]) for c in centers if c != current_center],
            key=lambda x: x[1]
        )

        if not alt_dists:
            continue

        best_alt_center, best_alt_dist = alt_dists[0]
        gap = abs(best_alt_dist - current_dist)
        boundary_scores.append((gap, i, best_alt_center))

    boundary_scores.sort(key=lambda x: x[0])
    return boundary_scores[:top_k]


def generate_boundary_transfer_neighbor(
    solution,
    distance_matrix,
    revenue,
    visit_freq,
    revenue_tol,
    visit_tol,
    penalty_factor,
    top_k_boundary=10,
):
    boundary_candidates = get_boundary_customer_candidates(
        solution,
        distance_matrix,
        top_k=top_k_boundary
    )

    if not boundary_candidates:
        return clone_solution(solution)

    best_neighbor = clone_solution(solution)
    best_value = float("inf")

    for _, node, suggested_center in boundary_candidates:
        test_solution = clone_solution(solution)
        test_solution["assignments"][node] = suggested_center

        test_value, _, _, _ = evaluate_solution_value(
            test_solution,
            distance_matrix,
            revenue,
            visit_freq,
            revenue_tol,
            visit_tol,
            penalty_factor,
        )

        if test_value < best_value:
            best_value = test_value
            best_neighbor = test_solution

    return best_neighbor


def generate_best_swap_neighbor(
    solution,
    distance_matrix,
    revenue,
    visit_freq,
    revenue_tol,
    visit_tol,
    penalty_factor,
    customer_sample_size=12,
):
    centers = solution["centers"]
    assignments = solution["assignments"]
    n_customers = len(assignments)

    movable_nodes = [i for i in range(n_customers) if i not in centers]
    if len(movable_nodes) < 2:
        return clone_solution(solution)

    best_neighbor = clone_solution(solution)
    best_value = float("inf")

    sample_size = min(customer_sample_size, len(movable_nodes))
    sampled_nodes = random.sample(movable_nodes, sample_size)

    for idx_i in range(len(sampled_nodes)):
        for idx_j in range(idx_i + 1, len(sampled_nodes)):
            i = sampled_nodes[idx_i]
            j = sampled_nodes[idx_j]

            if assignments[i] == assignments[j]:
                continue

            test_solution = clone_solution(solution)
            test_solution["assignments"][i], test_solution["assignments"][j] = (
                test_solution["assignments"][j],
                test_solution["assignments"][i],
            )

            test_value, _, _, _ = evaluate_solution_value(
                test_solution,
                distance_matrix,
                revenue,
                visit_freq,
                revenue_tol,
                visit_tol,
                penalty_factor,
            )

            if test_value < best_value:
                best_value = test_value
                best_neighbor = test_solution

    if best_value == float("inf"):
        return clone_solution(solution)

    return best_neighbor


def generate_neighbor_solution(
    solution,
    distance_matrix,
    revenue,
    visit_freq,
    revenue_tol,
    visit_tol,
    penalty_factor,
    p_center_swap=0.15,
    p_random_shift=0.15,
    p_best_insertion=0.35,
    p_boundary_transfer=0.20,
    p_best_swap=0.15,
):
    probs = [
        p_center_swap,
        p_random_shift,
        p_best_insertion,
        p_boundary_transfer,
        p_best_swap,
    ]
    total_prob = sum(probs)

    if total_prob <= 0:
        return clone_solution(solution)

    normalized = [p / total_prob for p in probs]
    r = np.random.rand()

    cumulative = 0.0
    choices = [
        "center_swap",
        "random_shift",
        "best_insertion",
        "boundary_transfer",
        "best_swap",
    ]

    selected = choices[-1]
    for p, name in zip(normalized, choices):
        cumulative += p
        if r <= cumulative:
            selected = name
            break

    if selected == "center_swap":
        return generate_center_swap_neighbor(solution, distance_matrix)

    if selected == "random_shift":
        return generate_random_shift_neighbor(solution)

    if selected == "best_insertion":
        return generate_best_insertion_neighbor(
            solution, distance_matrix, revenue, visit_freq,
            revenue_tol, visit_tol, penalty_factor
        )

    if selected == "boundary_transfer":
        return generate_boundary_transfer_neighbor(
            solution, distance_matrix, revenue, visit_freq,
            revenue_tol, visit_tol, penalty_factor
        )

    return generate_best_swap_neighbor(
        solution, distance_matrix, revenue, visit_freq,
        revenue_tol, visit_tol, penalty_factor
    )


# =========================================================
# 9) BASLANGIC SICAKLIGI
# =========================================================
def calculate_initial_temperature(
    initial_solution,
    distance_matrix,
    revenue,
    visit_freq,
    penalty_factor,
    revenue_tol=0.10,
    visit_tol=0.10,
    sample_size=100,
    accept_prob=0.85,
    p_center_swap=0.15,
    p_random_shift=0.15,
    p_best_insertion=0.35,
    p_boundary_transfer=0.20,
    p_best_swap=0.15,
):
    current_value, _, _, _ = evaluate_solution_value(
        initial_solution,
        distance_matrix,
        revenue,
        visit_freq,
        revenue_tol,
        visit_tol,
        penalty_factor
    )

    positive_deltas = []

    for _ in range(sample_size):
        neighbor = generate_neighbor_solution(
            initial_solution,
            distance_matrix,
            revenue,
            visit_freq,
            revenue_tol,
            visit_tol,
            penalty_factor,
            p_center_swap=p_center_swap,
            p_random_shift=p_random_shift,
            p_best_insertion=p_best_insertion,
            p_boundary_transfer=p_boundary_transfer,
            p_best_swap=p_best_swap,
        )

        if not is_feasible(neighbor, len(initial_solution["centers"])):
            continue

        n_value, _, _, _ = evaluate_solution_value(
            neighbor,
            distance_matrix,
            revenue,
            visit_freq,
            revenue_tol,
            visit_tol,
            penalty_factor
        )

        delta = n_value - current_value
        if delta > 0:
            positive_deltas.append(delta)

    if not positive_deltas:
        return 2000

    avg_delta = np.mean(positive_deltas)
    t0 = -avg_delta / np.log(accept_prob)
    return t0


# =========================================================
# 10) SIMULATED ANNEALING
# =========================================================
def simulated_annealing(
    initial_solution,
    distance_matrix,
    revenue,
    visit_freq,
    T0=2000,
    Tmin=1,
    alpha=0.97,
    iter_per_temp=None,
    max_epochs_without_improvement=20,
    revenue_tol=0.10,
    visit_tol=0.10,
    penalty_factor=75000,
    adaptive_penalty=True,
    penalty_increase_rate=1.08,
    penalty_decrease_rate=0.97,
    min_penalty_factor=5000,
    max_penalty_factor=3000000,
    target_feasible_ratio_low=0.05,
    target_feasible_ratio_high=0.25,
    p_center_swap=0.15,
    p_random_shift=0.15,
    p_best_insertion=0.35,
    p_boundary_transfer=0.20,
    p_best_swap=0.15,
    use_repair=True,
    repair_iters=3,
    x_coords=None,
    y_coords=None,
    use_convex_hull_iteration=False,
    convex_hull_temperature_ratio=0.50,
    convex_hull_buffer_distance=0.1,
    verbose=False
):
    current_solution = clone_solution(initial_solution)
    current_penalty_factor = penalty_factor

    current_value, current_distance, current_penalty, current_violation_details = evaluate_solution_value(
        current_solution,
        distance_matrix,
        revenue,
        visit_freq,
        revenue_tol,
        visit_tol,
        current_penalty_factor
    )

    best_solution = clone_solution(current_solution)
    best_value = current_value
    best_distance = current_distance
    best_penalty = current_penalty
    best_penalty_factor = current_penalty_factor
    best_violation_details = current_violation_details

    best_feasible_solution = None
    best_feasible_value = float("inf")
    best_feasible_distance = float("inf")
    best_feasible_penalty = 0.0
    best_feasible_penalty_factor = current_penalty_factor
    best_feasible_violation_details = None

    current_is_zero_penalty = current_violation_details["total_violation"] <= FEASIBILITY_EPS
    if current_is_zero_penalty:
        best_feasible_solution = clone_solution(current_solution)
        best_feasible_value = current_distance
        best_feasible_distance = current_distance
        best_feasible_penalty = 0.0
        best_feasible_penalty_factor = current_penalty_factor
        best_feasible_violation_details = current_violation_details

    def get_reported_best_value():
        if best_feasible_solution is not None:
            return best_feasible_value
        return best_value

    T = T0
    n_customers = len(current_solution["assignments"])

    if iter_per_temp is None:
        iterations_per_temp = 20 * n_customers
    else:
        iterations_per_temp = iter_per_temp

    history_best_values = [get_reported_best_value()]
    history_penalty_factors = [current_penalty_factor]
    history_feasible_ratios = []

    epochs_without_improvement = 0
    epoch_no = 0

    while T >= Tmin:
        epoch_no += 1
        epoch_improved = False

        feasible_count = 0
        accepted_count = 0
        total_count = 0

        for _ in range(iterations_per_temp):
            total_count += 1

            neighbor_solution = generate_neighbor_solution(
                current_solution,
                distance_matrix,
                revenue,
                visit_freq,
                revenue_tol,
                visit_tol,
                current_penalty_factor,
                p_center_swap=p_center_swap,
                p_random_shift=p_random_shift,
                p_best_insertion=p_best_insertion,
                p_boundary_transfer=p_boundary_transfer,
                p_best_swap=p_best_swap,
            )

            if use_repair:
                neighbor_solution = repair_solution(
                    solution=neighbor_solution,
                    distance_matrix=distance_matrix,
                    revenue=revenue,
                    visit_freq=visit_freq,
                    revenue_tol=revenue_tol,
                    visit_tol=visit_tol,
                    penalty_factor=current_penalty_factor,
                    max_repair_iters=repair_iters
            )

            if not is_feasible(neighbor_solution, len(current_solution["centers"])):
                history_best_values.append(get_reported_best_value())
                continue

            neighbor_value, neighbor_distance, neighbor_penalty, neighbor_violation_details = evaluate_solution_value(
                neighbor_solution,
                distance_matrix,
                revenue,
                visit_freq,
                revenue_tol,
                visit_tol,
                current_penalty_factor
            )

            neighbor_is_feasible = is_solution_feasible_by_tolerance(
                neighbor_solution,
                revenue,
                visit_freq,
                revenue_tol=revenue_tol,
                visit_tol=visit_tol
            )

            if neighbor_is_feasible:
                feasible_count += 1

            neighbor_is_zero_penalty = (
                neighbor_violation_details["total_violation"] <= FEASIBILITY_EPS
            )
            if neighbor_is_zero_penalty and neighbor_distance < best_feasible_distance:
                best_feasible_solution = clone_solution(neighbor_solution)
                best_feasible_value = neighbor_distance
                best_feasible_distance = neighbor_distance
                best_feasible_penalty = 0.0
                best_feasible_penalty_factor = current_penalty_factor
                best_feasible_violation_details = neighbor_violation_details
                epoch_improved = True

            delta = neighbor_value - current_value

            if delta < 0 or np.random.rand() < np.exp(-delta / max(T, 1e-12)):
                current_solution = clone_solution(neighbor_solution)
                current_value = neighbor_value
                current_distance = neighbor_distance
                current_penalty = neighbor_penalty
                current_violation_details = neighbor_violation_details
                accepted_count += 1

            if current_value < best_value:
                best_solution = clone_solution(current_solution)
                best_value = current_value
                best_distance = current_distance
                best_penalty = current_penalty
                best_penalty_factor = current_penalty_factor
                best_violation_details = current_violation_details
                epoch_improved = True

            history_best_values.append(get_reported_best_value())

        # =====================================================
        # EPOCH SONU DINAMIK CONVEX HULL DUZELTMESI
        # Yuksek sicaklikta SA serbest arama yapar. T < T0 * 0.5
        # olduktan sonra her epoch sonunda geometrik disiplin eklenir.
        # =====================================================
        if (
            use_convex_hull_iteration
            and x_coords is not None
            and y_coords is not None
            and T < T0 * convex_hull_temperature_ratio
        ):
            corrected_solution, spies = apply_convex_hull_remove_reassign(
                solution=current_solution,
                x_coords=x_coords,
                y_coords=y_coords,
                visit_freq=visit_freq,
                buffer_distance=convex_hull_buffer_distance,
                verbose=False,
            )

            if is_feasible(corrected_solution, len(current_solution["centers"])):
                corrected_value, corrected_distance, corrected_penalty, corrected_violation_details = evaluate_solution_value(
                    corrected_solution,
                    distance_matrix,
                    revenue,
                    visit_freq,
                    revenue_tol,
                    visit_tol,
                    current_penalty_factor
                )

                current_solution = clone_solution(corrected_solution)
                current_value = corrected_value
                current_distance = corrected_distance
                current_penalty = corrected_penalty
                current_violation_details = corrected_violation_details

                corrected_is_zero_penalty = (corrected_violation_details["total_violation"] <= FEASIBILITY_EPS)
                if corrected_is_zero_penalty and corrected_distance < best_feasible_distance:
                    best_feasible_solution = clone_solution(corrected_solution)
                    best_feasible_value = corrected_distance
                    best_feasible_distance = corrected_distance
                    best_feasible_penalty = 0.0
                    best_feasible_penalty_factor = current_penalty_factor
                    best_feasible_violation_details = corrected_violation_details
                    epoch_improved = True

                if corrected_value < best_value:
                    best_solution = clone_solution(corrected_solution)
                    best_value = corrected_value
                    best_distance = corrected_distance
                    best_penalty = corrected_penalty
                    best_penalty_factor = current_penalty_factor
                    best_violation_details = corrected_violation_details
                    epoch_improved = True

                history_best_values.append(get_reported_best_value())

                if verbose:
                    print(
                        f"Epoch sonu Convex Hull | "
                        f"T={T:.4f} | Esik={T0 * convex_hull_temperature_ratio:.4f} | "
                        f"Casus={len(spies)} | Corrected={corrected_value:.4f} | "
                        f"ReportedBest={get_reported_best_value():.4f}"
                    )

        feasible_ratio = feasible_count / max(total_count, 1)
        acceptance_ratio = accepted_count / max(total_count, 1)
        history_feasible_ratios.append(feasible_ratio)

        if adaptive_penalty:
            if feasible_ratio < target_feasible_ratio_low:
                current_penalty_factor *= penalty_increase_rate
            elif feasible_ratio > target_feasible_ratio_high:
                current_penalty_factor *= penalty_decrease_rate

            current_penalty_factor = min(
                max(current_penalty_factor, min_penalty_factor),
                max_penalty_factor
            )

        history_penalty_factors.append(current_penalty_factor)

        if verbose:
            reported_best_value = get_reported_best_value()
            if best_feasible_solution is not None:
                reported_distance = best_feasible_distance
                reported_penalty = best_feasible_penalty
                reported_violation_details = best_feasible_violation_details
            else:
                reported_distance = best_distance
                reported_penalty = best_penalty
                reported_violation_details = best_violation_details

            print(
                f"Epoch={epoch_no:3d} | "
                f"T={T:10.4f} | "
                f"Best={reported_best_value:12.4f} | "
                f"Curr={current_value:12.4f} | "
                f"Dist={reported_distance:10.4f} | "
                f"Pen={reported_penalty:10.4f} | "
                f"PenaltyFactor={current_penalty_factor:12.2f} | "
                f"FeasibleRatio={feasible_ratio:6.3f} | "
                f"AcceptanceRatio={acceptance_ratio:6.3f} | "
                f"MaxRevDev%={reported_violation_details['max_revenue_dev_pct']:6.2f} | "
                f"MaxVisitDev%={reported_violation_details['max_visit_dev_pct']:6.2f}"
            )

        if epoch_improved:
            epochs_without_improvement = 0
        else:
            epochs_without_improvement += 1

        if epochs_without_improvement >= max_epochs_without_improvement:
            if verbose:
                print(
                    f"\nSon {max_epochs_without_improvement} sicaklik seviyesinde "
                    f"iyilesme olmadi. Algoritma T={T:.2f} seviyesinde durduruluyor."
                )
            break

        T *= alpha

    if best_feasible_solution is not None:
        final_solution = best_feasible_solution
        final_value = best_feasible_value
        final_distance = best_feasible_distance
        final_penalty = best_feasible_penalty
        final_penalty_factor = best_feasible_penalty_factor
        final_violation_details = best_feasible_violation_details
    else:
        final_solution = best_solution
        final_value = best_value
        final_distance = best_distance
        final_penalty = best_penalty
        final_penalty_factor = best_penalty_factor
        final_violation_details = best_violation_details

        if verbose:
            print(
                "\nSifir cezali cozum bulunamadi; "
                "cezali en iyi cozum yedek olarak donduruluyor."
            )

    return (
        final_solution,
        final_value,
        (final_distance, final_penalty),
        history_best_values,
        history_penalty_factors,
        history_feasible_ratios,
        final_penalty_factor,
        final_violation_details
    )


# =========================================================
# WRAPPER: Uygulama cozucu arayuzu
# =========================================================
def run_simulated_annealing(
    x_coords, y_coords, revenue, visit_freq,
    n_st, revenue_tol=0.02, visit_tol=0.05,
    time_limit=None, num_runs=10,
    **kwargs,
):
    """SA tabanlı kümeleme. run_milp_clustering ile AYNI giriş/çıkış formatı."""
    import time as _time
    x = np.array(x_coords, dtype=float)
    y = np.array(y_coords, dtype=float)
    rev = np.array(revenue, dtype=float)
    vis = np.array(visit_freq, dtype=float)
    n = len(x)
    t_start = _time.time()

    distance_matrix = compute_customer_distance_matrix(x, y)

    best_global_solution = None
    best_global_value = float("inf")
    best_global_distance = 0.0

    for _run in range(num_runs):
        initial_solution = generate_initial_solution_pmedian(n, n_st, distance_matrix)
        dynamic_T0 = calculate_initial_temperature(
            initial_solution=initial_solution,
            distance_matrix=distance_matrix,
            revenue=rev, visit_freq=vis,
            penalty_factor=75000,
            revenue_tol=revenue_tol, visit_tol=visit_tol,
            accept_prob=0.85,
            p_center_swap=0.15, p_random_shift=0.15,
            p_best_insertion=0.35, p_boundary_transfer=0.20, p_best_swap=0.15,
        )
        (best_solution, best_value, (best_distance, best_penalty),
         _hist, _ph, _fh, _bpf, _vd) = simulated_annealing(
            initial_solution=initial_solution,
            distance_matrix=distance_matrix,
            revenue=rev, visit_freq=vis,
            T0=dynamic_T0, Tmin=1, alpha=0.97,
            iter_per_temp=20 * n,
            max_epochs_without_improvement=30,
            revenue_tol=revenue_tol, visit_tol=visit_tol,
            penalty_factor=75000, adaptive_penalty=True,
            p_center_swap=0.15, p_random_shift=0.15,
            p_best_insertion=0.35, p_boundary_transfer=0.20, p_best_swap=0.15,
            use_repair=True, repair_iters=3,
            x_coords=x, y_coords=y,
            use_convex_hull_iteration=True,
            verbose=False,
        )
        if best_value < best_global_value:
            best_global_value = best_value
            best_global_solution = clone_solution(best_solution)
            best_global_distance = best_distance

    # SA çözümünü uygulama formatına (clusters) çevir
    centers = best_global_solution["centers"]
    assignments = best_global_solution["assignments"]
    clusters = {}
    for ci, center in enumerate(centers):
        members = [i for i in range(n) if assignments[i] == center]
        if not members:
            continue
        clusters[ci] = {
            "center_index": int(center),
            "customer_indices": [int(m) for m in members],
        }

    return {
        "clusters": clusters,
        "total_distance": float(best_global_distance),
        "solve_time": _time.time() - t_start,
        "is_feasible": True,
        "details": {"solver": "SA", "objective": float(best_global_value), "num_runs": num_runs},
    }
