"""LLM-generated narration for the Savings Wizard — Claude reads the computed
FSN × criticality matrix and writes a prioritized analyst's take (the story) plus
a punchy one-liner per notable cell. Deterministic ML does the numbers; the LLM
does the judgment. Falls back to the static narration if the LLM is unavailable.
"""
from __future__ import annotations

import json
import re

from ..core.config import settings

SYSTEM = (
    "You are an inventory-optimization analyst writing for a plant engineer on MRO spare parts. "
    "You are given a Fast/Slow/Non-moving x maintenance-criticality opportunity matrix with real "
    "numbers. Write direct, professional, factual notes: state the opportunity and the recommended "
    "action using the figures given. Plain business English — no metaphors, no dramatic, salesy or "
    "promotional language, no exclamations, no filler adjectives. Never invent numbers. Be concise."
)


def _fallback(matrix: dict) -> dict:
    return {"story": matrix.get("insights", []),
            "cells": {f"{c['fsn']}|{c['tier']}": c.get("narration", "") for c in matrix.get("cells", [])}}


def _extract_json(text: str) -> dict | None:
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError:
        return None


MATERIAL_SYS = (
    "You are an inventory-optimization analyst advising a plant engineer on one MRO spare part. "
    "Give a direct, professional recommendation using the figures provided. Plain business English, "
    "no drama or filler. Never invent numbers."
)


async def narrate_material(material, detail: dict) -> dict:
    """Agentic per-SKU recommendation from Claude. Falls back to the templated insight."""
    fallback = {"insight": detail.get("insight", ""), "actions": []}
    if not settings.llm_enabled:
        return fallback
    try:
        from ..agent.llm import _client
        client = _client()
        p = detail["planning"]
        ctx = (
            f"SKU {material.id} ({material.description}) at {material.plant_id}; {material.fsn}-moving, "
            f"{material.ved}, criticality {material.criticality_score}. Demand: {detail['demand_pattern']} "
            f"via {detail['method']}, ~{detail['per_period_demand']}/mo, trend {detail['trend_pct']}%, "
            f"forecast accuracy {detail['accuracy']['model_accuracy']}%. On-hand {material.on_hand_qty} units "
            f"(${material.current_stock_value:,.0f}), coverage {material.coverage_days}d. Optimal policy at "
            f"{p['service_level'] * 100:.0f}% service: safety stock {p['safety_stock']:.0f}, reorder point "
            f"{p['reorder_point']:.0f}, reorder qty {p['reorder_qty']:.0f}, recommended coverage "
            f"{p['recommended_coverage_days']}d, lead time {p['lead_time_days']}d.\n\n"
            "Return ONLY JSON: {\"insight\": \"2 direct professional sentences: what to do with this SKU and "
            "why, using the figures\", \"actions\": [\"<=8-word next step\", ... up to 3]}."
        )
        resp = await client.messages.create(
            model=settings.anthropic_agent_model, max_tokens=450, system=MATERIAL_SYS,
            messages=[{"role": "user", "content": ctx}],
        )
        text = "".join(b.text for b in resp.content if b.type == "text")
        data = _extract_json(text)
        if data and data.get("insight"):
            return {"insight": data["insight"], "actions": data.get("actions", [])}
    except Exception as e:  # noqa: BLE001
        print(f"[material insight] {e}")
    return fallback


async def narrate(matrix: dict) -> dict:
    if not settings.llm_enabled or not matrix.get("cells"):
        return _fallback(matrix)
    try:
        from ..agent.llm import _client
        client = _client()
        k = matrix["kpis"]
        rows = [f"- {c['fsn']} / {c['tier_label']} (key {c['fsn']}|{c['tier']}): "
                f"{c['opp_count']} of {c['sku_count']} SKUs actionable, ${c['savings']:,.0f} savings, play={c['action']}"
                for c in matrix["cells"] if c["sku_count"]]
        summary = (
            f"Portfolio: ${k['total_inventory']:,.0f} inventory across {k['sku_count']} SKUs; "
            f"${k['total_opportunity']:,.0f} total opportunity (${k['surplus_stock']:,.0f} surplus, "
            f"${k['obsolete_stock']:,.0f} obsolete); {k['at_risk_skus']} SKUs below reorder; "
            f"service {k['service_level']}%, turns {k['inventory_turns']}x.\n\nMatrix cells:\n" + "\n".join(rows)
        )
        instruction = (
            "\n\nReturn ONLY JSON: {\"story\": [2-3 direct sentences that prioritize the actions by "
            "value and criticality — each states what to do and the figure], \"cells\": {\"<key>\": "
            "\"one direct sentence (<=15 words): the recommended action for these SKUs and the reason\"}}. "
            "Neutral, professional tone, no flourish. Provide a line for every key listed."
        )
        resp = await client.messages.create(
            model=settings.anthropic_agent_model, max_tokens=1400, system=SYSTEM,
            messages=[{"role": "user", "content": summary + instruction}],
        )
        text = "".join(b.text for b in resp.content if b.type == "text")
        data = _extract_json(text)
        if not data or "cells" not in data:
            return _fallback(matrix)
        story = data.get("story") or matrix.get("insights", [])
        cells = data.get("cells") or {}
        # backfill any missing cell with the static narration
        for c in matrix["cells"]:
            key = f"{c['fsn']}|{c['tier']}"
            if c["sku_count"] and key not in cells:
                cells[key] = c.get("narration", "")
        return {"story": story, "cells": cells}
    except Exception as e:  # noqa: BLE001 — never break the wizard on LLM failure
        print(f"[wizard] narrative LLM failed: {e}")
        return _fallback(matrix)
