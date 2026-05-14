"""
Model 1: Kumeleme (Simulated Annealing - P-Median)
Orijinal kod: sefa kumeleme 3.py
Excel bagimliligi kaldirildi, fonksiyon olarak calisir.
"""
import time
import random
import numpy as np


PENALTY_MULTIPLIER = 10.0
FEASIBILITY_EPS = 1e-9


# =========================================================
# MESAFE HESAPLARI (Haversine — km cinsinden)
# =========================================================
def compute_customer_distance_matrix(x_coords, y_coords):
    """Haversine mesafe matrisi (km). x=enlem, y=boylam."""
    R = 6371.0
    lat1 = np.radians(x_coords[:, None])
    lat2 = np.radians(x_coords[None, :])
    lon1 = np.radians(y_coords[:, None])
    lon2 = np.radians(y_coords[None, :])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = np.sin(dlat / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon / 2) ** 2
    return R * 2 * np.arctan2(np.sqrt(a), np.sqrt(1 - a))


# =========================================================
# COZUM TEMSILI (P-MEDIAN UYUMLU)
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
# FEASIBILITY VE METRIKLER
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
# AMAC FONKSIYONU
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
        "target_revenue": float(target_revenue),
        "target_visits": float(target_visits),
        "allowed_revenue_dev": float(allowed_revenue_dev),
        "allowed_visit_dev": float(allowed_visit_dev),
        "allowed_revenue_dev_pct": revenue_tol * 100,
        "allowed_visit_dev_pct": visit_tol * 100,
        "total_violation": float(total_violation),
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
# CLONE
# =========================================================
def clone_solution(solution):
    return {
        "centers": solution["centers"].copy(),
        "assignments": solution["assignments"].copy()
    }


# =========================================================
# REPAIR MEKANIZMASI
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
# HEDEFLI KOMSULUKLAR
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
# BASLANGIC SICAKLIGI
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
# SIMULATED ANNEALING
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
    time_limit_per_run=None,
):
    run_start = time.time()

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

    T = T0
    n_customers = len(current_solution["assignments"])

    if iter_per_temp is None:
        iterations_per_temp = 20 * n_customers
    else:
        iterations_per_temp = iter_per_temp

    epochs_without_improvement = 0

    while T >= Tmin:
        if time_limit_per_run and (time.time() - run_start) >= time_limit_per_run:
            break

        epoch_improved = False

        feasible_count = 0
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

            if current_value < best_value:
                best_solution = clone_solution(current_solution)
                best_value = current_value
                best_distance = current_distance
                best_penalty = current_penalty
                best_penalty_factor = current_penalty_factor
                best_violation_details = current_violation_details
                epoch_improved = True

        feasible_ratio = feasible_count / max(total_count, 1)

        if adaptive_penalty:
            if feasible_ratio < target_feasible_ratio_low:
                current_penalty_factor *= penalty_increase_rate
            elif feasible_ratio > target_feasible_ratio_high:
                current_penalty_factor *= penalty_decrease_rate

            current_penalty_factor = min(
                max(current_penalty_factor, min_penalty_factor),
                max_penalty_factor
            )

        if epoch_improved:
            epochs_without_improvement = 0
        else:
            epochs_without_improvement += 1

        if epochs_without_improvement >= max_epochs_without_improvement:
            break

        T *= alpha

    if best_feasible_solution is not None:
        final_solution = best_feasible_solution
        final_distance = best_feasible_distance
        final_penalty = best_feasible_penalty
        final_penalty_factor = best_feasible_penalty_factor
        final_violation_details = best_feasible_violation_details
    else:
        final_solution = best_solution
        final_distance = best_distance
        final_penalty = best_penalty
        final_penalty_factor = best_penalty_factor
        final_violation_details = best_violation_details

    return (
        final_solution,
        final_distance,
        final_penalty,
        final_penalty_factor,
        final_violation_details
    )


