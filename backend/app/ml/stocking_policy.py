"""Inventory stocking-policy engine — the accelerator's standard method for
sizing MRO spares from stock and consumption history.

Per material it derives: unit rate, a stock-ledger validation (opening + receipts
− consumption vs closing), FSN movement class, demand variability (CV) band and
the service level it implies, ABC value class, and the full replenishment policy
— safety stock, reorder level, reorder quantity, maximum and average stock — plus
the value of each. Inactive materials (no opening, receipts, consumption or
closing) return the 'In Active' sentinel. ABC is a portfolio decision, so run the
whole set at once via `compute_policy`.

Inputs per material:
  id, description, opening_stock, closing_stock, closing_value, unit_cost,
  consumption[]  (monthly, positive qty),  receipts[] | None (monthly qty)
"""
from __future__ import annotations

import math
from statistics import mean, pstdev

AVG_DAYS_PER_MONTH = 30.0
LEAD_TIME_DAYS = 30
INACTIVE = "In Active"           # sentinel for inactive-material fields
NO_RATE = "Unit rate not available"

Z_NORMAL = 1.645   # 95%
Z_HIGH = 2.326     # 99%
ROQ_MONTHS = {"A": 1, "B": 2, "C": 3}


def _std(xs: list[float]) -> float:
    return float(pstdev(xs)) if len(xs) > 1 else 0.0


def _one(m: dict) -> dict:
    """Per-material policy, EXCEPT the portfolio-dependent parts (ABC, ROQ, max,
    avg and their values), which `compute_policy` finalizes once ABC is known."""
    cons = [max(0.0, float(x)) for x in (m.get("consumption") or [])]
    months = len(cons) or 1
    lead_days = float(m.get("lead_days") or LEAD_TIME_DAYS)  # from source when provided, else 30
    receipts = m.get("receipts")
    total_rec = sum(float(x) for x in receipts) if receipts is not None else None
    total_cons = sum(cons)
    closing_stock = float(m.get("closing_stock") or 0.0)
    closing_value = float(m.get("closing_value") or 0.0)

    # opening stock: use given, else derive so the ledger balances
    opening = m.get("opening_stock")
    if opening is None:
        opening = closing_stock + total_cons - (total_rec or 0.0)
    opening = float(opening)

    # Active / Inactive gate
    inactive = opening == 0 and (total_rec or 0.0) == 0 and total_cons == 0 and closing_stock == 0
    r: dict = {"id": m["id"], "active": not inactive}
    if inactive:
        for k in ("unit_rate", "data_status", "data_error_qty", "data_error_value",
                  "fsn", "cv", "cv_band", "service_level", "z_score", "lead_time_days",
                  "annual_consumption_value", "abc", "safety_stock", "rol", "roq",
                  "max_stock", "avg_stock", "ss_value", "rol_value", "roq_value",
                  "max_value", "avg_value", "avg_monthly_consumption", "consumption_months"):
            r[k] = INACTIVE
        r["status_tag"] = "Inactive"
        return r

    # Unit rate = closing value / closing stock
    unit_rate = (closing_value / closing_stock) if (closing_stock > 0 and closing_value > 0) else None
    r["unit_rate"] = round(unit_rate, 4) if unit_rate is not None else NO_RATE

    # Stock-ledger validation: opening + receipts − consumption should equal closing.
    # Tolerance of 1 unit absorbs sub-unit rounding (stock is stored whole) — only
    # genuine ledger discrepancies flag as incorrect.
    expected_closing = opening + (total_rec or 0.0) - total_cons
    error_qty = expected_closing - closing_stock
    data_ok = abs(error_qty) < 1.0
    r["data_status"] = "Data OK" if data_ok else "Data incorrect"
    r["data_error_qty"] = round(error_qty, 3)
    r["data_error_value"] = round(error_qty * unit_rate, 2) if unit_rate is not None else NO_RATE

    # FSN movement class from the number of months with consumption (annualized)
    consumption_months = sum(1 for c in cons if c > 0)
    annual_freq = consumption_months * (12.0 / months)
    fsn = "Non-moving" if consumption_months == 0 else "Fast" if annual_freq > 2 else "Slow"
    r["consumption_months"] = consumption_months
    r["fsn"] = fsn

    # Demand variability (coefficient of variation) over all months
    avg = mean(cons) if cons else 0.0
    std = _std(cons)
    cv = (std / avg) if avg > 0 else None
    if avg == 0:
        band = "No Consumption"
    elif cv <= 0.50:
        band = "Normal"
    elif cv <= 1.00:
        band = "Mild Variation"
    else:
        band = "High Variation"
    r["avg_monthly_consumption"] = round(avg, 4)
    r["cv"] = round(cv, 3) if cv is not None else 0.0
    r["cv_band"] = band

    # Service level: 99% only for high-variability fast movers, else 95%
    if band == "High Variation" and fsn == "Fast":
        service_level, z = 0.99, Z_HIGH
    else:
        service_level, z = 0.95, Z_NORMAL
    r["service_level"] = service_level
    r["z_score"] = z
    r["lead_time_days"] = round(lead_days)

    # Annualized consumption value (used for ABC ranking)
    cons_value = total_cons * (unit_rate or 0.0)
    r["annual_consumption_value"] = round(cons_value * (12.0 / months), 2)

    # Safety stock = ceil(Z × σ × √(lead / avg days per month))
    ss_factor = math.sqrt(lead_days / AVG_DAYS_PER_MONTH)
    raw_ss = z * std * ss_factor
    ss = math.ceil(raw_ss)
    ss_rounded_up = ss > raw_ss + 1e-9
    r["safety_stock"] = ss

    # Reorder level = safety stock + average consumption over the lead time
    avg_cons_lead = avg * (lead_days / AVG_DAYS_PER_MONTH)
    rol_raw = ss + avg_cons_lead
    r["rol"] = math.floor(rol_raw) if ss_rounded_up else math.ceil(rol_raw)

    r["_avg"] = avg
    r["_unit_rate_num"] = unit_rate
    r["_data_ok"] = data_ok
    return r


