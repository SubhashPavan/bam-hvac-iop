"""Sage agent tools — thin async wrappers over the services, returning a short
`summary` (for the LLM / chat text) plus a typed `block` (for the UI to render).

The same functions back both the LLM tool-calling loop and the rule-based
router, so behaviour is identical whichever path answers.
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from ..ml import service as fc
from ..ml.optimize import optimal_target
from ..ml.simulate import simulate_scenario, tradeoff_curve
from ..repositories.inventory_repo import InventoryRepo
from ..repositories.workflow_repo import WorkflowRepo, to_out
from ..services.classification_service import classify_portfolio
from ..services.kpi_service import compute_kpis
from ..services.network_service import build_pooling
from ..services.opportunity_service import build_opportunities
from ..services.vendor_service import build_vendors
from ..services.wizard_service import build_matrix


def _money(x: float) -> str:
    return f"€{x:,.0f}"


async def _pairs(repo: InventoryRepo, plant_ids):
    materials = await repo.materials_for_kpis(plant_ids=plant_ids)
    smap = await repo.series_for_plants(plant_ids)
    return [(m, smap.get(m.id, [])) for m in materials if m.id in smap]


async def get_kpis(session: AsyncSession, *, plant_ids=None) -> dict:
    repo = InventoryRepo(session)
    pairs = await _pairs(repo, plant_ids)
    plants = await repo.list_plants()
    if plant_ids:
        plants = [p for p in plants if p.id in plant_ids]
    k = compute_kpis(pairs, plants)
    scope = f"{len(plant_ids)} plant(s)" if plant_ids else "all plants"
    summary = (f"Across {scope}: {_money(k['total_inventory_value'])} inventory, "
               f"{_money(k['savings_potential'])} savings potential, "
               f"{k['service_level']}% service, {k['stockouts']} stockouts, "
               f"{_money(k['obsolete_stock_value'])} obsolete.")
    return {"summary": summary, "block": {"type": "kpis", "data": k}}


async def find_opportunities(session: AsyncSession, *, plant_ids=None, type=None,
                             min_value=8000.0, limit=5) -> dict:
    repo = InventoryRepo(session)
    pairs = await _pairs(repo, plant_ids)
    result = build_opportunities(pairs, min_value=min_value)
    groups = result["groups"]
    if type:
        groups = [g for g in groups if g["type"] == type]
    # trim items for payload/token size
    trimmed = []
    for g in groups:
        trimmed.append({**g, "items": g["items"][:limit]})
    top_line = ", ".join(f"{g['label']} {_money(g['total_savings'])}"
                         for g in sorted(groups, key=lambda x: -x["total_savings"]) if g["count"])
    summary = (f"{_money(sum(g['total_savings'] for g in groups))} across "
               f"{sum(g['count'] for g in groups)} opportunities" + (f": {top_line}." if top_line else "."))
    return {"summary": summary, "block": {"type": "opportunities",
            "data": {"groups": trimmed, "total_savings": result["total_savings"],
                     "total_cash_release": result["total_cash_release"],
                     "opportunity_count": result["opportunity_count"]}}}


async def savings_matrix(session: AsyncSession, *, plant_ids=None) -> dict:
    """The Savings Wizard's FSN x maintenance-criticality matrix — the primary
    landing view. Same numbers the UI shows, so chat and screen agree."""
    repo = InventoryRepo(session)
    pairs = await _pairs(repo, plant_ids)
    plants = await repo.list_plants()
    if plant_ids:
        plants = [p for p in plants if p.id in plant_ids]
    matrix = build_matrix(pairs, plants)
    k = matrix.get("kpis", {})
    hot = sorted((c for c in matrix.get("cells", []) if c.get("sku_count")),
                 key=lambda c: -c.get("savings", 0))[:3]
    top = "; ".join(f"{c['fsn']}/{c['tier_label']}: {c['opp_count']} SKUs, {_money(c['savings'])}" for c in hot)
    summary = (f"{_money(k.get('total_inventory', 0))} across {k.get('sku_count', 0)} SKUs; "
               f"{_money(k.get('total_opportunity', 0))} opportunity "
               f"({_money(k.get('working_capital_release', 0))} releasable, "
               f"{_money(k.get('obsolete_stock', 0))} obsolete). Biggest pockets — {top}.")
    return {"summary": summary, "block": {"type": "savings_matrix", "data": matrix}}


async def network_pooling(session: AsyncSession, *, plant_ids=None) -> dict:
    """Multi-site stock pooling — cover shortages from network surplus instead of buying."""
    repo = InventoryRepo(session)
    pairs = await _pairs(repo, plant_ids)
    plants = await repo.list_plants()
    if plant_ids:
        plants = [p for p in plants if p.id in plant_ids]
    res = build_pooling(pairs, plants)
    s = res["summary"]
    summary = (f"{s['move_count']} rebalance moves free {_money(s['capital_freed'])} in avoided purchases, "
               f"covering {s['at_risk_covered']} shortages across {s['plants_involved']} plants.")
    return {"summary": summary, "block": {"type": "network_pooling", "data": res}}


async def vendors(session: AsyncSession, *, plant_ids=None) -> dict:
    """Supplier & lead-time analytics — how much safety stock each vendor's lead time drives."""
    repo = InventoryRepo(session)
    pairs = await _pairs(repo, plant_ids)
    plants = await repo.list_plants()
    if plant_ids:
        plants = [p for p in plants if p.id in plant_ids]
    res = build_vendors(pairs, plants)
    s = res["summary"]
    summary = (f"{_money(s['safety_stock_value'])} of safety stock is driven by supplier lead time "
               f"(avg {s['avg_lead_days']}d); {s['high_impact_count']} high-impact suppliers, "
               f"worst = {s['worst_lead_supplier']}.")
    return {"summary": summary, "block": {"type": "vendors", "data": res}}


