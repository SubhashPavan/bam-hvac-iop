"""Workflow schemas — camelCase to match the frontend `requestStore.ts`
ActionRequest / ActionSeed / HistoryEntry contract exactly."""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel


class SimSnapshot(BaseModel):
    scenario: str
    service: float
    investment: float
    stockoutRisk: float
    savedAt: str


class HistoryEntry(BaseModel):
    stage: str
    actor: str
    decision: Literal["created", "approved", "rejected", "commented", "sent_back"]
    comment: Optional[str] = None
    at: str


class ActionSeed(BaseModel):
    materialId: str
    materialDesc: str
    plantId: str
    kind: str
    currentValue: float
    proposedValue: float
    savings: float
    cashRelease: float
    justification: str
    snapshot: Optional[SimSnapshot] = None


class ActionRequestOut(BaseModel):
    id: str
    materialId: str
    materialDesc: str
    plantId: str
    kind: str
    currentValue: float
    proposedValue: float
    savings: float
    cashRelease: float
    justification: str
    note: str
    priority: str
    routing: str
    createdAt: str
    stage: str
    history: list[HistoryEntry]
    snapshot: Optional[SimSnapshot] = None


class CreateRequest(BaseModel):
    seed: ActionSeed
    note: str = ""
    priority: str = "medium"
    routing: str = "save_execute"


class Decision(BaseModel):
    decision: Literal["approved", "rejected"]
    actor: str
    comment: Optional[str] = None


class SendBack(BaseModel):
    actor: str
    comment: Optional[str] = None
