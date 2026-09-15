"""Ingestion pipeline: CSV → bronze (raw) → silver (validated/conformed) →
gold (the tables every endpoint reads).

Mirrors the Admin UI's auto-mapping. Accepts the customer's 10 core columns and
derives the fields the ML layer needs (unit_cost, on-hand qty, monthly demand,
lead time) when they aren't supplied, then generates a demand history per
material and a derived recommendation set so KPIs/opportunities light up.
"""
from __future__ import annotations

import csv
import io
import re
from datetime import datetime, timezone
from types import SimpleNamespace

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..data.demand import MONTHS, make_receipts, make_series, month_label
from ..db.models import (
    DemandSeries,
    IngestionSource,
    Material,
    Plant,
    Recommendation,
)
from ..ml.optimize import optimal_target

# canonical field → header synonyms (normalized)
FIELD_SYNONYMS: dict[str, list[str]] = {
    "materialid": ["materialid", "material", "materialnumber", "materialno", "sku", "partno",
                   "partnumber", "itemid", "item", "code", "matnr"],
    "description": ["description", "desc", "materialdescription", "name", "text", "itemdescription"],
    "plant": ["plant", "plantid", "site", "location", "facility", "warehouse", "plantcode"],
    "category": ["category", "categ", "group", "materialgroup", "type", "class", "commodity"],
    "supplier": ["supplier", "vendor", "manufacturer", "mfr", "source"],
    "stockvalue": ["stockvalue", "value", "inventoryvalue", "stockvalueusd", "totalvalue",
                   "valuation", "amount", "invvalue"],
    "coverage": ["coverage", "coveragedays", "doh", "daysonhand", "dayscover", "dio", "days"],
    "ved": ["ved", "vedclass", "criticality", "vitality"],
    "fsn": ["fsn", "fsnclass", "movement", "movementclass"],
    "xyz": ["xyz", "xyzclass", "variability", "demandvariability"],
    # optional, used when present
    "unit_cost": ["unitcost", "price", "unitprice", "standardcost", "costperunit"],
    "on_hand_qty": ["onhand", "onhandqty", "quantity", "qty", "stockqty", "stockonhand", "soh"],
    "avg_monthly_demand": ["avgmonthlydemand", "monthlydemand", "demand", "avgdemand", "usage",
                           "avgusage", "consumption"],
    "region": ["region", "area", "zone"],
    "country": ["country", "nation"],
    "lead_time_days": ["leadtime", "leadtimedays", "lt", "replenishmentlead"],
}
REQUIRED = ["materialid", "plant", "stockvalue"]
CORE = ["materialid", "description", "plant", "category", "supplier", "stockvalue",
        "coverage", "ved", "fsn", "xyz"]

_CATEGORY_COST = {"Bearings": 320, "Electrical": 180, "Motors": 900, "Filtration": 90,
                  "Valves": 260, "Gaskets": 45, "Hydraulics": 420, "Pneumatics": 210,
                  "Mechanical Seals": 380, "Safety": 120, "Instrumentation": 540,
                  "Belts & Drives": 70, "Pumps": 780}
_VED_CRIT = {"Vital": 85, "Essential": 60, "Desirable": 35}
_VED = {"vital": "Vital", "essential": "Essential", "desirable": "Desirable", "v": "Vital",
        "e": "Essential", "d": "Desirable"}
_FSN = {"fast": "Fast", "slow": "Slow", "non-moving": "Non-moving", "nonmoving": "Non-moving",
        "f": "Fast", "s": "Slow", "n": "Non-moving"}
_XYZ = {"x": "X", "y": "Y", "z": "Z"}


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


# demand-history columns: M1..Mn / month1.. , or dated YYYY-MM / MM-YYYY
_HIST_MN = re.compile(r"^m(?:onth)?[_\- ]?(\d{1,3})$", re.I)
_HIST_YM = re.compile(r"^(\d{4})[-_/](\d{1,2})$")
_HIST_MY = re.compile(r"^(\d{1,2})[-_/](\d{4})$")


# ── Wide MRO format: opening + monthly receipts + monthly consumption + closing + lead ──
_MONTHS_ABBR = {m: i for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], 1)}
_DUMMY_CATS = ["Bearings", "Valves", "Pumps", "Motors", "Electrical", "Filtration",
               "Gaskets", "Instrumentation", "Hydraulics", "Mechanical Seals"]
_DUMMY_SUPS = ["SKF", "Siemens", "ABB", "Emerson", "Parker Hannifin", "NSK", "Gates",
               "Honeywell", "Bosch", "Flowserve"]
