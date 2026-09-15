"""Forecasting service — turns a material + its demand series into the API
response shapes (detail, grid summary, aggregate outlook, movers).

Orchestrates: classify → auto-select method → backtest accuracy → build point
series with prediction bands → derive the inventory policy (safety stock / ROP).
"""
from __future__ import annotations

import numpy as np

from ..data.demand import MONTHS, month_label
from ..db.models import Material
from .diagnostics import root_cause
from .methods import auto_forecast, backtest, classify, method_for
from .planning import lead_time_days, norm_ppf, policy

_BAND_Z = 1.2816  # ~80% prediction band for the chart


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def _rel_label(i: int, months: int) -> str:
    rel = i - (months - 1)  # END month is 0
    return f"M{rel}" if rel <= 0 else f"M+{rel}"


def _trend_pct(hist: list[float]) -> int:
    """Recent 6-month mean vs the prior 6-month mean."""
    if len(hist) < 12:
        return 0
    recent = float(np.mean(hist[-6:]))
    prior = float(np.mean(hist[-12:-6]))
    if prior <= 1e-9:
        return 100 if recent > 0 else 0
    return int(round((recent / prior - 1) * 100))


def _accuracy(mae: float | None, mean_demand: float, cv2: float | None,
              mase: float | None = None) -> int:
    # MASE (scale-free, relative to the naive benchmark) is the right basis for
    # intermittent demand — point MAE-vs-mean is inherently harsh on spiky series.
    if mase is not None:
        return int(_clamp(round(100 - mase * 45), 25, 97))
    if mae is not None and mean_demand > 0:
        return int(_clamp(round((1 - mae / (mean_demand + 1e-9)) * 100), 20, 97))
    base = 0.95 - min((cv2 or 0.3), 0.6) * 0.5
    return int(_clamp(round(base * 100), 20, 97))


def forecast_detail(material: Material, series: list[float], *, horizon: int = 6,
                    service_level: float = 0.95, history_window: int = 12) -> dict:
    hist = [float(x) for x in series]
    months = len(hist)
    c = classify(hist)
    name, fn = method_for(c["pattern"])
    rate = max(0.0, fn(hist))
    bt = backtest(hist, fn, min_train=12)
    sigma = bt["sigma"] if bt["sigma"] not in (None, 0) else float(np.std(hist) or 0.0)
    mean_demand = float(np.mean(hist)) if hist else 0.0
    acc = _accuracy(bt["mae"], mean_demand, c["cv2"], bt["mase"])
    trend = _trend_pct(hist)

    # points — last `history_window` actuals, then the horizon forecast
    start = max(0, months - history_window)
    points = []
    for i in range(start, months):
        q = round(hist[i], 1)
        points.append({"month": month_label(i, months), "label": _rel_label(i, months),
                       "actual": q, "forecast": q, "lower": q, "upper": q})
    for h in range(1, horizon + 1):
        band = _BAND_Z * sigma * (1 + 0.08 * (h - 1))
        points.append({
            "month": month_label(months - 1 + h, months),
            "label": f"M+{h}",
            "actual": None,
            "forecast": round(rate, 1),
            "lower": round(max(0.0, rate - band), 1),
            "upper": round(rate + band, 1),
        })

    lead = lead_time_days(material.id, material.category)
    plan = policy(period_demand=rate, sigma_period=sigma, lead_days=lead,
                  service_level=service_level, unit_cost=material.unit_cost)

    insight = _insight(material, c["pattern"], name, rate, trend, plan)
    diag = root_cause(material, pattern=c["pattern"], rate=rate, trend=trend, plan=plan)

    return {
        "material_id": material.id,
        "plant_id": material.plant_id,
        "method": name,
        "demand_pattern": c["pattern"],
        "adi": c["adi"],
        "cv2": c["cv2"],
        "horizon_m": horizon,
        "history_m": months - start,
        "per_period_demand": round(rate, 2),
        "total_forecast_qty": round(rate * horizon, 1),
        "trend_pct": trend,
        "accuracy": {"model_accuracy": acc, "mae": bt["mae"], "bias": bt["bias"], "mase": bt["mase"]},
        "forecast_confidence": acc,
        "points": points,
        "planning": plan,
        "insight": insight,
        "root_cause_state": diag["state"],
        "drivers": diag["drivers"],
    }


def _insight(material: Material, pattern: str, method: str, rate: float, trend: int, plan: dict) -> str:
    dir_ = "rising" if trend > 8 else "falling" if trend < -8 else "stable"
    cov = plan["recommended_coverage_days"]
    lead = plan["lead_time_days"]
    tail = ""
    if pattern == "no_demand":
        tail = " No consumption on record - obsolescence candidate; TSB decays the forecast toward zero."
    elif material.coverage_days < (cov or 0):
        tail = f" On-hand coverage ({material.coverage_days}d) is below the {cov:.0f}d reorder point - replenishment indicated."
    return (f"{pattern.title()} demand ({dir_}, {trend:+d}% MoM); forecast via {method} at "
            f"~{rate:.1f}/mo. Lead time {lead}d -> reorder point {plan['reorder_point']:.0f} "
            f"(safety stock {plan['safety_stock']:.0f}).{tail}")


