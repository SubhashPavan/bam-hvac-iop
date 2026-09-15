"""Root-cause analytics — why is this SKU overstocked, at risk, or obsolete?

Deterministic drivers derived from the demand pattern, trend, lead time and the
policy gap. Oniqua-style exception explanation: not just "reduce stock" but the
reason the imbalance exists, so the planner trusts (and can defend) the action.
"""
from __future__ import annotations

from ..db.models import Material


def root_cause(material: Material, *, pattern: str, rate: float, trend: int, plan: dict) -> dict:
    on_hand = material.on_hand_qty
    rop = plan.get("reorder_point", 0.0)
    target = rop + rate
    cover = material.coverage_days
    rec_cover = plan.get("recommended_coverage_days") or 0
    lead = plan.get("lead_time_days", 0)
    roq = plan.get("reorder_qty", 0.0)

    # headline state
    if (pattern == "no_demand" or rate < 0.05) and material.fsn == "Non-moving":
        state = "obsolete"
    elif on_hand < rop:
        state = "understocked"
    elif on_hand > target:
        state = "overstocked"
    else:
        state = "healthy"

    drivers: list[dict] = []

    def add(factor, label, detail, severity):
        drivers.append({"factor": factor, "label": label, "detail": detail, "severity": severity})

    if state == "obsolete":
        add("no_demand", "No consumption on record",
            f"{pattern} demand — nothing drawn recently; the on-hand stock is dead capital.", "high")
    if trend <= -15 and state != "understocked":
        add("demand_decline", "Demand has fallen",
            f"Usage down {trend}% vs the prior 6 months — stock was sized for higher past demand.", "high")
    if pattern in ("lumpy", "erratic"):
        add("spiky_demand", "Spiky / erratic demand",
            f"{pattern.title()} pattern forces a larger safety buffer to hold the same service level.", "medium")
    if lead >= 50:
        add("long_lead", "Long supplier lead time",
            f"{lead}-day lead time inflates the reorder point and safety stock for this part.", "medium")
    if rec_cover and cover > rec_cover * 1.8:
        add("excess_coverage", "Coverage far above target",
            f"{cover}d on hand vs a {rec_cover:.0f}d optimal reorder point — surplus buffer.", "high")
    if rate > 0 and roq > rate * 4:
        add("large_moq", "Large order quantity",
            f"Economic order qty (~{roq:.0f}) is big relative to ~{rate:.1f}/mo usage — adds cycle stock.", "low")
    if state == "understocked":
        add("below_reorder", "Below reorder point",
            f"On-hand {on_hand} is under the {rop:.0f} reorder point — replenishment is overdue.", "high")

    if not drivers:
        add("balanced", "Within the optimal band",
            "On-hand sits between the reorder point and the target — no driver of imbalance.", "low")

    return {"state": state, "drivers": drivers}
