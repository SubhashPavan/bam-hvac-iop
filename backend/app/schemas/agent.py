"""Sage agent schemas — the response carries an NL answer plus typed blocks the
UI renders (kpis / opportunities / forecast / scenario / classification / …),
mirroring the frontend sageEngine block contract."""
from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel


class AgentQuery(BaseModel):
    query: str
    plant_ids: Optional[list[str]] = None


class Block(BaseModel):
    type: str
    data: Optional[Any] = None


class AgentResponse(BaseModel):
    answer: str
    blocks: list[Block]
    tools_used: list[str]
    engine: str  # "llm" or "rules"
    suggestions: list[str]


# ── Deep Insight (multi-step staged report) ──────────────────────────
class DeepQuery(BaseModel):
    query: str = ""
    plant_ids: Optional[list[str]] = None
    preset: Optional[str] = None  # "full_review" for the fixed 6-dimension review


class DeepPlanStep(BaseModel):
    id: str
    title: str
    tool: str


class DeepSection(BaseModel):
    id: str
    title: str
    tool: str
    finding: str
    block: Optional[Block] = None


class DeepAction(BaseModel):
    title: str
    detail: str = ""


class DeepInsight(BaseModel):
    title: str
    objective: str
    narrative: str
    plan: list[DeepPlanStep]
    sections: list[DeepSection]
    actions: list[DeepAction]
    engine: str
    generated_at: str