def forecast_summary(material: Material, series: list[float], *, service_level: float = 0.95) -> dict:
    hist = [float(x) for x in series]
    c = classify(hist)
    name, fn = method_for(c["pattern"])
    rate = max(0.0, fn(hist))
    bt = backtest(hist, fn, min_train=12)
    sigma = bt["sigma"] if bt["sigma"] not in (None, 0) else float(np.std(hist) or 0.0)
    mean_demand = float(np.mean(hist)) if hist else 0.0
    acc = _accuracy(bt["mae"], mean_demand, c["cv2"], bt["mase"])
    lead = lead_time_days(material.id, material.category)
    plan = policy(period_demand=rate, sigma_period=sigma, lead_days=lead,
                  service_level=service_level, unit_cost=material.unit_cost)
    target_units = round(plan["reorder_point"] + rate, 0)  # reorder point + one cycle
    excess_units = max(0.0, material.on_hand_qty - target_units)
    return {
        "material_id": material.id,
        "description": material.description,
        "plant_id": material.plant_id,
        "category": material.category,
        "ved": material.ved,
        "fsn": material.fsn,
        "xyz": material.xyz,
        "demand_pattern": c["pattern"],
        "method": name,
        "per_period_demand": round(rate, 2),
        "model_accuracy": acc,
        "trend_pct": _trend_pct(hist),
        "understocked": material.on_hand_qty < plan["reorder_point"],
        "coverage_days": material.coverage_days,
        # policy metrics for the grid
        "on_hand_qty": material.on_hand_qty,
        "stock_value": material.current_stock_value,
        "unit_cost": material.unit_cost,
        "safety_stock": round(plan["safety_stock"], 0),
        "reorder_point": round(plan["reorder_point"], 0),
        "reorder_qty": round(plan["reorder_qty"], 0),
        "target_units": target_units,
        "recommended_coverage_days": plan["recommended_coverage_days"],
        "lead_time_days": lead,
        "service_level": round(service_level * 100, 0),
        "savings": round(excess_units * material.unit_cost, 0),
    }


def aggregate_outlook(pairs: list[tuple[Material, list[float]]], *, horizon: int = 12) -> dict:
    """Sum forecasts across a selection — the dashboard demand outlook.

    Skips per-material backtest for speed; uses a fast rate + trend per item.
    """
    if not pairs:
        return {"total_forecast_qty": 0, "model_accuracy": 0, "growth_count": 0,
                "decline_count": 0, "material_count": 0, "xyz_mix": {}, "pattern_mix": {}, "points": []}

    # history length comes from the data (36 for the seed, 18 for an ingested file)
    months = max((len(s) for _, s in pairs if s), default=MONTHS)
    hist_window = min(6, months)
    hist_sum = np.zeros(months)
    rates: list[float] = []
    sigmas: list[float] = []
    growth = decline = 0
    xyz_mix = {"X": 0, "Y": 0, "Z": 0}
    pattern_mix: dict[str, int] = {}

    for m, series in pairs:
        hist = np.asarray(series, dtype=float)
        if hist.size != months:  # align ragged series (pad front / truncate to window)
            fixed = np.zeros(months)
            take = hist[-months:]
            fixed[months - take.size:] = take
            hist = fixed
        hist_sum += hist
        af = auto_forecast(hist.tolist())
        rate = af["per_period"]
        rates.append(rate)
        sigmas.append(float(hist.std()))
        xyz_mix[m.xyz] = xyz_mix.get(m.xyz, 0) + 1
        pattern_mix[af["pattern"]] = pattern_mix.get(af["pattern"], 0) + 1
        t = _trend_pct(series)
        if t > 0:
            growth += 1
        elif t < 0:
            decline += 1

    total_rate = float(np.sum(rates))
    total_sigma = float(np.sqrt(np.sum(np.square(sigmas))))  # independent-ish materials

    points = []
    start = months - hist_window
    for i in range(start, months):
        v = round(float(hist_sum[i]), 0)
        points.append({"month": month_label(i, months), "label": _rel_label(i, months),
                       "actual": v, "forecast": v, "lower": v, "upper": v})
    for h in range(1, horizon + 1):
        band = _BAND_Z * total_sigma * (1 + 0.05 * (h - 1))
        points.append({"month": month_label(months - 1 + h, months), "label": f"M+{h}",
                       "actual": None, "forecast": round(total_rate, 0),
                       "lower": round(max(0.0, total_rate - band), 0), "upper": round(total_rate + band, 0)})

    # aggregate accuracy proxy from the pattern mix (fast; no backtest)
    z_share = xyz_mix.get("Z", 0) / len(pairs)
    agg_acc = int(_clamp(round((0.95 - 0.3 * z_share) * 100), 40, 98))

    return {
        "total_forecast_qty": round(total_rate * horizon, 0),
        "model_accuracy": agg_acc,
        "growth_count": growth,
        "decline_count": decline,
        "material_count": len(pairs),
        "xyz_mix": xyz_mix,
        "pattern_mix": pattern_mix,
        "points": points,
    }


def movers(pairs: list[tuple[Material, list[float]]], *, limit: int = 10) -> list[dict]:
    scored = []
    for m, series in pairs:
        af = auto_forecast(series)
        t = _trend_pct(series)
        scored.append({"material_id": m.id, "description": m.description, "plant_id": m.plant_id,
                       "per_period_demand": round(af["per_period"], 2), "trend_pct": t,
                       "direction": "growth" if t > 0 else "decline" if t < 0 else "flat"})
    scored.sort(key=lambda r: abs(r["trend_pct"]), reverse=True)
    return scored[:limit]
