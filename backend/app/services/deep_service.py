"""Deep Insight — the multi-step 'staged report' for inventory Sage.

Quick mode = one tool-calling loop (agent.service.answer). Deep mode = this:
plan the analysis into named dimensions, run each via the existing tools, then
consolidate into an executive report (narrative + per-section findings +
prioritized actions). Deterministic fallbacks so it never hard-fails.
"""
from __future__ import annotations

import inspect
import json
import re
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from ..core.config import settings
from ..agent import tools

# The "Full inventory review" preset — the fixed 6 dimensions.
FULL_REVIEW = [
    {"id": "health", "title": "Portfolio health", "tool": "get_kpis"},
    {"id": "trapped", "title": "Where capital is trapped", "tool": "savings_matrix"},
    {"id": "demand", "title": "Demand & forecast outlook", "tool": "demand_outlook"},
    {"id": "service", "title": "Service & investment trade-off", "tool": "tradeoff"},
    {"id": "suppliers", "title": "Supplier lead-time risk", "tool": "vendors"},
    {"id": "network", "title": "Network rebalancing", "tool": "network_pooling"},
]

# Portfolio-level tools the LLM may pick when planning a custom deep run.
PLAN_TOOLS = {
    "get_kpis": "Portfolio KPIs (inventory value, opportunity, service, turns).",
    "savings_matrix": "Where working capital is trapped (FSN x criticality matrix).",
    "find_opportunities": "Typed opportunity drill-down (excess/obsolete/transfer/duplicate/supplier).",
    "demand_outlook": "Aggregate demand outlook, growth vs decline.",
    "tradeoff": "Service level vs investment curve.",
    "run_simulation": "What-if scenario (demand surge / supplier delay / target service).",
    "vendors": "Supplier lead-time analytics (stock driven by lead time).",
    "network_pooling": "Cross-plant stock pooling (cover shortage from surplus).",
    "classify": "ABC/XYZ/FSN/VED classification + scorecard.",
}


def _extract_json(text: str) -> dict | None:
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError:
        return None


def _accepts(fn) -> set:
    try:
        return set(inspect.signature(fn).parameters)
    except (TypeError, ValueError):
        return set()


async def run_deep(session: AsyncSession, *, query: str, plant_ids=None, preset: str | None = None) -> dict:
    use_preset = preset == "full_review" or not (query or "").strip()
    plan = FULL_REVIEW if use_preset else await _plan(query)

    sections = []
    for dim in plan:
        fn = getattr(tools, dim.get("tool", ""), None)
        if not fn:
            continue
        args = dict(dim.get("args") or {})
        if plant_ids and "plant_ids" in _accepts(fn) and not args.get("plant_ids"):
            args["plant_ids"] = plant_ids
        try:
            out = await fn(session, **args)
        except Exception as e:  # noqa: BLE001
            out = {"summary": f"(unavailable: {e})", "block": None}
        sections.append({"id": dim.get("id") or dim["tool"], "title": dim["title"],
                         "tool": dim["tool"], "summary": out.get("summary", ""),
                         "block": out.get("block")})

    objective = (query or "").strip() or "Full inventory review"
    report = await _consolidate(objective, sections)
    return {
        "title": report["title"],
        "objective": objective,
        "narrative": report["narrative"],
        "plan": [{"id": s["id"], "title": s["title"], "tool": s["tool"]} for s in sections],
        "sections": [{"id": s["id"], "title": s["title"], "tool": s["tool"],
                      "finding": report["findings"].get(s["id"]) or s["summary"],
                      "block": s["block"]} for s in sections],
        "actions": report["actions"],
        "engine": report["engine"],
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


async def _plan(query: str) -> list[dict]:
    """LLM picks the dimensions for a custom deep run; falls back to the full review."""
    if not settings.llm_enabled:
        return FULL_REVIEW
    try:
        from ..agent.llm import _client
        client = _client()
        catalog = "\n".join(f"- {k}: {v}" for k, v in PLAN_TOOLS.items())
        prompt = (
            f"You are planning a deep inventory analysis for: \"{query}\".\n\n"
            f"Available analysis tools:\n{catalog}\n\n"
            "Pick 3-6 that best answer the question, ordered logically. Return ONLY JSON: "
            "{\"dimensions\": [{\"id\": \"short_slug\", \"title\": \"<=5-word section title\", "
            "\"tool\": \"<one tool name>\"}]}."
        )
        resp = await client.messages.create(
            model=settings.anthropic_agent_model, max_tokens=500,
            messages=[{"role": "user", "content": prompt}],
        )
        text = "".join(b.text for b in resp.content if b.type == "text")
        data = _extract_json(text)
        dims = (data or {}).get("dimensions") or []
        dims = [d for d in dims if d.get("tool") in PLAN_TOOLS][:6]
        return dims or FULL_REVIEW
    except Exception as e:  # noqa: BLE001
        print(f"[deep] plan failed: {e}")
        return FULL_REVIEW


CONSOLIDATE_SYS = (
    "You are an inventory-optimization analyst writing a concise executive brief from a set of "
    "computed analysis sections. Use ONLY the figures given — never invent numbers. Direct, "
    "professional business English; no filler or drama."
)


async def _consolidate(objective: str, sections: list[dict]) -> dict:
    fallback = {
        "title": objective if objective != "Full inventory review" else "Inventory health review",
        "narrative": " ".join(s["summary"] for s in sections[:3] if s["summary"]),
        "findings": {s["id"]: s["summary"] for s in sections},
        "actions": [], "engine": "rules",
    }
    if not settings.llm_enabled or not sections:
        return fallback
    try:
        from ..agent.llm import _client
        client = _client()
        blocks = "\n".join(f"[{s['id']}] {s['title']}: {s['summary']}" for s in sections)
        prompt = (
            f"Objective: {objective}\n\nComputed sections:\n{blocks}\n\n"
            "Write the brief. Return ONLY JSON: {\"title\": \"<=6-word report title\", "
            "\"narrative\": \"2-4 sentence executive summary that prioritizes by value and risk\", "
            "\"findings\": {\"<section id>\": \"one direct sentence (<=22 words) reading that section\"}, "
            "\"actions\": [{\"title\": \"<=8-word action\", \"detail\": \"one sentence with the figure and why\"}]}. "
            "Give a finding for every section id; 3-5 prioritized actions."
        )
        resp = await client.messages.create(
            model=settings.anthropic_agent_model, max_tokens=1400, system=CONSOLIDATE_SYS,
            messages=[{"role": "user", "content": prompt}],
        )
        text = "".join(b.text for b in resp.content if b.type == "text")
        data = _extract_json(text)
        if not data or not data.get("narrative"):
            return fallback
        return {
            "title": data.get("title") or fallback["title"],
            "narrative": data["narrative"],
            "findings": data.get("findings") or fallback["findings"],
            "actions": data.get("actions") or [],
            "engine": "llm",
        }
    except Exception as e:  # noqa: BLE001
        print(f"[deep] consolidate failed: {e}")
        return fallback
