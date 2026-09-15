"""Simulation engine — Monte Carlo what-if over demand + lead time.

Two questions planners ask:
  • "If we target service level X, what must we invest?"   → tradeoff_curve
  • "If demand surges / a supplier slips, what breaks?"    → simulate_scenario
    (bootstraps demand-over-lead from history, counts stockouts vs on-hand)

Deterministic (fixed RNG seed) so a given scenario reproduces exactly.
"""
from __future__ import annotations

import numpy as np

from ..db.models import Material
from .methods import auto_forecast
from .planning import lead_time_days, norm_ppf

_SEED = 42
SERVICE_LEVELS = [0.80, 0.85, 0.90, 0.925, 0.95, 0.965, 0.98, 0.99, 0.995]


def _components(pairs: list[tuple[Material, list]]):
    """Per-material (rate, sigma, lead_months, unit_cost, on_hand, hist, ved, value)."""
    out = []
    for m, series in pairs:
        hist = np.asarray(series, dtype=float)
        if hist.size == 0:
            continue
        rate = max(0.0, auto_forecast(series)["per_period"])
        sigma = float(hist.std())
        lead_m = lead_time_days(m.id, m.category) / 30.0
        out.append((rate, sigma, lead_m, m.unit_cost, m.on_hand_qty, hist, m.ved,
                    m.current_stock_value))
    return out


def _investment_at(comps, service_level: float, demand_mult: float = 1.0,
                   lead_mult: float = 1.0) -> float:
    """Optimal investment to hit a service level: cycle + safety + lead demand."""
    z = norm_ppf(service_level)
    inv = 0.0
    for rate, sigma, lead_m, uc, *_ in comps:
        r = rate * demand_mult
        s = sigma * demand_mult
        lm = lead_m * lead_mult
        ss = max(0.0, z * s * np.sqrt(max(lm, 1e-6)))
        target_units = r * lm + ss + r  # demand-over-lead + safety + one cycle
        inv += target_units * uc
    return inv


def tradeoff_curve(pairs, *, plants=None) -> dict:
    comps = _components(pairs)
    curve = [{"service": round(sl * 100, 1), "investment": round(_investment_at(comps, sl), 0)}
             for sl in SERVICE_LEVELS]
    current_investment = sum(c[7] for c in comps)
    current_service = (round(sum(p.service_level for p in plants) / len(plants), 1)
                       if plants else None)
    return {"curve": curve, "current_service": current_service,
            "current_investment": round(current_investment, 0)}


def simulate_scenario(pairs, *, label: str, demand_mult: float = 1.0, lead_mult: float = 1.0,
                      target_service: float = 0.95, trials: int = 500, saved_at: str = "") -> dict:
    comps = _components(pairs)
    rng = np.random.default_rng(_SEED)

    baseline_inv = sum(c[7] for c in comps)
    scenario_inv = _investment_at(comps, target_service, demand_mult, lead_mult)

    risks: list[float] = []
    weights: list[float] = []
    at_risk = 0
    for rate, sigma, lead_m, uc, on_hand, hist, ved, value in comps:
        lm = lead_m * lead_mult
        L = max(1, int(round(lm)))
        # bootstrap demand over the lead time from history, scaled by the surge
        draws = rng.choice(hist, size=(trials, L), replace=True).sum(axis=1) * demand_mult
        risk = float(np.mean(draws > on_hand))
        risks.append(risk)
        weights.append(value)
        if risk > 0.10 and ved in ("Vital", "Essential"):
            at_risk += 1

    w = np.asarray(weights)
    r = np.asarray(risks)
    stockout_risk = float(np.average(r, weights=w)) if w.sum() > 0 else float(r.mean() if len(r) else 0)
    attained_service = round((1 - stockout_risk) * 100, 1)

    snapshot = {
        "scenario": label,
        "service": attained_service,
        "investment": round(scenario_inv, 0),
        "stockoutRisk": round(stockout_risk * 100, 1),
        "savedAt": saved_at,
    }
    return {
        "scenario": label,
        "demand_multiplier": demand_mult,
        "lead_multiplier": lead_mult,
        "target_service_level": target_service,
        "material_count": len(comps),
        "trials": trials,
        "baseline_investment": round(baseline_inv, 0),
        "scenario_investment": round(scenario_inv, 0),
        "working_capital_delta": round(baseline_inv - scenario_inv, 0),
        "attained_service_level": attained_service,
        "stockout_risk": round(stockout_risk * 100, 1),
        "at_risk_count": at_risk,
        "snapshot": snapshot,
    }