_DUMMY_PLANTS = [("MRO-PLANT-01", "Plant 01", "Region A"), ("MRO-PLANT-02", "Plant 02", "Region A"),
                 ("MRO-PLANT-03", "Plant 03", "Region B")]
_DUMMY_VED = ["Vital", "Essential", "Essential", "Essential", "Desirable", "Desirable"]


def _month_key(header: str) -> int:
    m = re.search(r"([A-Za-z]{3})[a-z]*[-\s/]*(\d{4})", header or "")
    if m and m.group(1).lower() in _MONTHS_ABBR:
        return int(m.group(2)) * 12 + _MONTHS_ABBR[m.group(1).lower()]
    return 0


def _pick(mid: str, salt: str, lst: list):
    return lst[int(_fnv(mid + salt) * len(lst)) % len(lst)]


def detect_wide_mro(headers: list[str]) -> dict | None:
    """Recognize the wide MRO extract: 'Opening stock quantity (...)',
    'Receipt quantity(Mon-YYYY)' ×N, 'Consumption quantity (Mon-YYYY)' ×N,
    'Closing Stock quantity (...)', 'Closing Value (...)', 'Lead time (Months)'."""
    opening = closing_stock = closing_value = lead = None
    rec_cols, con_cols = [], []
    for h in headers:
        hl = _norm(h)
        if hl.startswith("openingstock"):
            opening = h
        elif hl.startswith("receiptquantity") or hl.startswith("receiptqty"):
            rec_cols.append(h)
        elif hl.startswith("consumptionquantity") or hl.startswith("consumptionqty"):
            con_cols.append(h)
        elif hl.startswith("closingstock"):
            closing_stock = h
        elif hl.startswith("closingvalue"):
            closing_value = h
        elif hl.startswith("leadtime"):
            lead = h
    if not (rec_cols and con_cols and closing_stock):
        return None
    rec_cols.sort(key=_month_key)
    con_cols.sort(key=_month_key)
    return {"opening": opening, "receipts": rec_cols, "consumption": con_cols,
            "closing_stock": closing_stock, "closing_value": closing_value, "lead": lead}


def transform_wide(rows: list[dict], mapping: dict, wide: dict) -> dict:
    """Silver transform for the wide MRO extract. Consumption columns are stored
    negative → converted to positive. Columns the file lacks (plant, category,
    supplier, VED) are filled with deterministic dummy values."""
    issues = [f"info: wide MRO extract — {len(wide['consumption'])} months of receipts & consumption; "
              "plant/category/supplier/VED are dummy-filled (not in source)."]
    materials: list[dict] = []
    plants: dict[str, dict] = {}
    raw_series: dict[str, list[float]] = {}
    raw_receipts: dict[str, list[float]] = {}

    for i, row in enumerate(rows):
        mid = str(_get(row, mapping, "materialid", "")).strip() or f"MRO{100000 + i}"
        desc = str(_get(row, mapping, "description", "")).strip() or mid
        opening = _f(row.get(wide["opening"], 0)) if wide["opening"] else 0.0
        consumption = [abs(_f(row.get(c, 0))) for c in wide["consumption"]]   # negatives → positive
        receipts = [max(0.0, _f(row.get(c, 0))) for c in wide["receipts"]]
        closing_stock = _f(row.get(wide["closing_stock"], 0)) if wide["closing_stock"] else 0.0
        closing_value = _f(row.get(wide["closing_value"], 0)) if wide["closing_value"] else 0.0
        lead_months = _f(row.get(wide["lead"], 0)) if wide["lead"] else 1.0
        lead_days = round(max(lead_months, 0.1) * 30.0) if lead_months else 30

        cat = _pick(mid, "cat", _DUMMY_CATS)
        sup = _pick(mid, "sup", _DUMMY_SUPS)
        ved = _pick(mid, "ved", _DUMMY_VED)
        pl_id, pl_name, pl_region = _pick(mid, "plant", _DUMMY_PLANTS)
        fsn = _fsn_from_series(consumption)
        xyz = _xyz_from_series(consumption)
        amd = round(sum(consumption) / max(1, len(consumption)), 2)
        unit_cost = (closing_value / closing_stock) if (closing_stock > 0 and closing_value > 0) \
            else _CATEGORY_COST.get(cat, 200)
        coverage = int(closing_stock / max(amd, 0.1) * 30) if amd > 0 else 999

        raw_series[mid] = consumption
        raw_receipts[mid] = receipts
        plants.setdefault(pl_id, {"id": pl_id, "name": pl_name, "region": pl_region,
                                  "country": pl_region, "material_count": 0,
                                  "inventory_value": 0.0, "service_level": 90.0})
        materials.append({
            "id": mid, "description": desc, "category": cat, "supplier": sup,
            "plant_id": pl_id, "region": pl_region, "country": pl_region,
            "xyz": xyz, "fsn": fsn, "ved": ved,
            "criticality_score": int(_VED_CRIT[ved] + (_fnv(mid) - 0.5) * 20),
            "coverage_days": coverage, "on_hand_qty": int(round(closing_stock)),
            "unit_cost": round(unit_cost, 2), "current_stock_value": round(closing_value, 0),
            "avg_monthly_demand": amd, "opening_stock": round(opening, 2),
            "lead_time_days": lead_days,
        })

    for p in plants.values():
        mats = [m for m in materials if m["plant_id"] == p["id"]]
        p["material_count"] = len(mats)
        p["inventory_value"] = sum(m["current_stock_value"] for m in mats)

    series = []
    for m in materials:
        ser = raw_series.get(m["id"], [])
        n = len(ser) or 1
        series.append({"material_id": m["id"], "plant_id": m["plant_id"], "months": n,
                       "start_label": month_label(0, n), "end_label": month_label(n - 1, n),
                       "series": ser, "receipts": raw_receipts.get(m["id"])})
    series_map = {s["material_id"]: s["series"] for s in series}
    recommendations = derive_recommendations(materials, series_map)
    return {"plants": list(plants.values()), "materials": materials, "series": series,
            "recommendations": recommendations, "issues": issues}


