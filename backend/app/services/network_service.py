"""Network stock pooling — Oniqua-style multi-site rebalancing.

For each part family (category + supplier, the proxy for "same part across sites"),
find plants holding SURPLUS against their optimal policy and plants running SHORT
(below reorder point on a Vital/Essential item), then propose moves that cover the
shortage from existing network stock instead of buying — freeing working capital
and avoiding a purchase. Rolls up to a network-level summary.
"""
from __future__ import annotations

from collections import defaultdict

from ..db.models import Material
from ..ml.optimize import optimal_target

MIN_MOVE_VALUE = 1000.0


def _plant_name(plants, pid: str) -> str:
    for p in plants or []:
        if p.id == pid:
            return p.name
    return pid


def build_pooling(pairs: list[tuple[Material, list]], plants: list | None = None) -> dict:
    opt = {m.id: (m, optimal_target(m, s)) for m, s in pairs}
    families: dict[tuple, list] = defaultdict(list)
    for m, o in opt.values():
        families[(m.category, m.supplier)].append((m, o))

    moves: list[dict] = []
    for (cat, sup), members in families.items():
        surplus = sorted([(m, o) for m, o in members if o["excess_units"] > 0],
                         key=lambda x: -x[1]["excess_value"])
        short = sorted([(m, o) for m, o in members
                        if o["understocked"] and m.ved in ("Vital", "Essential")],
                       key=lambda x: -((x[1]["reorder_point"] - x[0].on_hand_qty) * x[0].unit_cost))
        if not surplus or not short:
            continue
        # greedily cover each shortage from remaining surplus at OTHER plants
        pool = [[m, o, o["excess_units"]] for m, o in surplus]  # mutable remaining units
        for nm, no in short:
            need = max(0.0, no["reorder_point"] - nm.on_hand_qty)
            for slot in pool:
                if need <= 0.5:
                    break
                em, eo, avail = slot
                if avail <= 0.5 or em.plant_id == nm.plant_id:
                    continue
                mv = min(avail, need)
                val = round(mv * nm.unit_cost, 0)
                if val < MIN_MOVE_VALUE:
                    continue
                slot[2] -= mv
                need -= mv
                from_after = round(max(0.0, em.current_stock_value - val), 0)
                moves.append({
                    "id": f"pool-{em.id}-{nm.id}",
                    "category": cat, "supplier": sup,
                    "part": nm.description,
                    "from_plant": em.plant_id, "from_plant_name": _plant_name(plants, em.plant_id),
                    "to_plant": nm.plant_id, "to_plant_name": _plant_name(plants, nm.plant_id),
                    "to_ved": nm.ved, "to_criticality": nm.criticality_score,
                    "units": round(mv, 0), "value": val,
                    "from_coverage": em.coverage_days, "to_coverage": nm.coverage_days,
                    "rationale": (f"{cat} / {sup}: {em.plant_id} holds surplus while {nm.plant_id} is below "
                                  f"reorder on a {nm.ved} item — move ~{mv:.0f} units to avoid a "
                                  f"€{val:,.0f} purchase and protect service."),
                    "action_seed": {
                        "materialId": em.id, "materialDesc": em.description, "plantId": em.plant_id,
                        "kind": "transfer", "currentValue": round(em.current_stock_value, 0),
                        "proposedValue": from_after,
                        "savings": val, "cashRelease": val,
                        "justification": (f"Rebalance {mv:.0f} units of {cat}/{sup} from {em.plant_id} to "
                                          f"{nm.plant_id} (short on a {nm.ved} part)."),
                    },
                })

    moves.sort(key=lambda x: -x["value"])
    capital_freed = round(sum(x["value"] for x in moves), 0)
    plants_touched = {p for x in moves for p in (x["from_plant"], x["to_plant"])}
    families_balanced = len({(x["category"], x["supplier"]) for x in moves})
    return {
        "moves": moves,
        "summary": {
            "move_count": len(moves),
            "capital_freed": capital_freed,
            "purchases_avoided": capital_freed,
            "units_moved": round(sum(x["units"] for x in moves), 0),
            "at_risk_covered": len({x["to_plant"] + x["part"] for x in moves}),
            "plants_involved": len(plants_touched),
            "families_balanced": families_balanced,
        },
    }