async def forecast_material(session: AsyncSession, *, material_id: str) -> dict:
    repo = InventoryRepo(session)
    m = await repo.get_material(material_id)
    if not m:
        return {"summary": f"No material found with code {material_id}.", "block": None}
    ds = await repo.get_series(material_id)
    detail = fc.forecast_detail(m, ds.series if ds else [], horizon=6)
    p = detail["planning"]
    summary = (f"{m.description} ({material_id}): {detail['demand_pattern']} demand, "
               f"forecast via {detail['method']} at ~{detail['per_period_demand']}/mo "
               f"(accuracy {detail['accuracy']['model_accuracy']}%). Reorder point "
               f"{p['reorder_point']:.0f}, safety stock {p['safety_stock']:.0f}.")
    return {"summary": summary, "block": {"type": "forecast", "data": detail}}


async def demand_outlook(session: AsyncSession, *, plant_ids=None, horizon=12) -> dict:
    repo = InventoryRepo(session)
    pairs = await _pairs(repo, plant_ids)
    out = fc.aggregate_outlook(pairs, horizon=horizon)
    summary = (f"Demand outlook: {out['total_forecast_qty']:.0f} units over {horizon}m "
               f"({out['growth_count']} rising, {out['decline_count']} falling of "
               f"{out['material_count']}); model accuracy {out['model_accuracy']}%.")
    return {"summary": summary, "block": {"type": "demand_outlook", "data": out}}


async def classify(session: AsyncSession, *, plant_ids=None) -> dict:
    repo = InventoryRepo(session)
    materials = await repo.materials_for_kpis(plant_ids=plant_ids)
    plants = await repo.list_plants()
    if plant_ids:
        plants = [p for p in plants if p.id in plant_ids]
    c = classify_portfolio(materials, plants=plants)
    sc = c["scorecard"]
    summary = (f"{c['material_count']} SKUs, {_money(c['total_value'])}. Turns {sc['inventory_turns']}, "
               f"DIO {sc['days_outstanding']}d, policy compliance {sc['policy_compliance']}%, "
               f"obsolescence {sc['obsolescence_rate']*100:.1f}%.")
    return {"summary": summary, "block": {"type": "classification", "data": c}}


