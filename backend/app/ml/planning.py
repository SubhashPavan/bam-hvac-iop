"""Forecast → inventory policy: safety stock, reorder point, coverage.

Probabilistic, service-level driven — the safety stock reflects demand
uncertainty (σ from the forecast residuals) over the replenishment lead time.
This is the bridge from the forecasting layer to optimization.
"""
from __future__ import annotations

import math

# Rough lead-time profile (days) by category — MRO spares vary a lot by type.
_CATEGORY_LEAD = {
    "Bearings": 35, "Electrical": 28, "Motors": 70, "Filtration": 21, "Valves": 45,
    "Gaskets": 18, "Hydraulics": 55, "Pneumatics": 40, "Mechanical Seals": 60,
    "Safety": 25, "Instrumentation": 50, "Belts & Drives": 22, "Pumps": 75,
}


def _fnv(s: str) -> float:
    h = 2166136261
    for ch in s:
        h = ((h ^ ord(ch)) * 16777619) & 0xFFFFFFFF
    return h / 4294967296


def lead_time_days(material_id: str, category: str) -> int:
    """Deterministic per-material lead time (independent of the seeding RNG)."""
    base = _CATEGORY_LEAD.get(category, 40)
    jitter = int((_fnv(material_id + "lt") - 0.5) * base * 0.6)  # ±30%
    return max(7, base + jitter)


def norm_ppf(p: float) -> float:
    """Inverse standard-normal CDF (Acklam's rational approximation)."""
    if p <= 0:
        return -math.inf
    if p >= 1:
        return math.inf
    a = [-3.969683028665376e01, 2.209460984245205e02, -2.759285104469687e02,
         1.383577518672690e02, -3.066479806614716e01, 2.506628277459239e00]
    b = [-5.447609879822406e01, 1.615858368580409e02, -1.556989798598866e02,
         6.680131188771972e01, -1.328068155288572e01]
    c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e00,
         -2.549732539343734e00, 4.374664141464968e00, 2.938163982698783e00]
    d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e00,
         3.754408661907416e00]
    plow, phigh = 0.02425, 1 - 0.02425
    if p < plow:
        q = math.sqrt(-2 * math.log(p))
        return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / \
               ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1)
    if p <= phigh:
        q = p - 0.5
        r = q * q
        return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q / \
               (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1)
    q = math.sqrt(-2 * math.log(1 - p))
    return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / \
            ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1)


def policy(*, period_demand: float, sigma_period: float, lead_days: int,
           service_level: float, unit_cost: float) -> dict:
    """Compute safety stock / reorder point from monthly demand rate + σ.

    Periods are months; lead time is converted to months. σ over lead time
    scales with √(lead months) under the standard constant-lead-time model.
    """
    z = norm_ppf(service_level)
    lead_m = lead_days / 30.0
    demand_ltd = period_demand * lead_m
    sigma_ltd = sigma_period * math.sqrt(max(lead_m, 1e-6))
    safety_stock = max(0.0, z * sigma_ltd)
    reorder_point = demand_ltd + safety_stock
    coverage_days = (reorder_point / period_demand * 30.0) if period_demand > 0 else None

    # Reorder quantity (EOQ): sqrt(2·D·S / H) with S = fixed order cost,
    # H = annual holding cost per unit (~25% of unit cost). Floors at one month.
    annual_demand = period_demand * 12.0
    order_cost, holding = 50.0, max(0.5, 0.25 * unit_cost)
    eoq = math.sqrt(2 * annual_demand * order_cost / holding) if annual_demand > 0 else 0.0
    reorder_qty = max(period_demand, eoq)

    return {
        "lead_time_days": lead_days,
        "service_level": round(service_level, 3),
        "z": round(z, 3),
        "sigma_period": round(sigma_period, 2),
        "demand_over_lead": round(demand_ltd, 1),
        "safety_stock": round(safety_stock, 1),
        "reorder_point": round(reorder_point, 1),
        "reorder_qty": round(reorder_qty, 0),
        "recommended_coverage_days": round(coverage_days, 0) if coverage_days is not None else None,
        "safety_stock_value": round(safety_stock * unit_cost, 0),
    }
