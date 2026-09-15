"""Inventory optimization — the optimal stock target per material, derived from
the forecast distribution, and the excess/deficit vs current on-hand.

target = reorder_point + one cycle of demand   (units)
       = [demand·lead + safety_stock] + demand·cycle
This is what the opportunity engine compares against on-hand to size savings.
"""
from __future__ import annotations

import numpy as np

from ..db.models import Material
from .methods import auto_forecast, backtest, method_for
from .planning import lead_time_days, policy

CYCLE_MONTHS = 1.0  # review/order cycle for cycle-stock


def optimal_target(material: Material, series: list[float], *, service_level: float = 0.95) -> dict:
    af = auto_forecast(series)
    rate = af["per_period"]
    # Sigma from the rolling-origin backtest — IDENTICAL basis to forecast_summary /
    # the SKU 360, so the Wizard tile savings reconcile with the Material Master grid.
    _, fn = method_for(af["pattern"])
    bt = backtest(series, fn, min_train=12)
    sigma = bt["sigma"] if bt["sigma"] not in (None, 0) else (float(np.std(series)) if len(series) else 0.0)
    lead = lead_time_days(material.id, material.category)
    pol = policy(period_demand=rate, sigma_period=sigma, lead_days=lead,
                 service_level=service_level, unit_cost=material.unit_cost)

    cycle_units = rate * CYCLE_MONTHS
    # round to whole units — same as forecast_summary.target_units — so per-SKU savings match exactly
    target_units = round(pol["reorder_point"] + cycle_units, 0)
    target_value = target_units * material.unit_cost

    on_hand = material.on_hand_qty
    excess_units = on_hand - target_units
    return {
        "rate": rate,
        "pattern": af["pattern"],
        "sigma": sigma,
        "lead_days": lead,
        "safety_stock": pol["safety_stock"],
        "reorder_point": pol["reorder_point"],
        "recommended_coverage_days": pol["recommended_coverage_days"],
        "target_units": round(target_units, 1),
        "target_value": round(target_value, 0),
        "excess_units": round(excess_units, 1),
        "excess_value": round(max(0.0, excess_units) * material.unit_cost, 0),
        "understocked": on_hand < pol["reorder_point"],
    }
