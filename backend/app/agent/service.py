"""Sage orchestrator — prefer the Claude tool-calling path, fall back to the
deterministic rule router so the endpoint always answers."""
from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from ..core.config import settings
from . import tools
from .llm import run_llm
from .nlu import route

_SUGGEST = {
    "get_kpis": ["Where's my working capital trapped?", "Show obsolete stock", "Classify the portfolio"],
    "savings_matrix": ["What should I tackle first?", "Show the obsolete pocket", "Forecast the biggest excess SKU"],
    "find_opportunities": ["Simulate a supplier delay", "Show the excess items", "Create an action for the top item"],
    "forecast_material": ["Simulate +30% demand", "Find similar excess", "What's the reorder point?"],
    "demand_outlook": ["Which items are growing fastest?", "Show the service/investment tradeoff"],
    "classify": ["Where is the obsolescence?", "Show excess inventory", "What are the KPIs?"],
    "run_simulation": ["Show the tradeoff curve", "What's the safest 98% target cost?", "Save this scenario"],
    "tradeoff": ["Simulate a demand surge", "Show current KPIs"],
    "search_materials": ["Forecast the top item", "Find excess in this list"],
    "action": ["Show remaining opportunities", "What's the workflow status?"],
    "create_action": ["Show remaining opportunities"],
}


def _merge_scope(args: dict, context: dict | None) -> dict:
    if context and context.get("plant_ids") and "plant_ids" in args and not args.get("plant_ids"):
        args["plant_ids"] = context["plant_ids"]
    return args


async def answer(session: AsyncSession, query: str, context: dict | None = None) -> dict:
    # 1) LLM tool-calling (best-effort)
    if settings.llm_enabled:
        try:
            r = await run_llm(session, query, context)
            if r and r.get("answer"):
                tu = r.get("tools_used") or []
                r["suggestions"] = _SUGGEST.get(tu[-1] if tu else "", _SUGGEST["get_kpis"])
                return r
        except Exception as e:  # noqa: BLE001 — degrade to rules
            print(f"[sage] LLM path failed, using rules: {e}")

    # 2) deterministic rule router
    plan = route(query)
    args = _merge_scope(dict(plan["args"]), context)
    fn = getattr(tools, plan["tool"])
    out = await fn(session, **args)
    answer_text = out["summary"] + (f" {plan['note']}" if plan.get("note") else "")
    blocks = [out["block"]] if out.get("block") else []
    return {"answer": answer_text, "blocks": blocks, "tools_used": [plan["tool"]],
            "engine": "rules", "suggestions": _SUGGEST.get(plan["tool"], _SUGGEST["get_kpis"])}
