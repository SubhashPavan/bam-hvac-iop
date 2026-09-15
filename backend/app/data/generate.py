"""Deterministic seeded generator — a faithful port of the frontend's
`inventoryMock.ts`. Same LCG, same call order => identical data, so the UI
swaps mock -> API with the exact numbers users already see.

Replaced later by Databricks-gold reads behind the same shapes.
"""
from __future__ import annotations

import math

# ── seeded RNG (linear congruential, matches the TS) ─────────────────
_seed = 20260828


def _rnd() -> float:
    global _seed
    _seed = (_seed * 1664525 + 1013904223) % 4294967296
    return _seed / 4294967296


def _pick(arr: list):
    return arr[int(_rnd() * len(arr))]


def _rint(lo: int, hi: int) -> int:
    return int(lo + _rnd() * (hi - lo + 1))


def _rfloat(lo: float, hi: float) -> float:
    return lo + _rnd() * (hi - lo)


def _jsround(x: float) -> int:
    """JS Math.round (half-up) — Python's round() is banker's rounding."""
    return math.floor(x + 0.5)


# ── reference vocab (verbatim from the frontend) ─────────────────────
PLANTS_SEED = [
    {"id": "IN-LAL-01", "name": "Lalru", "region": "India", "country": "India", "service_level": 91},
    {"id": "IN-PUN-02", "name": "Pune", "region": "India", "country": "India", "service_level": 88},
    {"id": "IN-SON-03", "name": "Sonipat", "region": "India", "country": "India", "service_level": 93},
    {"id": "NZ-AUK-01", "name": "Auckland", "region": "ANZ", "country": "New Zealand", "service_level": 96},
    {"id": "AU-MEL-02", "name": "Melbourne", "region": "ANZ", "country": "Australia", "service_level": 93},
    {"id": "AU-SYD-01", "name": "Sydney", "region": "ANZ", "country": "Australia", "service_level": 92},
    {"id": "ID-SBY-02", "name": "Surabaya", "region": "ANZ", "country": "Indonesia", "service_level": 89},
    {"id": "ID-JAK-01", "name": "Jakarta", "region": "ANZ", "country": "Indonesia", "service_level": 90},
    {"id": "US-NYC-03", "name": "New York", "region": "NORAM", "country": "USA", "service_level": 97},
    {"id": "MX-MEX-01", "name": "Mexico City", "region": "LATAM", "country": "Mexico", "service_level": 88},
    {"id": "DE-BER-02", "name": "Berlin", "region": "Europe", "country": "Germany", "service_level": 95},
    {"id": "ZA-JNB-01", "name": "Johannesburg", "region": "South Africa", "country": "South Africa", "service_level": 90},
    {"id": "ZA-CPT-02", "name": "Cape Town", "region": "South Africa", "country": "South Africa", "service_level": 91},
]

CATEGORIES = ["Bearings", "Electrical", "Motors", "Filtration", "Valves", "Gaskets", "Hydraulics",
              "Pneumatics", "Mechanical Seals", "Safety", "Instrumentation", "Belts & Drives", "Pumps"]
SUPPLIERS = ["Grundfos", "Timken", "NSK", "Emerson", "Spirent", "Parker Hannifin", "Siemens", "SKF",
             "Bosch Rexroth", "Honeywell", "ABB", "Pall", "Gates", "Danfoss", "Rexnord"]
XYZS = ["X", "Y", "Z"]
FSNS = ["Fast", "Slow", "Non-moving"]
VEDS = ["Vital", "Essential", "Desirable"]
RISKS = ["low", "medium", "high"]
WF_STATUSES = ["pending", "eng_approved", "maint_approved", "finance_approved", "implemented", "rejected"]


def _code() -> str:
    return str(_rint(100000000, 109999999))


def _rec_type_for(m: dict) -> str:
    if m["fsn"] == "Non-moving" and m["coverage_days"] > 200:
        return "dispose"
    if m["coverage_days"] < 20 and m["ved"] == "Vital":
        return "emergency_action" if _rnd() > 0.5 else "increase_stock"
    if m["coverage_days"] > 120:
        return "reduce_stock"
    if _rnd() > 0.7:
        return "keep_unchanged"
    return "reduce_stock" if _rnd() > 0.5 else "increase_stock"