def compute_policy(materials: list[dict]) -> dict[str, dict]:
    """Full stocking-policy pass over the portfolio. Returns {material_id: fields}."""
    rows = {m["id"]: _one(m) for m in materials}

    # ABC — rank active, ledger-valid materials by annual consumption value
    ranked = sorted(
        [r for r in rows.values() if r["active"] and r.get("_data_ok") and r["annual_consumption_value"] > 0],
        key=lambda r: -r["annual_consumption_value"],
    )
    total = sum(r["annual_consumption_value"] for r in ranked) or 1.0
    cum = 0.0
    for r in ranked:
        cum += r["annual_consumption_value"]
        pct = cum / total * 100.0
        r["abc"] = "A" if pct <= 80.0 else "B" if pct <= 95.0 else "C"
    for r in rows.values():
        if r["active"] and not isinstance(r.get("abc"), str):
            r["abc"] = "C"

    # Reorder quantity by ABC class, then maximum & average stock + value columns
    for r in rows.values():
        if not r["active"]:
            continue
        avg = r.pop("_avg", 0.0)
        unit_rate = r.pop("_unit_rate_num", None)
        r.pop("_data_ok", None)
        abc = r["abc"]

        roq_raw = avg * ROQ_MONTHS.get(abc, 3)
        roq = math.ceil(roq_raw) if 0 < roq_raw < 1 else math.floor(roq_raw)
        r["roq"] = roq
        r["max_stock"] = math.ceil(r["rol"] + roq)
        r["avg_stock"] = math.ceil(r["rol"] + roq / 2.0)

        def val(q):
            return round(q * unit_rate, 2) if unit_rate is not None else NO_RATE
        r["ss_value"] = val(r["safety_stock"])
        r["rol_value"] = val(r["rol"])
        r["roq_value"] = val(roq)
        r["max_value"] = val(r["max_stock"])
        r["avg_value"] = val(r["avg_stock"])
        r["status_tag"] = "Active"

    for r in rows.values():
        for k in ("_avg", "_unit_rate_num", "_data_ok"):
            r.pop(k, None)
    return rows
