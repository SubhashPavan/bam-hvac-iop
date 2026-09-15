"""Opportunity engine — turns optimal-stock targets into actionable savings,
grouped into the six MRO optimization plays the UI shows. Each item carries an
ActionSeed so it can be pushed straight into the approval workflow.

Single-material (vs optimal target):  obsolete_stock · excess_inventory · safety_stock_overstock
Cross-material (network):             stock_transfer · duplicate_materials · supplier_consolidation
"""
from __future__ import annotations

from collections import defaultdict

from ..db.models import Material
from ..ml.optimize import optimal_target

GROUP_LABEL = {
    "excess_inventory": "Excess / overstock",
    "obsolete_stock": "Obsolete stock",
    "stock_transfer": "Stock transfer",
    "duplicate_materials": "Duplicate materials",
    "supplier_consolidation": "Supplier consolidation",
}
GROUP_ORDER = list(GROUP_LABEL.keys())


def _risk(ved: str, base: str = "low") -> str:
    return {"Vital": "high", "Essential": "medium"}.get(ved, base)


def _seed(material_id, desc, plant, kind, cur, prop, savings, cash, why) -> dict:
    return {
        "materialId": material_id, "materialDesc": desc, "plantId": plant, "kind": kind,
        "currentValue": round(cur, 0), "proposedValue": round(prop, 0),
        "savings": round(savings, 0), "cashRelease": round(cash, 0), "justification": why,
    }


# ── single-material detectors ────────────────────────────────────────
def _obsolete(m: Material, o: dict) -> dict:
    cur = m.current_stock_value
    savings, cash = cur, round(cur * 0.6, 0)
    why = (f"No/near-zero consumption ({o['pattern']}); {m.fsn} mover holding ${cur:,.0f}. "
           f"Write-off / disposal recovers working capital.")
    return {"id": f"opp-obs-{m.id}", "type": "obsolete_stock", "material_id": m.id,
            "material_desc": m.description, "plant_id": m.plant_id, "plant_ids": None,
            "category": m.category, "current_value": cur, "recommended_value": 0.0,
            "savings_potential": savings, "cash_release": cash, "risk": _risk(m.ved, "low"),
            "rationale": why, "action_seed": _seed(m.id, m.description, m.plant_id, "dispose",
                                                    cur, 0, savings, cash, why)}


def _excess(m: Material, o: dict) -> dict:
    cur, target = m.current_stock_value, o["target_value"]
    savings = max(0.0, cur - target)
    cash = round(savings * 0.7, 0)
    why = (f"On-hand {m.on_hand_qty} units vs optimal {o['target_units']:.0f} "
           f"({o['pattern']} demand ~{o['rate']:.1f}/mo, lead {o['lead_days']}d). Reduce to target.")
    return {"id": f"opp-exc-{m.id}", "type": "excess_inventory", "material_id": m.id,
            "material_desc": m.description, "plant_id": m.plant_id, "plant_ids": None,
            "category": m.category, "current_value": cur, "recommended_value": target,
            "savings_potential": savings, "cash_release": cash, "risk": _risk(m.ved, "low"),
            "rationale": why, "action_seed": _seed(m.id, m.description, m.plant_id, "reduce_stock",
                                                    cur, target, savings, cash, why)}


def _safety(m: Material, o: dict) -> dict:
    cur, target = m.current_stock_value, o["target_value"]
    savings = max(0.0, cur - target)
    cash = round(savings * 0.75, 0)
    why = (f"Coverage {m.coverage_days}d exceeds the {o['recommended_coverage_days']:.0f}d reorder point; "
           f"safety buffer is oversized for {o['pattern']} demand. Trim policy to optimal.")
    return {"id": f"opp-ss-{m.id}", "type": "safety_stock_overstock", "material_id": m.id,
            "material_desc": m.description, "plant_id": m.plant_id, "plant_ids": None,
            "category": m.category, "current_value": cur, "recommended_value": target,
            "savings_potential": savings, "cash_release": cash, "risk": _risk(m.ved, "low"),
            "rationale": why, "action_seed": _seed(m.id, m.description, m.plant_id, "param_change",
                                                    cur, target, savings, cash, why)}


# ── cross-material detectors ─────────────────────────────────────────
def _transfers(opt: dict[str, tuple[Material, dict]], min_value: float) -> list[dict]:
    groups: dict[tuple, list] = defaultdict(list)
    for m, o in opt.values():
        groups[(m.category, m.supplier)].append((m, o))
    out = []
    for (cat, sup), members in groups.items():
        excess = sorted([(m, o) for m, o in members if o["excess_value"] >= min_value],
                        key=lambda x: -x[1]["excess_value"])
        needy = sorted([(m, o) for m, o in members
                        if o["understocked"] and m.ved in ("Vital", "Essential")],
                       key=lambda x: -((x[1]["reorder_point"] - x[0].on_hand_qty) * x[0].unit_cost))
        for (em, eo), (nm, no) in zip(excess, needy):
            if em.plant_id == nm.plant_id:
                continue
            need_units = max(0.0, no["reorder_point"] - nm.on_hand_qty)
            move_units = min(eo["excess_units"], need_units)
            move_value = round(move_units * nm.unit_cost, 0)
            if move_value < min_value:
                continue
            why = (f"{cat}/{sup}: move ~{move_units:.0f} units from {em.plant_id} (excess) to "
                   f"{nm.plant_id} (below reorder for a {nm.ved} item) - avoids a ${move_value:,.0f} purchase.")
            out.append({"id": f"opp-xfer-{em.id}-{nm.id}", "type": "stock_transfer",
                        "material_id": em.id, "material_desc": em.description, "plant_id": em.plant_id,
                        "plant_ids": [em.plant_id, nm.plant_id], "category": cat,
                        "current_value": em.current_stock_value,
                        "recommended_value": em.current_stock_value - move_value,
                        "savings_potential": move_value, "cash_release": move_value,
                        "risk": "medium", "rationale": why,
                        "action_seed": _seed(em.id, em.description, em.plant_id, "transfer",
                                             em.current_stock_value, em.current_stock_value - move_value,
                                             move_value, move_value, why)})
    return out