def detect_history(headers: list[str], mapping: dict) -> list[str]:
    """Return the demand-history columns in chronological order (oldest→newest).

    Recognizes M1..Mn / month_1.. and dated columns (YYYY-MM or MM-YYYY). Any
    header already claimed by a core/optional field is excluded.
    """
    claimed = {v for v in mapping.values() if v}
    mn: list[tuple[int, str]] = []
    ym: list[tuple[int, str]] = []
    for h in headers:
        if h in claimed:
            continue
        hs = (h or "").strip()
        m = _HIST_MN.match(hs)
        if m:
            mn.append((int(m.group(1)), h))
            continue
        m = _HIST_YM.match(hs)
        if m:
            ym.append((int(m.group(1)) * 12 + int(m.group(2)), h))
            continue
        m = _HIST_MY.match(hs)
        if m:
            ym.append((int(m.group(2)) * 12 + int(m.group(1)), h))
            continue
    if len(mn) >= 6:
        return [h for _, h in sorted(mn)]
    if len(ym) >= 6:
        return [h for _, h in sorted(ym)]
    return []


def _fnv(s: str) -> float:
    h = 2166136261
    for ch in s:
        h = ((h ^ ord(ch)) * 16777619) & 0xFFFFFFFF
    return h / 4294967296


def parse_csv(text: str) -> tuple[list[str], list[dict]]:
    text = text.lstrip("﻿")
    try:
        dialect = csv.Sniffer().sniff(text[:2048], delimiters=",;\t|")
    except csv.Error:
        dialect = csv.excel
    reader = csv.reader(io.StringIO(text), dialect)
    rows = [r for r in reader if any(c.strip() for c in r)]
    if not rows:
        return [], []
    headers = [h.strip() for h in rows[0]]
    data = [dict(zip(headers, r)) for r in rows[1:]]
    return headers, data


def auto_map(headers: list[str]) -> dict[str, str | None]:
    normed = {h: _norm(h) for h in headers}
    mapping: dict[str, str | None] = {}
    used: set[str] = set()
    for field, syns in FIELD_SYNONYMS.items():
        syn_set = {_norm(s) for s in syns}
        match = None
        for h, nh in normed.items():
            if h in used:
                continue
            if nh in syn_set or any(nh == s or (len(s) > 3 and s in nh) for s in syn_set):
                match = h
                break
        if match:
            mapping[field] = match
            used.add(match)
        else:
            mapping[field] = None
    return mapping


def _f(v, default=0.0) -> float:
    try:
        return float(re.sub(r"[^0-9.\-]", "", str(v)))
    except (ValueError, TypeError):
        return default


def _get(row: dict, mapping: dict, field: str, default=""):
    h = mapping.get(field)
    return row.get(h, default) if h else default


