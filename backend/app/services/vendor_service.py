"""Vendor & lead-time analytics — Oniqua-style supplier lens.

Long and variable supplier lead times are a primary driver of safety stock: the
buffer scales with sqrt(lead) and with lead-time variability. This aggregates the
portfolio by supplier and quantifies how much stock each supplier's lead time is
driving, so planners can target the vendors that inflate working capital most.
"""
from __future__ import annotations

import statistics
from collections import defaultdict

from ..db.models import Material
from ..ml.optimize import optimal_target
from ..ml.planning import lead_time_days


def build_vendors(pairs: list[tuple[Material, list]], plants: list | None = None) -> dict:
    by_sup: dict[str, list] = defaultdict(list)
    for m, s in pairs:
        by_sup[m.supplier].append((m, s))

    rows = []
    for sup, members in by_sup.items():
        leads, ss_value, stock_value, vital, crit = [], 0.0, 0.0, 0, []
        cats: set[str] = set()
        for m, s in members:
            lead = lead_time_days(m.id, m.category)
            leads.append(lead)
            o = optimal_target(m, s)
            ss_value += o["safety_stock"] * m.unit_cost
            stock_value += m.current_stock_value
            cats.add(m.category)
            crit.append(m.criticality_score)
            if m.ved == "Vital":
                vital += 1
        avg_lead = statistics.mean(leads)
        lead_var = statistics.pstdev(leads) if len(leads) > 1 else 0.0
        # reliability proxy: longer + more variable lead → lower on-time %
        variability = lead_var / avg_lead if avg_lead else 0.0
        on_time = max(60.0, round(98 - avg_lead * 0.15 - variability * 40, 0))
        flags = []
        if avg_lead >= 55:
            flags.append("long lead time")
        if variability >= 0.28:
            flags.append("high variability")
        if vital >= 3:
            flags.append(f"{vital} vital parts")
        rows.append({
            "supplier": sup,
            "sku_count": len(members),
            "category_count": len(cats),
            "stock_value": round(stock_value, 0),
            "safety_stock_value": round(ss_value, 0),
            "avg_lead_days": round(avg_lead, 0),
            "lead_min": min(leads), "lead_max": max(leads),
            "lead_variability_pct": round(variability * 100, 0),
            "on_time_pct": on_time,
            "vital_count": vital,
            "avg_criticality": round(statistics.mean(crit), 0) if crit else 0,
            "flags": flags,
        })

    # rank by the stock the lead time is driving
    rows.sort(key=lambda r: -r["safety_stock_value"])
    total_ss = sum(r["safety_stock_value"] for r in rows)
    at_risk = [r for r in rows if r["flags"] and "long lead time" in r["flags"] or r["lead_variability_pct"] >= 28]
    return {
        "vendors": rows,
        "summary": {
            "supplier_count": len(rows),
            "safety_stock_value": round(total_ss, 0),
            "avg_lead_days": round(statistics.mean([r["avg_lead_days"] for r in rows]), 0) if rows else 0,
            "worst_lead_supplier": rows[0]["supplier"] if rows else None,
            "high_impact_count": len(at_risk),
        },
    }
