"""Savings Wizard — Fast/Slow/Non-moving × criticality opportunity matrix.

Three columns (FSN movement). Within each column, N rows by maintenance
criticality (A-Critical → E-Inconvenience). Each tile groups SKUs that share a
movement + criticality + opportunity, counts the ones carrying a meaningful
opportunity (> $1,000 or P1-critical), names the play, and narrates why they're
grouped. Plus the KPI band and portfolio insights.
"""
from __future__ import annotations

import math

import numpy as np

from ..db.models import Material
from ..ml.optimize import optimal_target

_Z95 = 1.645  # 95% service level — the single stocking-policy standard

FSN_ORDER = ["Fast", "Slow", "Non-moving"]
TIER_ORDER = ["A", "B", "C", "D", "E"]
TIER_LABEL = {
    "A": "Critical · production-down", "B": "Production stopper",
    "C": "Major maintenance impact", "D": "Minor maintenance impact", "E": "Inconvenience",
}
OPP_THRESHOLD = 1000.0
ACTION_LABEL = {
    "reduce_stock": "Safety stock can be optimized",
    "dispose": "Non-moving & low-criticality — write-off",
    "retain": "Critical spare — retain (no demand)",
    "reorder": "Below reorder point — replenish",
    "healthy": "Within the optimal band",
}
ACTION_NARR = {
    "reduce_stock": "hold safety stock above the optimal policy — trim to the reorder point to release working capital",
    "dispose": "are non-moving, low-criticality dead stock — dispose / write-off to recover capital",
    "retain": "are non-moving but critical (Vital / high-criticality) — retain as insurance spares despite no demand",
    "reorder": "sit below the reorder point and risk a stockout — replenish or rebalance to protect service",
    "healthy": "are within the healthy band — no action needed this cycle",
}

# A spare is a "keep even if dead" critical insurance item when it is Vital or
# highly critical — you never scrap it just because it has not moved.
def _is_critical(m: Material) -> bool:
    return m.ved == "Vital" or m.criticality_score >= 75


def _money(n: float) -> str:
    return f"€{n / 1e6:.1f}M" if abs(n) >= 1e6 else f"€{n / 1e3:.0f}K" if abs(n) >= 1e3 else f"€{n:.0f}"


def _tier(m: Material) -> str:
    s = m.criticality_score
    return "A" if s >= 80 else "B" if s >= 65 else "C" if s >= 45 else "D" if s >= 25 else "E"


def build_matrix(pairs: list[tuple[Material, list]], plants: list | None = None) -> dict:
    if not pairs:
        return {"kpis": {}, "cells": [], "insights": [], "tier": {}}
    tiers = {m.id: _tier(m) for m, _ in pairs}
    cells: dict[tuple, dict] = {}
    inv = ss = surplus = obsolete = critical_retained = understock_inv = 0.0
    understock_ct = 0

    for m, series in pairs:
        o = optimal_target(m, series)
        key = (m.fsn, tiers[m.id])
        c = cells.setdefault(key, {"count": 0, "value": 0.0, "savings": 0.0, "opp_count": 0,
                                   "excess": 0.0, "obsolete": 0.0, "critical": 0.0, "understock": 0})
        c["count"] += 1
        c["value"] += m.current_stock_value
        inv += m.current_stock_value
        # Safety stock consistent with the single stocking policy: ceil(z95 · σ)
        # units (flat 30-day lead) valued at the SAME unit rate the policy uses
        # (closing value ÷ closing stock); zero-stock items have no unit rate.
        _cons = [max(0.0, float(x)) for x in series]
        _std = float(np.std(_cons)) if len(_cons) > 1 else 0.0
        _unit_rate = (m.current_stock_value / m.on_hand_qty) if (m.on_hand_qty > 0 and m.current_stock_value > 0) else 0.0
        ss += math.ceil(_Z95 * _std) * _unit_rate

        sku_sav = 0.0
        needs_reorder = False
        if (o["pattern"] == "no_demand" or o["rate"] < 0.05) and m.fsn == "Non-moving":
            if _is_critical(m):
                # Critical insurance spare — retain even with no demand, NOT a write-off.
                c["critical"] += m.current_stock_value
                critical_retained += m.current_stock_value
            else:
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
            # € to buy to bring this item up to its policy target (new investment).
            understock_inv += max(0.0, o["target_value"] - m.current_stock_value)
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
            action = ("dispose" if c["obsolete"] > 0 and c["obsolete"] >= c["excess"] and c["obsolete"] >= c["critical"] else
                      "reduce_stock" if c["excess"] > 0 else
                      "reorder" if c["understock"] > 0 else
                      "retain" if c["critical"] > 0 else "healthy")
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
        "critical_retained_stock": round(critical_retained, 0),
        "understock_investment": round(understock_inv, 0),
        "total_opportunity": round(opportunity, 0),
        "working_capital_release": round(opportunity * 0.7, 0),
        "service_level": service, "at_risk_skus": understock_ct, "inventory_turns": turns,
    }
    insights = [
        f"{n} SKUs analyzed across the Fast/Slow/Non-moving × criticality matrix; {_money(opportunity)} total opportunity.",
        f"{_money(surplus)} of surplus/excess can be released by rightsizing safety stock to the optimal policy.",
        f"{_money(obsolete)} in non-moving, low-criticality dead stock — dispose / write-off candidates.",
        f"{_money(critical_retained)} in non-moving but critical spares — retained as insurance despite no demand.",
        f"{understock_ct} SKUs are below reorder point and at stockout risk — reorder or rebalance.",
    ]
    return {"kpis": kpis, "cells": cell_list, "insights": insights, "tier": tiers}