def _reasoning(type_: str, m: dict) -> str:
    if type_ == "reduce_stock":
        return (f"Demand forecasting shows {_rint(12, 34)}% decline YoY. "
                f"Current safety stock exceeds {_rfloat(2, 4):.1f}× calculated requirement.")
    if type_ == "dispose":
        return (f"No consumption in {_rint(14, 36)} months. {m['fsn']} mover with "
                f"obsolescence risk — recommend write-off.")
    if type_ == "increase_stock":
        return (f"Stockout risk: coverage {m['coverage_days']}d below target for a {m['ved']} item. "
                f"Demand trending up {_rint(8, 25)}%.")
    if type_ == "keep_unchanged":
        return "Stock levels within optimal band. No action required this cycle."
    return (f"Critical {m['ved']} spare below reorder point at a plant with service level risk. "
            f"Immediate replenishment required.")


def generate() -> dict:
    """Return {'plants', 'materials', 'recommendations'} — deterministic."""
    global _seed
    _seed = 20260828  # reset so repeated calls are identical

    plants = [dict(p, material_count=0, inventory_value=0.0) for p in PLANTS_SEED]

    materials: list[dict] = []
    for plant in plants:
        n = _rint(90, 120)
        for _ in range(n):
            category = _pick(CATEGORIES)
            supplier = _pick(SUPPLIERS)
            unit_cost = _rfloat(20, 2400)
            on_hand_qty = _rint(1, 400)
            current_stock_value = _jsround(unit_cost * on_hand_qty)
            mid = _code()
            desc = f"{category} – {supplier} {chr(65 + _rint(0, 25))}{_rint(100, 999)}"
            materials.append({
                "id": mid,
                "description": desc,
                "category": category,
                "supplier": supplier,
                "plant_id": plant["id"],
                "region": plant["region"],
                "country": plant["country"],
                "xyz": _pick(XYZS),
                "fsn": _pick(FSNS),
                "ved": _pick(VEDS),
                "criticality_score": _rint(20, 95),
                "coverage_days": _rint(5, 400),
                "on_hand_qty": on_hand_qty,
                "unit_cost": _jsround(unit_cost * 100) / 100,
                "current_stock_value": current_stock_value,
                "avg_monthly_demand": _jsround(_rfloat(0.4, 40) * 10) / 10,
            })

    # backfill plant rollups
    by_plant: dict[str, list[dict]] = {}
    for m in materials:
        by_plant.setdefault(m["plant_id"], []).append(m)
    for p in plants:
        mats = by_plant.get(p["id"], [])
        p["material_count"] = len(mats)
        p["inventory_value"] = sum(x["current_stock_value"] for x in mats)

    # recommendations — filter (one rnd per material) THEN map over survivors
    survivors = [m for m in materials if _rnd() > 0.25]
    recommendations: list[dict] = []
    for m in survivors:
        type_ = _rec_type_for(m)
        csv = m["current_stock_value"]
        if type_ == "reduce_stock":
            recommended = _jsround(csv * _rfloat(0.4, 0.85))
        elif type_ == "dispose":
            recommended = 0
        elif type_ in ("increase_stock", "emergency_action"):
            recommended = _jsround(csv * _rfloat(1.15, 1.6))
        else:
            recommended = csv
        savings = max(0, csv - recommended)
        confidence = _rint(65, 96)
        cash_release = _jsround(savings * _rfloat(0.6, 0.85))
        risk = _pick(RISKS)
        reasoning = _reasoning(type_, m)
        wf = "pending" if type_ == "keep_unchanged" else _pick(WF_STATUSES)
        recommendations.append({
            "id": f"rec-{m['id']}",
            "material_id": m["id"],
            "material_desc": m["description"],
            "category": m["category"],
            "plant_id": m["plant_id"],
            "region": m["region"],
            "country": m["country"],
            "type": type_,
            "confidence": confidence,
            "current_stock_value": csv,
            "recommended_value": recommended,
            "savings_potential": savings,
            "cash_release": cash_release,
            "risk": risk,
            "ai_reasoning": reasoning,
            "coverage_days": m["coverage_days"],
            "fsn": m["fsn"],
            "ved": m["ved"],
            "criticality_score": m["criticality_score"],
            "workflow_status": wf,
        })

    return {"plants": plants, "materials": materials, "recommendations": recommendations}
