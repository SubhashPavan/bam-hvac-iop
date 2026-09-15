from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ...agent.service import answer
from ...core.config import settings
from ...db.session import get_session
from ...schemas.agent import AgentQuery, AgentResponse, DeepInsight, DeepQuery
from ...services.deep_service import run_deep

router = APIRouter(prefix="/agent", tags=["agent"])


@router.get("/status")
async def status():
    return {"llm_enabled": settings.llm_enabled, "model": settings.anthropic_agent_model,
            "fallback": "rule-based router"}


@router.post("/query", response_model=AgentResponse)
async def query(body: AgentQuery, session: AsyncSession = Depends(get_session)):
    """Ask Sage. Answers via Claude tool-calling when configured, else the rule router."""
    context = {"plant_ids": body.plant_ids} if body.plant_ids else None
    return await answer(session, body.query, context)


@router.post("/deep", response_model=DeepInsight)
async def deep(body: DeepQuery, session: AsyncSession = Depends(get_session)):
    """Deep Insight — multi-step staged report: plan → run each dimension → consolidate."""
    return await run_deep(session, query=body.query, plant_ids=body.plant_ids, preset=body.preset)
