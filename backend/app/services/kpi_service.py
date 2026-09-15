"""Derive the 8 overview KPIs.

The overview tiles MUST reconcile with the Savings Wizard (the primary view),
so `compute_kpis` is derived from the SAME `build_matrix` the Wizard uses —
identical inventory / opportunity / obsolete / service / at-risk definitions.
Later these move to a Databricks `agg_kpis` gold table.
"""
from __future__ import annotations

from ..db.models import Material, Recommendation
from .wizard_service import build_matrix


def compute_kpis(pairs: list[tuple[Material, list]], plants: list | None = None) -> dict:
    """Overview KPIs, mapped from the Savings Wizard matrix so the tiles agree
    with the Wizard tab exactly. `pairs` = (material, demand_series) list."""
    m = build_matrix(pairs, plants)
    k = m.get("kpis", {})
    turns = k.get("inventory_turns", 0.0) or 0.0
    return {
        "total_inventory_value": k.get("total_inventory", 0.0),
        "savings_potential": k.get("total_opportunity", 0.0),
        "service_level": k.get("service_level", 0.0),
        "working_capital_released": k.get("working_capital_release", 0.0),
        "inventory_turns_yoy": turns,
        "days_inventory_outstanding": round(365 / turns, 1) if turns else 0.0,
        "obsolete_stock_value": k.get("obsolete_stock", 0.0),
        "stockouts": k.get("at_risk_skus", 0),
    }


def compute_kpis_legacy(materials: list[Material], recs: list[Recommendation]) -> dict:
    total_value = sum(m.current_stock_value for m in materials)
    savings_potential = sum(r.savings_potential for r in recs)

    # service level — average across the materials' plants (proxy via count-weighted mean)
    service_level = (
        round(sum(_service_proxy(m) for m in materials) / len(materials), 1) if materials else 0.0
    )

    working_capital_released = sum(
        r.cash_release for r in recs if r.workflow_status == "implemented"
    )

    obsolete_stock_value = sum(
        m.current_stock_value for m in materials
        if m.fsn == "Non-moving" and m.coverage_days > 200
    )

    stockouts = sum(1 for m in materials if m.coverage_days < 15)

    # turns & DIO — derived from value vs annualised consumption (unit_cost * demand * 12)
    annual_cogs = sum(m.unit_cost * m.avg_monthly_demand * 12 for m in materials)
    turns = round(annual_cogs / total_value, 2) if total_value else 0.0
    dio = round(365 / turns, 1) if turns else 0.0

    return {
        "total_inventory_value": round(total_value, 2),
        "savings_potential": round(savings_potential, 2),
        "service_level": service_level,
        "working_capital_released": round(working_capital_released, 2),
        "inventory_turns_yoy": turns,
        "days_inventory_outstanding": dio,
        "obsolete_stock_value": round(obsolete_stock_value, 2),
        "stockouts": stockouts,
    }


def _service_proxy(m: Material) -> float:
    """Coverage-informed service proxy: low coverage -> lower attained service."""
    if m.coverage_days < 15:
        return 82.0
    if m.coverage_days < 40:
        return 90.0
    if m.coverage_days > 250:
        return 99.0
    return 95.0