def validate_transform(rows: list[dict], mapping: dict) -> dict:
    """Silver: coerce, default, derive → plants + materials + series + recs (+ issues).

    When the file carries a demand history (M1..Mn or dated columns) we use the
    REAL series — every downstream computation (FSN/XYZ classification, safety
    stock, reorder point, EOQ, forecast) then runs on the customer's history.
    Only when no history is present do we synthesize one.
    """
    headers = list(rows[0].keys()) if rows else []
    wide = detect_wide_mro(headers)
    if wide:
        return transform_wide(rows, mapping, wide)

    issues: list[str] = []
    materials: list[dict] = []
    plants: dict[str, dict] = {}
    raw_series: dict[str, list[float] | None] = {}

    hist_cols = detect_history(headers, mapping)

    for i, row in enumerate(rows):
        mid = str(_get(row, mapping, "materialid", "")).strip() or f"M{100000 + i}"
        plant_raw = str(_get(row, mapping, "plant", "")).strip() or "UNSPECIFIED"
        stock = _f(_get(row, mapping, "stockvalue", 0))
        if stock <= 0:
            issues.append(f"row {i + 2}: missing/zero stock value")
        category = str(_get(row, mapping, "category", "") or "General").strip()
        supplier = str(_get(row, mapping, "supplier", "") or "Unknown").strip()
        ved = _VED.get(_norm(_get(row, mapping, "ved", "")), "Essential")
        xyz_raw = _XYZ.get(_norm(_get(row, mapping, "xyz", "")))
        coverage = int(_f(_get(row, mapping, "coverage", 60)) or 60)

        # real demand history if present
        ser = [max(0.0, _f(row.get(h, 0))) for h in hist_cols] if hist_cols else None
        raw_series[mid] = ser

        amd_explicit = _f(_get(row, mapping, "avg_monthly_demand", 0))
        if amd_explicit:
            amd = amd_explicit
        elif ser is not None:
            amd = round(sum(ser) / len(ser), 2) if ser else 0.1
        else:
            unit_cost0 = _f(_get(row, mapping, "unit_cost", 0)) or _CATEGORY_COST.get(category, 200)
            on_hand0 = _f(_get(row, mapping, "on_hand_qty", 0)) or max(1.0, round(stock / unit_cost0))
            amd = round(max(0.1, on_hand0 * 30 / max(coverage, 1)), 1)

        # FSN from provided value, else derived from the real history's activity rate
        fsn = _FSN.get(_norm(_get(row, mapping, "fsn", "")))
        if not fsn:
            fsn = _fsn_from_series(ser) if ser is not None else "Slow"
        # XYZ from provided value, else derived from history variability
        xyz = xyz_raw or (_xyz_from_series(ser) if ser is not None else "Y")

        unit_cost = _f(_get(row, mapping, "unit_cost", 0)) or _CATEGORY_COST.get(category, 200)
        on_hand = _f(_get(row, mapping, "on_hand_qty", 0)) or max(1.0, round(stock / unit_cost))
        region = str(_get(row, mapping, "region", "") or "Global").strip()
        country = str(_get(row, mapping, "country", "") or region).strip()

        plants.setdefault(plant_raw, {"id": plant_raw, "name": plant_raw, "region": region,
                                      "country": country, "material_count": 0,
                                      "inventory_value": 0.0, "service_level": 90.0})
        materials.append({
            "id": mid, "description": str(_get(row, mapping, "description", "") or f"{category} {mid}"),
            "category": category, "supplier": supplier, "plant_id": plant_raw, "region": region,
            "country": country, "xyz": xyz, "fsn": fsn, "ved": ved,
            "criticality_score": int(_VED_CRIT[ved] + (_fnv(mid) - 0.5) * 20),
            "coverage_days": coverage, "on_hand_qty": int(on_hand),
            "unit_cost": round(unit_cost, 2), "current_stock_value": round(stock, 0),
            "avg_monthly_demand": amd,
        })

    for p in plants.values():
        mats = [m for m in materials if m["plant_id"] == p["id"]]
        p["material_count"] = len(mats)
        p["inventory_value"] = sum(m["current_stock_value"] for m in mats)

    series = []
    for m in materials:
        ser = raw_series.get(m["id"])
        if ser is None:
            ser = make_series(material_id=m["id"], fsn=m["fsn"], xyz=m["xyz"],
                              avg_monthly_demand=m["avg_monthly_demand"])
        rec, opening = make_receipts(material_id=m["id"], consumption=ser,
                                     closing_stock=m["on_hand_qty"])
        m["opening_stock"] = opening  # SME item 6 input
        n = len(ser)
        series.append({"material_id": m["id"], "plant_id": m["plant_id"], "months": n,
                       "start_label": month_label(0, n), "end_label": month_label(n - 1, n),
                       "series": ser, "receipts": rec})
    series_map = {s["material_id"]: s["series"] for s in series}
    recommendations = derive_recommendations(materials, series_map)

    if hist_cols:
        issues.insert(0, f"info: using real demand history - {len(hist_cols)} periods "
                         f"({hist_cols[0]}..{hist_cols[-1]}) per material.")

    return {"plants": list(plants.values()), "materials": materials, "series": series,
            "recommendations": recommendations, "issues": issues}