def _duplicates(pairs: list[tuple[Material, list]], min_value: float) -> list[dict]:
    groups: dict[tuple, list[Material]] = defaultdict(list)
    for m, _ in pairs:
        groups[(m.plant_id, m.category, m.supplier)].append(m)
    out = []
    for (plant, cat, sup), mats in groups.items():
        if len(mats) < 2:
            continue
        mats.sort(key=lambda m: -m.current_stock_value)
        redundant = mats[1:]  # standardize onto the primary line
        red_value = sum(m.current_stock_value for m in redundant)
        savings = round(red_value * 0.2, 0)
        if savings < min_value:
            continue
        primary = mats[0]
        codes = ", ".join(m.id for m in mats[:4])
        why = (f"{len(mats)} overlapping {cat}/{sup} codes at {plant} ({codes}...). "
               f"Rationalize to one SKU - cuts duplicate safety stock & handling.")
        out.append({"id": f"opp-dup-{plant}-{cat}-{sup}".replace(" ", ""), "type": "duplicate_materials",
                    "material_id": primary.id, "material_desc": f"{cat} / {sup} ({len(mats)} codes)",
                    "plant_id": plant, "plant_ids": None, "category": cat,
                    "current_value": red_value, "recommended_value": red_value - savings,
                    "savings_potential": savings, "cash_release": round(savings * 0.7, 0),
                    "risk": "low", "rationale": why,
                    "action_seed": _seed(primary.id, f"{cat}/{sup} duplicates", plant, "param_change",
                                         red_value, red_value - savings, savings,
                                         round(savings * 0.7, 0), why)})
    return out


def _supplier_consolidation(pairs: list[tuple[Material, list]], min_value: float) -> list[dict]:
    groups: dict[tuple, list[Material]] = defaultdict(list)
    for m, _ in pairs:
        groups[(m.plant_id, m.category)].append(m)
    out = []
    for (plant, cat), mats in groups.items():
        suppliers = {m.supplier for m in mats}
        if len(suppliers) < 4:
            continue
        spend = sum(m.current_stock_value for m in mats)
        savings = round(spend * 0.06, 0)
        if savings < min_value:
            continue
        primary = max(mats, key=lambda m: m.current_stock_value)
        why = (f"{cat} at {plant} is split across {len(suppliers)} suppliers (${spend:,.0f} spend). "
               f"Consolidate for ~6% volume leverage.")
        out.append({"id": f"opp-sup-{plant}-{cat}".replace(" ", ""), "type": "supplier_consolidation",
                    "material_id": primary.id, "material_desc": f"{cat} - {len(suppliers)} suppliers",
                    "plant_id": plant, "plant_ids": None, "category": cat,
                    "current_value": spend, "recommended_value": spend - savings,
                    "savings_potential": savings, "cash_release": savings, "risk": "low",
                    "rationale": why,
                    "action_seed": _seed(primary.id, f"{cat} supplier consolidation", plant,
                                         "param_change", spend, spend - savings, savings, savings, why)})
    return out


def build_opportunities(pairs: list[tuple[Material, list]], *, min_value: float = 8000.0,
                        service_level: float = 0.95) -> dict:
    buckets: dict[str, list] = {k: [] for k in GROUP_ORDER}
    opt: dict[str, tuple[Material, dict]] = {}

    for m, series in pairs:
        o = optimal_target(m, series, service_level=service_level)
        opt[m.id] = (m, o)
        cur = m.current_stock_value
        if (o["pattern"] == "no_demand" or o["rate"] < 0.05) and m.fsn == "Non-moving":
            if cur >= min_value:
                buckets["obsolete_stock"].append(_obsolete(m, o))
            continue
        if o["excess_units"] > 0:
            # Excess and safety-stock overstock are the same lever: on-hand above
            # the policy target. One group.
            excess_value = o["excess_units"] * m.unit_cost
            if excess_value >= min_value:
                buckets["excess_inventory"].append(_excess(m, o))

    buckets["stock_transfer"] = _transfers(opt, min_value)
    buckets["duplicate_materials"] = _duplicates(pairs, min_value)
    buckets["supplier_consolidation"] = _supplier_consolidation(pairs, min_value)

    groups = []
    total_savings = total_cash = 0.0
    for key in GROUP_ORDER:
        items = sorted(buckets[key], key=lambda x: -x["savings_potential"])
        gs = sum(i["savings_potential"] for i in items)
        gc = sum(i["cash_release"] for i in items)
        total_savings += gs
        total_cash += gc
        groups.append({"type": key, "label": GROUP_LABEL[key], "count": len(items),
                       "total_savings": round(gs, 0), "total_cash_release": round(gc, 0),
                       "items": items})

    return {"groups": groups, "total_savings": round(total_savings, 0),
            "total_cash_release": round(total_cash, 0),
            "opportunity_count": sum(g["count"] for g in groups)}
