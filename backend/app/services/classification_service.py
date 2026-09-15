"""Classification service — ABC (Pareto by value), XYZ / FSN / VED buckets,
the ABC×XYZ and VED×FSN matrices, and a performance scorecard.

ABC is computed here (Pareto); XYZ/FSN/VED already live on the material.
"""
from __future__ import annotations

from collections import defaultdict

from ..db.models import Material


def _abc_class(materials: list[Material]) -> dict[str, str]:
    """Assign A/B/C by cumulative value share (80/15/5 Pareto)."""
    ranked = sorted(materials, key=lambda m: -m.current_stock_value)
    total = sum(m.current_stock_value for m in ranked) or 1.0
    out: dict[str, str] = {}
    cum = 0.0
    for m in ranked:
        cum += m.current_stock_value
        share = cum / total
        out[m.id] = "A" if share <= 0.80 else "B" if share <= 0.95 else "C"
    return out


def _buckets(materials: list[Material], key, order: list[str], total: float) -> list[dict]:
    agg: dict[str, list[float]] = defaultdict(lambda: [0, 0.0])  # count, value
    for m in materials:
        b = agg[key(m)]
        b[0] += 1
        b[1] += m.current_stock_value
    return [{"key": k, "count": agg[k][0], "value": round(agg[k][1], 0),
             "share": round(agg[k][1] / total, 3) if total else 0.0}
            for k in order if k in agg]


def _matrix(materials: list[Material], row_key, col_key, rows: list[str], cols: list[str]) -> list[dict]:
    agg: dict[tuple, list[float]] = defaultdict(lambda: [0, 0.0])
    for m in materials:
        c = agg[(row_key(m), col_key(m))]
        c[0] += 1
        c[1] += m.current_stock_value
    return [{"row": r, "col": c, "count": agg[(r, c)][0], "value": round(agg[(r, c)][1], 0)}
            for r in rows for c in cols if (r, c) in agg]


def classify_portfolio(materials: list[Material], *, plants: list | None = None,
                       forecast_accuracy: int = 85) -> dict:
    if not materials:
        return {"total_value": 0, "material_count": 0, "abc": [], "xyz": [], "fsn": [],
                "ved": [], "abc_xyz": [], "ved_fsn": [],
                "scorecard": {"service_level": 0, "inventory_turns": 0, "days_outstanding": 0,
                              "policy_compliance": 0, "forecast_accuracy": 0, "obsolescence_rate": 0}}

    total = sum(m.current_stock_value for m in materials) or 1.0
    abc = _abc_class(materials)
    abc_of = lambda m: abc[m.id]

    XYZ, FSN, VED, ABC = ["X", "Y", "Z"], ["Fast", "Slow", "Non-moving"], \
        ["Vital", "Essential", "Desirable"], ["A", "B", "C"]

    # scorecard
    annual_cogs = sum(m.unit_cost * m.avg_monthly_demand * 12 for m in materials)
    turns = round(annual_cogs / total, 2) if total else 0.0
    dio = round(365 / turns, 1) if turns else 0.0
    obsolete_value = sum(m.current_stock_value for m in materials
                         if m.fsn == "Non-moving" and m.coverage_days > 200)
    # policy compliance: coverage in a healthy band (30–180 days)
    in_band = sum(1 for m in materials if 30 <= m.coverage_days <= 180)
    compliance = round(in_band / len(materials) * 100, 1)
    service = round(sum(p.service_level for p in plants) / len(plants), 1) if plants else 0.0

    return {
        "total_value": round(total, 0),
        "material_count": len(materials),
        "abc": _buckets(materials, abc_of, ABC, total),
        "xyz": _buckets(materials, lambda m: m.xyz, XYZ, total),
        "fsn": _buckets(materials, lambda m: m.fsn, FSN, total),
        "ved": _buckets(materials, lambda m: m.ved, VED, total),
        "abc_xyz": _matrix(materials, abc_of, lambda m: m.xyz, ABC, XYZ),
        "ved_fsn": _matrix(materials, lambda m: m.ved, lambda m: m.fsn, VED, FSN),
        "scorecard": {
            "service_level": service,
            "inventory_turns": turns,
            "days_outstanding": dio,
            "policy_compliance": compliance,
            "forecast_accuracy": forecast_accuracy,
            "obsolescence_rate": round(obsolete_value / total, 3),
        },
    }
