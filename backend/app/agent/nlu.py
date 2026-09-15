"""Rule-based intent router — the deterministic fallback (and offline path) for
Sage. Maps a natural-language question to one tool call + args. Mirrors the
frontend sageEngine intents, now over the real backend tools.
"""
from __future__ import annotations

import re

from ..data.generate import PLANTS_SEED

# name / id / region → plant ids
_PLANT_BY_NAME = {p["name"].lower(): p["id"] for p in PLANTS_SEED}
_PLANT_IDS = {p["id"].lower(): p["id"] for p in PLANTS_SEED}
_REGION_IDS: dict[str, list[str]] = {}
for _p in PLANTS_SEED:
    _REGION_IDS.setdefault(_p["region"].lower(), []).append(_p["id"])

_OPP_TYPES = {
    "excess": "excess_inventory", "overstock": "excess_inventory",
    "obsolete": "obsolete_stock", "write-off": "obsolete_stock", "writeoff": "obsolete_stock",
    "transfer": "stock_transfer", "rebalanc": "stock_transfer",
    "duplicate": "duplicate_materials", "duplication": "duplicate_materials",
    "supplier": "supplier_consolidation", "consolidat": "supplier_consolidation",
    "safety": "safety_stock_overstock",
}


def resolve_plant_ids(values) -> list[str] | None:
    """Map a mix of plant ids / names / regions to canonical plant ids."""
    if not values:
        return None
    out: list[str] = []
    for v in values:
        vl = str(v).strip().lower()
        if vl in _PLANT_IDS:
            out.append(_PLANT_IDS[vl])
        elif vl in _PLANT_BY_NAME:
            out.append(_PLANT_BY_NAME[vl])
        elif vl in _REGION_IDS:
            out.extend(_REGION_IDS[vl])
        else:
            partial = [pid for name, pid in _PLANT_BY_NAME.items() if vl and vl in name]
            out.extend(partial or [str(v)])
    return sorted(set(out)) or None


def plant_roster() -> str:
    return ", ".join(f"{p['id']} ({p['name']}, {p['region']})" for p in PLANTS_SEED)


def extract_plants(text: str) -> list[str] | None:
    t = text.lower()
    found: list[str] = []
    for name, pid in _PLANT_BY_NAME.items():
        if re.search(rf"\b{re.escape(name)}\b", t):
            found.append(pid)
    for pid_l, pid in _PLANT_IDS.items():
        if pid_l in t:
            found.append(pid)
    for region, ids in _REGION_IDS.items():
        if re.search(rf"\b{re.escape(region)}\b", t):
            found.extend(ids)
    return sorted(set(found)) or None


def _material_id(text: str) -> str | None:
    m = re.search(r"\b(1\d{8})\b", text)
    return m.group(1) if m else None


def _service_level(text: str) -> float | None:
    m = re.search(r"(\d{2}(?:\.\d)?)\s*%?\s*(?:service|fill|sl)\b", text.lower())
    if not m:
        m = re.search(r"(?:service|fill)\D{0,8}(\d{2}(?:\.\d)?)\s*%", text.lower())
    if m:
        v = float(m.group(1))
        return v / 100 if v > 1 else v
    return None


def _demand_mult(text: str) -> float:
    t = text.lower()
    m = re.search(r"(?:demand|surge|spike|increase|grow).{0,20}?(\d{1,3})\s*%", t)
    if m:
        return 1 + int(m.group(1)) / 100
    m = re.search(r"(\d{1,3})\s*%.{0,20}?(?:surge|increase|demand|spike)", t)
    if m:
        return 1 + int(m.group(1)) / 100
    if "surge" in t or "spike" in t:
        return 1.3
    return 1.0


def _lead_mult(text: str) -> float:
    t = text.lower()
    m = re.search(r"lead.{0,12}?(\d(?:\.\d)?)\s*x", t) or re.search(r"(\d(?:\.\d)?)\s*x.{0,12}?lead", t)
    if m:
        return float(m.group(1))
    if "delay" in t or "disrupt" in t or "slip" in t:
        return 2.0
    return 1.0


def route(text: str) -> dict:
    """Return {tool, args, note}."""
    t = text.lower()
    plants = extract_plants(text)
    mid = _material_id(text)

    # 1) create / submit an action (side-effectful)
    if re.search(r"\b(create|submit|raise|make|open)\b.*\b(action|request|reduction|disposal|order)\b", t) and mid:
        return {"tool": "create_action", "args": {"material_id": mid}}

    # 2) simulation / what-if
    if any(w in t for w in ("simulate", "what if", "what-if", "scenario", "surge", "supplier delay",
                            "stress", "disrupt")):
        return {"tool": "run_simulation", "args": {
            "plant_ids": plants, "demand_multiplier": _demand_mult(text),
            "lead_multiplier": _lead_mult(text),
            "target_service_level": _service_level(text) or 0.95}}

    # 3) tradeoff curve
    if "tradeoff" in t or "trade-off" in t or ("service" in t and "investment" in t) or "curve" in t:
        return {"tool": "tradeoff", "args": {"plant_ids": plants}}

    # 4) forecast
    if any(w in t for w in ("forecast", "predict", "demand outlook", "projection")) or \
            (mid and "demand" in t):
        if mid:
            return {"tool": "forecast_material", "args": {"material_id": mid}}
        return {"tool": "demand_outlook", "args": {"plant_ids": plants}}

    # 5) savings wizard matrix — the high-level "where is my money / what first" view
    if any(w in t for w in ("savings wizard", "matrix", "trapped", "working capital",
                            "where is my money", "where's my money", "biggest opportunit",
                            "where should i start", "prioriti", "what first", "what should i tackle")):
        return {"tool": "savings_matrix", "args": {"plant_ids": plants}}

    # 5b) opportunities (typed)
    if any(w in t for w in ("opportunit", "saving", "optimi", "excess", "obsolete", "transfer",
                            "duplicate", "supplier", "consolidat", "reduce stock", "overstock",
                            "write-off", "writeoff", "rebalanc")):
        opp_type = next((v for k, v in _OPP_TYPES.items() if k in t), None)
        # a bare "where are my savings?" with no specific type → the matrix overview
        if opp_type is None and any(w in t for w in ("saving", "optimi", "opportunit")):
            return {"tool": "savings_matrix", "args": {"plant_ids": plants}}
        return {"tool": "find_opportunities", "args": {"plant_ids": plants, "type": opp_type}}

    # 6) classification
    if any(w in t for w in ("classif", "abc", "xyz", "fsn", "ved", "criticality", "scorecard",
                            "pareto", "turns", "dio")):
        return {"tool": "classify", "args": {"plant_ids": plants}}

    # 7) KPIs / overview
    if any(w in t for w in ("kpi", "overview", "summary", "health", "how are we", "how is",
                            "dashboard", "inventory value", "service level", "status")):
        return {"tool": "get_kpis", "args": {"plant_ids": plants}}

    # 8) material lookup
    if mid:
        return {"tool": "forecast_material", "args": {"material_id": mid}}
    if any(w in t for w in ("show", "find", "material", "part", "item", "search", "list")):
        q = re.sub(r"\b(show|me|find|search|list|materials?|parts?|items?|in|at|for|the)\b", "", t).strip()
        return {"tool": "search_materials", "args": {"query": q or None, "plant_ids": plants}}

    # default
    return {"tool": "get_kpis", "args": {"plant_ids": plants},
            "note": "Showing the overview — try asking about opportunities, a forecast, or a what-if."}