def _fsn_from_series(ser: list[float]) -> str:
    """Fast/Slow/Non-moving from the demand activity rate (fraction of active periods)."""
    if not ser:
        return "Non-moving"
    active = sum(1 for v in ser if v > 0) / len(ser)
    return "Fast" if active >= 0.6 else "Slow" if active >= 0.2 else "Non-moving"


def _xyz_from_series(ser: list[float]) -> str:
    """X/Y/Z from demand variability (CV of nonzero sizes)."""
    nz = [v for v in ser if v > 0]
    if len(nz) < 2:
        return "Z"
    mean = sum(nz) / len(nz)
    if mean <= 0:
        return "Z"
    var = sum((v - mean) ** 2 for v in nz) / len(nz)
    cv = (var ** 0.5) / mean
    return "X" if cv < 0.3 else "Y" if cv < 0.6 else "Z"


def derive_recommendations(materials: list[dict], series_map: dict) -> list[dict]:
    """Lightweight rec set from optimal targets so /recommendations + KPIs work."""
    recs = []
    for m in materials:
        ns = SimpleNamespace(id=m["id"], category=m["category"], unit_cost=m["unit_cost"],
                             on_hand_qty=m["on_hand_qty"], current_stock_value=m["current_stock_value"],
                             ved=m["ved"], fsn=m["fsn"])
        o = optimal_target(ns, series_map.get(m["id"], []))
        cur = m["current_stock_value"]
        if o["pattern"] == "no_demand" and m["fsn"] == "Non-moving" and cur > 3000:
            rtype, rec_val = "dispose", 0.0
            reason = f"No consumption on record; {m['fsn']} item holding ${cur:,.0f} - write-off candidate."
        elif o["excess_value"] > 3000:
            rtype, rec_val = "reduce_stock", o["target_value"]
            reason = f"On-hand {m['on_hand_qty']} vs optimal {o['target_units']:.0f} ({o['pattern']} demand) - reduce."
        elif o["understocked"] and m["ved"] in ("Vital", "Essential"):
            rtype, rec_val = "increase_stock", o["target_value"]
            reason = f"Below reorder point for a {m['ved']} item - replenish to {o['target_units']:.0f}."
        else:
            continue
        savings = max(0.0, cur - rec_val)
        recs.append({
            "id": f"rec-{m['id']}", "material_id": m["id"], "material_desc": m["description"],
            "category": m["category"], "plant_id": m["plant_id"], "region": m["region"],
            "country": m["country"], "type": rtype, "confidence": int(70 + _fnv(m["id"]) * 25),
            "current_stock_value": cur, "recommended_value": round(rec_val, 0),
            "savings_potential": round(savings, 0), "cash_release": round(savings * 0.7, 0),
            "risk": {"Vital": "high", "Essential": "medium"}.get(m["ved"], "low"),
            "ai_reasoning": reason, "coverage_days": m["coverage_days"], "fsn": m["fsn"],
            "ved": m["ved"], "criticality_score": m["criticality_score"], "workflow_status": "pending",
        })
    return recs


async def activate(session: AsyncSession, gold: dict, *, filename: str, mapping: dict,
                   row_count: int) -> IngestionSource:
    """Gold promotion — replace the analytical tables with the ingested data.

    Workflow requests / snapshots (transactional state) are left untouched.
    """
    for model in (Recommendation, DemandSeries, Material, Plant):
        await session.execute(delete(model))

    session.add_all([Plant(**p) for p in gold["plants"]])
    session.add_all([Material(**m) for m in gold["materials"]])
    session.add_all([DemandSeries(**s) for s in gold["series"]])
    session.add_all([Recommendation(**r) for r in gold["recommendations"]])

    await session.execute(
        IngestionSource.__table__.update().values(status="ingested")
    )
    count = await session.scalar(select(func.count()).select_from(IngestionSource))
    src = IngestionSource(
        id=f"SRC-{1000 + int(count or 0) + 1}", filename=filename, status="active",
        row_count=row_count, material_count=len(gold["materials"]),
        plant_count=len(gold["plants"]), issue_count=len(gold["issues"]),
        created_at=datetime.now(timezone.utc).isoformat(), mapping=mapping,
    )
    session.add(src)
    await session.commit()
    return src
