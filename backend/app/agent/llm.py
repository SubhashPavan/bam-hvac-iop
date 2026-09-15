"""Claude (via Azure AI Foundry) tool-calling loop for Sage.

Runs an agentic loop: the model plans, calls our tools, sees the results, and
composes a final answer. Every tool it calls also yields a typed UI block.
Best-effort — any failure lets the orchestrator fall back to the rule router.
"""
from __future__ import annotations

from ..core.config import settings
from ..repositories.inventory_repo import InventoryRepo
from . import tools

SYSTEM_BASE = (
    "You are Sage, the analyst inside an MRO spare-parts optimization platform. The plant "
    "engineer works a fixed flow: the Savings Wizard (an FSN x maintenance-criticality matrix "
    "showing where working capital is trapped) -> the Material Master grid -> a SKU 360 that "
    "classifies demand, forecasts it (Croston/SBA/TSB/SES), derives the policy (safety stock, "
    "reorder point ROP, reorder qty ROQ) and simulates service level -> a recommended action "
    "(reduce / reorder / rebalance-transfer / dispose) that routes into the approval workflow. "
    "Speak that language. Answer with specific numbers from the tools — never invent figures; be "
    "concise (2-4 sentences). Tool choice: for any overview / 'where is my money trapped' / 'biggest "
    "opportunity' / 'what should I tackle first' question, call savings_matrix (the Wizard's view) — do "
    "NOT use find_opportunities for these; find_opportunities is only for drilling into one specific "
    "opportunity type (excess, obsolete, transfer, duplicate, supplier). Use "
    "forecast_material for a single SKU's policy, run_simulation/tradeoff for what-ifs. Plant scope "
    "comes from the user; if none is named, operate across all plants. Only call create_action when "
    "the user explicitly asks to create/submit/raise an action — otherwise state the recommendation "
    "and let them decide."
)


def _plant_index(plants):
    name_to_id: dict[str, str] = {}
    region_to_ids: dict[str, list[str]] = {}
    for p in plants:
        name_to_id[p.id.lower()] = p.id
        name_to_id[p.name.lower()] = p.id
        region_to_ids.setdefault(p.region.lower(), []).append(p.id)
    return name_to_id, region_to_ids


def _resolve(values, name_to_id, region_to_ids):
    if not values:
        return None
    out: list[str] = []
    for v in values:
        vl = str(v).strip().lower()
        if vl in name_to_id:
            out.append(name_to_id[vl])
        elif vl in region_to_ids:
            out.extend(region_to_ids[vl])
        else:
            partial = [i for n, i in name_to_id.items() if vl and vl in n]
            out.extend(partial or [str(v)])
    return sorted(set(out)) or None

TOOL_SCHEMAS = [
    {"name": "get_kpis", "description": "Overview KPIs: inventory value, savings potential, service level, turns, DIO, obsolete value, stockouts.",
     "input_schema": {"type": "object", "properties": {"plant_ids": {"type": "array", "items": {"type": "string"}}}}},
    {"name": "savings_matrix", "description": "The Savings Wizard's FSN x maintenance-criticality matrix — where working capital is trapped, by fast/slow/non-moving and criticality tier, with per-cell opportunity counts and savings. Use for 'where is my money / biggest opportunity / what should I tackle first' questions.",
     "input_schema": {"type": "object", "properties": {"plant_ids": {"type": "array", "items": {"type": "string"}}}}},
    {"name": "find_opportunities", "description": "Opportunity detail grouped into excess_inventory, obsolete_stock, safety_stock_overstock, stock_transfer, duplicate_materials, supplier_consolidation. Optionally filter by one type. (savings_matrix is the higher-level view.)",
     "input_schema": {"type": "object", "properties": {"plant_ids": {"type": "array", "items": {"type": "string"}},
         "type": {"type": "string", "enum": ["excess_inventory", "obsolete_stock", "safety_stock_overstock", "stock_transfer", "duplicate_materials", "supplier_consolidation"]}}}},
    {"name": "forecast_material", "description": "Forecast one material by its 9-digit code: demand pattern, method (Croston/SBA/TSB/SES), rate, accuracy, reorder point, safety stock.",
     "input_schema": {"type": "object", "properties": {"material_id": {"type": "string"}}, "required": ["material_id"]}},
    {"name": "demand_outlook", "description": "Aggregate demand outlook across a plant selection: total forecast qty, growth/decline counts, accuracy.",
     "input_schema": {"type": "object", "properties": {"plant_ids": {"type": "array", "items": {"type": "string"}}}}},
    {"name": "classify", "description": "ABC/XYZ/FSN/VED classification + scorecard (turns, DIO, policy compliance, obsolescence).",
     "input_schema": {"type": "object", "properties": {"plant_ids": {"type": "array", "items": {"type": "string"}}}}},
    {"name": "run_simulation", "description": "Monte Carlo what-if. demand_multiplier>1 = surge, lead_multiplier>1 = supplier delay, target_service_level in 0.8-0.99.",
     "input_schema": {"type": "object", "properties": {"plant_ids": {"type": "array", "items": {"type": "string"}},
         "demand_multiplier": {"type": "number"}, "lead_multiplier": {"type": "number"}, "target_service_level": {"type": "number"}}}},
    {"name": "tradeoff", "description": "Service-level vs investment curve for a plant selection.",
     "input_schema": {"type": "object", "properties": {"plant_ids": {"type": "array", "items": {"type": "string"}}}}},
    {"name": "search_materials", "description": "Search/list materials by text, plant, VED or FSN.",
     "input_schema": {"type": "object", "properties": {"query": {"type": "string"}, "plant_ids": {"type": "array", "items": {"type": "string"}},
         "ved": {"type": "string"}, "fsn": {"type": "string"}}}},
    {"name": "create_action", "description": "Raise a workflow request for a material (side-effectful). Only when the user explicitly asks to create/submit an action. kind is auto-derived if omitted: reduce_stock, dispose, increase_stock, or transfer (rebalance excess to a plant short on the same part).",
     "input_schema": {"type": "object", "properties": {"material_id": {"type": "string"}, "kind": {"type": "string", "enum": ["reduce_stock", "dispose", "increase_stock", "transfer"]}, "note": {"type": "string"}}, "required": ["material_id"]}},
]