async def run_simulation(session: AsyncSession, *, plant_ids=None, demand_multiplier=1.0,
                         lead_multiplier=1.0, target_service_level=0.95, label=None) -> dict:
    repo = InventoryRepo(session)
    pairs = await _pairs(repo, plant_ids)
    label = label or _scenario_label(demand_multiplier, lead_multiplier, target_service_level)
    res = simulate_scenario(pairs, label=label, demand_mult=demand_multiplier,
                            lead_mult=lead_multiplier, target_service=target_service_level,
                            trials=500, saved_at=datetime.now(timezone.utc).isoformat())
    summary = (f"{label}: attained service {res['attained_service_level']}%, stockout risk "
               f"{res['stockout_risk']}%, {res['at_risk_count']} vital/essential at risk; "
               f"investment to hit {int(target_service_level*100)}% = "
               f"{_money(res['scenario_investment'])}.")
    return {"summary": summary, "block": {"type": "scenario", "data": res}}


async def tradeoff(session: AsyncSession, *, plant_ids=None) -> dict:
    repo = InventoryRepo(session)
    pairs = await _pairs(repo, plant_ids)
    plants = await repo.list_plants()
    if plant_ids:
        plants = [p for p in plants if p.id in plant_ids]
    t = tradeoff_curve(pairs, plants=plants)
    summary = (f"Current {_money(t['current_investment'])} at {t['current_service']}% service. "
               f"Curve spans {_money(t['curve'][0]['investment'])} (80%) to "
               f"{_money(t['curve'][-1]['investment'])} (99.5%).")
    return {"summary": summary, "block": {"type": "tradeoff", "data": t}}


async def search_materials(session: AsyncSession, *, query=None, plant_ids=None, ved=None,
                           fsn=None, limit=8) -> dict:
    repo = InventoryRepo(session)
    items, total = await repo.list_materials(plant_ids=plant_ids, search=query, ved=ved,
                                             fsn=fsn, page=1, page_size=limit)
    data = [{"id": m.id, "description": m.description, "plant_id": m.plant_id,
             "current_stock_value": m.current_stock_value, "coverage_days": m.coverage_days,
             "ved": m.ved, "fsn": m.fsn, "xyz": m.xyz} for m in items]
    summary = f"{total} materials match" + (f" '{query}'" if query else "") + f"; showing {len(data)}."
    return {"summary": summary, "block": {"type": "materials", "data": {"items": data, "total": total}}}


async def create_action(session: AsyncSession, *, material_id: str, kind: str | None = None,
                        note: str = "", priority: str = "medium") -> dict:
    """Side-effectful: raise a workflow request for a material, sized from its optimal target."""
    repo = InventoryRepo(session)
    m = await repo.get_material(material_id)
    if not m:
        return {"summary": f"No material {material_id}.", "block": None}
    ds = await repo.get_series(material_id)
    o = optimal_target(m, ds.series if ds else [])
    if not kind:
        kind = "dispose" if o["pattern"] == "no_demand" else \
               "reduce_stock" if o["excess_units"] > 0 else "increase_stock"
        # Rebalance beats reduce when another plant is short on the same part — mirrors the SKU 360.
        if kind == "reduce_stock":
            others = await repo.materials_for_kpis()
            if any(x.plant_id != m.plant_id and x.category == m.category and x.supplier == m.supplier
                   and x.coverage_days < 25 and x.ved in ("Vital", "Essential") for x in others):
                kind = "transfer"
    proposed = 0 if kind == "dispose" else o["target_value"]
    savings = max(0.0, m.current_stock_value - proposed)
    seed = {"materialId": m.id, "materialDesc": m.description, "plantId": m.plant_id, "kind": kind,
            "currentValue": m.current_stock_value, "proposedValue": proposed, "savings": savings,
            "cashRelease": round(savings * 0.7, 0),
            "justification": note or f"Sage-raised {kind} from optimal target ({o['pattern']} demand)."}
    req = await WorkflowRepo(session).create(seed=seed, note=note or "Raised by Sage",
                                             priority=priority, routing="maintenance_planner")
    return {"summary": f"Created {req.id} ({kind}, saving {_money(savings)}); routed to Maintenance.",
            "block": {"type": "action", "data": to_out(req)}}


def _scenario_label(dm, lm, sl) -> str:
    parts = []
    if dm != 1.0:
        parts.append(f"demand {'+' if dm > 1 else ''}{int((dm-1)*100)}%")
    if lm != 1.0:
        parts.append(f"lead {lm:g}x")
    parts.append(f"target {int(sl*100)}%")
    return "What-if: " + ", ".join(parts)