# =========================================================
# COKLU RUN + PIPELINE UYUMLU ANA FONKSIYON
# =========================================================
def run_simulated_annealing(
    x_coords, y_coords, revenue, visit_freq,
    n_st, revenue_tol=0.03, visit_tol=0.05,
    num_runs=5, penalty_factor=75000, alpha=0.97,
    time_limit=10800,
):
    """
    Ana kumeleme fonksiyonu. Veritabanindan gelen numpy array'leri alir,
    kumeleme sonucunu dict olarak doner.
    """
    x = np.array(x_coords, dtype=float)
    y = np.array(y_coords, dtype=float)
    rev = np.array(revenue, dtype=float)
    vis = np.array(visit_freq, dtype=float)
    n_customers = len(x)

    dist_mat = compute_customer_distance_matrix(x, y)

    best_global_solution = None
    best_global_distance = float("inf")
    best_global_is_feasible = False
    best_global_details = None

    t_start = time.time()
    time_per_run = time_limit / num_runs

    p_center_swap = 0.15
    p_random_shift = 0.15
    p_best_insertion = 0.35
    p_boundary_transfer = 0.20
    p_best_swap = 0.15

    for run in range(num_runs):
        if time.time() - t_start >= time_limit:
            break

        initial_solution = generate_initial_solution_pmedian(
            n_customers, n_st, dist_mat
        )

        dynamic_T0 = calculate_initial_temperature(
            initial_solution=initial_solution,
            distance_matrix=dist_mat,
            revenue=rev,
            visit_freq=vis,
            penalty_factor=penalty_factor,
            revenue_tol=revenue_tol,
            visit_tol=visit_tol,
            accept_prob=0.85,
            p_center_swap=p_center_swap,
            p_random_shift=p_random_shift,
            p_best_insertion=p_best_insertion,
            p_boundary_transfer=p_boundary_transfer,
            p_best_swap=p_best_swap,
        )

        (
            best_solution,
            best_distance,
            best_penalty,
            best_penalty_factor,
            best_violation_details,
        ) = simulated_annealing(
            initial_solution=initial_solution,
            distance_matrix=dist_mat,
            revenue=rev,
            visit_freq=vis,
            T0=dynamic_T0,
            Tmin=1,
            alpha=alpha,
            iter_per_temp=20 * n_customers,
            max_epochs_without_improvement=30,
            revenue_tol=revenue_tol,
            visit_tol=visit_tol,
            penalty_factor=penalty_factor,
            adaptive_penalty=True,
            p_center_swap=p_center_swap,
            p_random_shift=p_random_shift,
            p_best_insertion=p_best_insertion,
            p_boundary_transfer=p_boundary_transfer,
            p_best_swap=p_best_swap,
            use_repair=True,
            repair_iters=3,
            time_limit_per_run=time_per_run,
        )

        run_is_feasible = best_penalty <= FEASIBILITY_EPS

        is_better = (
            best_global_solution is None
            or (run_is_feasible and not best_global_is_feasible)
            or (run_is_feasible == best_global_is_feasible and best_distance < best_global_distance)
        )

        if is_better:
            best_global_solution = clone_solution(best_solution)
            best_global_distance = best_distance
            best_global_is_feasible = run_is_feasible
            best_global_details = best_violation_details

    solve_time = time.time() - t_start

    centers = best_global_solution["centers"]
    assignments = best_global_solution["assignments"]
    c2s = {c: i for i, c in enumerate(centers)}

    clusters = {}
    for i, ac in enumerate(assignments):
        ci = c2s[ac]
        if ci not in clusters:
            clusters[ci] = {"center_index": ac, "customer_indices": []}
        clusters[ci]["customer_indices"].append(i)

    return {
        "clusters": clusters,
        "total_distance": best_global_distance,
        "details": best_global_details,
        "solve_time": solve_time,
        "is_feasible": best_global_is_feasible,
    }
