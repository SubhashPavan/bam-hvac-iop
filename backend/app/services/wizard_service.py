"""Savings Wizard — Fast/Slow/Non-moving × criticality opportunity matrix.

Three columns (FSN movement). Within each column, N rows by maintenance
criticality (A-Critical → E-Inconvenience). Each tile groups SKUs that share a
movement + criticality + opportunity, counts the ones carrying a meaningful
opportunity (> $1,000 or P1-critical), names the play, and narrates why they're
grouped. Plus the KPI band and portfolio insights.
"""
from __future__ import annotations

from ..db.models import Material
from ..ml.optimize import optimal_target

FSN_ORDER = ["Fast", "Slow", "Non-moving"]
TIER_ORDER = ["A", "B", "C", "D", "E"]
TIER_LABEL = {
    "A": "Critical · production-down", "B": "Production stopper",
    "C": "Major maintenance impact", "D": "Minor maintenance impact", "E": "Inconvenience",
}
OPP_THRESHOLD = 1000.0
ACTION_LABEL = {
    "reduce_stock": "Safety stock can be optimized",
    "dispose": "Surplus / obsolete — write-off",
    "reorder": "Below reorder point — replenish",
    "healthy": "Within the optimal band",
}
ACTION_NARR = {
    "reduce_stock": "hold safety stock above the optimal policy — trim to the reorder point to release working capital",
    "dispose": "are non-moving with stock on hand — dispose / write-off to recover capital",
    "reorder": "sit below the reorder point and risk a stockout — replenish or rebalance to protect service",
    "healthy": "are within the healthy band — no action needed this cycle",
}


def _money(n: float) -> str:
    return f"${n / 1e6:.1f}M" if abs(n) >= 1e6 else f"${n / 1e3:.0f}K" if abs(n) >= 1e3 else f"${n:.0f}"


def _tier(m: Material) -> str:
    s = m.criticality_score
    return "A" if s >= 80 else "B" if s >= 65 else "C" if s >= 45 else "D" if s >= 25 else "E"


def build_matrix(pairs: list[tuple[Material, list]], plants: list | None = None) -> dict:
    if not pairs:
        return {"kpis": {}, "cells": [], "insights": [], "tier": {}}
    tiers = {m.id: _tier(m) for m, _ in pairs}
    cells: dict[tuple, dict] = {}
    inv = ss = surplus = obsolete = 0.0
    understock_ct = 0

    for m, series in pairs:
        o = optimal_target(m, series)
        key = (m.fsn, tiers[m.id])
        c = cells.setdefault(key, {"count": 0, "value": 0.0, "savings": 0.0, "opp_count": 0,
                                   "excess": 0.0, "obsolete": 0.0, "understock": 0})
        c["count"] += 1
        c["value"] += m.current_stock_value
        inv += m.current_stock_value
        ss += o["safety_stock"] * m.unit_cost

        sku_sav = 0.0
        needs_reorder = False
        if (o["pattern"] == "no_demand" or o["rate"] < 0.05) and m.fsn == "Non-moving":
            sku_sav = m.current_stock_value
            c["obsolete"] += sku_sav
            obsolete += sku_sav
        elif o["excess_value"] > 0:
            sku_sav = o["excess_value"]
            c["excess"] += sku_sav
            surplus += sku_sav
        elif o["understocked"]:
            needs_reorder = True
            c["understock"] += 1
            understock_ct += 1
        c["savings"] += sku_sav

        is_p1 = m.ved == "Vital" or m.criticality_score >= 75
        if sku_sav > OPP_THRESHOLD or (is_p1 and (sku_sav > 0 or needs_reorder)):
            c["opp_count"] += 1

    cell_list = []
    for f in FSN_ORDER:
        for t in TIER_ORDER:
            c = cells.get((f, t))
            if not c:
                cell_list.append({"fsn": f, "tier": t, "tier_label": TIER_LABEL[t], "sku_count": 0,
                                  "opp_count": 0, "stock_value": 0, "savings": 0, "action": "none",
                                  "label": "", "narration": ""})
                continue
            action = ("dispose" if c["obsolete"] > c["excess"] else
                      "reduce_stock" if c["excess"] > 0 else
                      "reorder" if c["understock"] > 0 else "healthy")
            mv = "non-moving" if f == "Non-moving" else f"{f.lower()}-moving"
            narration = f"{TIER_LABEL[t]} {mv} SKUs that {ACTION_NARR[action]}."
            cell_list.append({"fsn": f, "tier": t, "tier_label": TIER_LABEL[t], "sku_count": c["count"],
                              "opp_count": c["opp_count"], "stock_value": round(c["value"], 0),
                              "savings": round(c["savings"], 0), "action": action,
                              "label": ACTION_LABEL[action], "narration": narration})

    n = len(pairs)
    annual_cogs = sum(m.unit_cost * m.avg_monthly_demand * 12 for m, _ in pairs)
    turns = round(annual_cogs / inv, 1) if inv else 0.0
    service = round(sum(p.service_level for p in plants) / len(plants), 1) if plants else 0.0
    opportunity = surplus + obsolete
    kpis = {
        "total_inventory": round(inv, 0), "sku_count": n, "safety_stock": round(ss, 0),
        "surplus_stock": round(surplus, 0), "obsolete_stock": round(obsolete, 0),
        "total_opportunity": round(opportunity, 0),
        "working_capital_release": round(opportunity * 0.7, 0),
        "service_level": service, "at_risk_skus": understock_ct, "inventory_turns": turns,
    }
    insights = [
        f"{n} SKUs analyzed across the Fast/Slow/Non-moving × criticality matrix; {_money(opportunity)} total opportunity.",
        f"{_money(surplus)} of surplus/excess can be released by rightsizing safety stock to the optimal policy.",
        f"{_money(obsolete)} sits in non-moving / obsolete SKUs — dispose or write-off candidates.",
        f"{understock_ct} SKUs are below reorder point and at stockout risk — reorder or rebalance.",
    ]
    return {"kpis": kpis, "cells": cell_list, "insights": insights, "tier": tiers}