def _client():
    from anthropic import AsyncAnthropic
    return AsyncAnthropic(api_key=settings.anthropic_foundry_key,
                          base_url=settings.anthropic_foundry_url or None)


async def run_llm(session, query: str, context: dict | None = None) -> dict | None:
    if not settings.llm_enabled:
        return None
    client = _client()

    # Build the plant roster from the CURRENT data (demo seed or ingested).
    plants = await InventoryRepo(session).list_plants()
    name_to_id, region_to_ids = _plant_index(plants)
    roster = ", ".join(f"{p.id} ({p.name}, {p.region})" for p in plants[:80])
    system = SYSTEM_BASE + "\n\nPlant roster (pass the ID in plant_ids; names/regions also work): " + roster

    ctx = ""
    if context and context.get("plant_ids"):
        ctx = f"\n\n(Current plant scope: {', '.join(context['plant_ids'])})"
    messages = [{"role": "user", "content": query + ctx}]
    blocks: list[dict] = []
    tools_used: list[str] = []

    for _ in range(5):
        resp = await client.messages.create(
            model=settings.anthropic_agent_model, max_tokens=1024,
            system=system, tools=TOOL_SCHEMAS, messages=messages,
        )
        if resp.stop_reason != "tool_use":
            text = "".join(b.text for b in resp.content if b.type == "text").strip()
            return {"answer": text, "blocks": blocks, "tools_used": tools_used, "engine": "llm"}

        messages.append({"role": "assistant", "content": resp.content})
        tool_results = []
        for block in resp.content:
            if block.type != "tool_use":
                continue
            name = block.name
            args = dict(block.input or {})
            # Guardrail: the Savings Wizard matrix owns the excess/obsolete/safety-stock story,
            # so chat numbers match the UI. find_opportunities stays only for the relational
            # opportunities the matrix does not show (duplicates, supplier, cross-plant transfer).
            if name == "find_opportunities" and args.get("type") not in (
                    "duplicate_materials", "supplier_consolidation", "stock_transfer"):
                name = "savings_matrix"
                args = {k: v for k, v in args.items() if k == "plant_ids"}
            fn = getattr(tools, name, None)
            if "plant_ids" in args:
                args["plant_ids"] = _resolve(args["plant_ids"], name_to_id, region_to_ids)
            if context and context.get("plant_ids") and "plant_ids" in _accepts(fn) \
                    and not args.get("plant_ids"):
                args["plant_ids"] = context["plant_ids"]
            try:
                out = await fn(session, **args)
            except Exception as e:  # noqa: BLE001 — surface as tool error, keep loop alive
                out = {"summary": f"tool error: {e}", "block": None}
            tools_used.append(name)
            if out.get("block"):
                blocks.append(out["block"])
            tool_results.append({"type": "tool_result", "tool_use_id": block.id,
                                 "content": out.get("summary", "")})
        messages.append({"role": "user", "content": tool_results})

    return {"answer": "I gathered the data above.", "blocks": blocks,
            "tools_used": tools_used, "engine": "llm"}


def _accepts(fn) -> set[str]:
    import inspect
    try:
        return set(inspect.signature(fn).parameters)
    except (TypeError, ValueError):
        return set()
