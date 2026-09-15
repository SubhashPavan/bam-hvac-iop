"""Schemas for the optimization layer: opportunities + classification."""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class OppItem(BaseModel):
    id: str
    type: str
    material_id: Optional[str]
    material_desc: str
    plant_id: str
    plant_ids: Optional[list[str]] = None
    category: str
    current_value: float
    recommended_value: float
    savings_potential: float
    cash_release: float
    risk: str
    rationale: str
    action_seed: dict  # camelCase ActionSeed for the workflow


class OppGroup(BaseModel):
    type: str
    label: str
    count: int
    total_savings: float
    total_cash_release: float
    items: list[OppItem]


class OpportunitiesResponse(BaseModel):
    groups: list[OppGroup]
    total_savings: float
    total_cash_release: float
    opportunity_count: int


# ── classification ───────────────────────────────────────────────────
class ClassBucket(BaseModel):
    key: str
    count: int
    value: float
    share: float  # share of total value, 0–1


class MatrixCell(BaseModel):
    row: str
    col: str
    count: int
    value: float


class Scorecard(BaseModel):
    service_level: float
    inventory_turns: float
    days_outstanding: float
    policy_compliance: float      # % of SKUs within the optimal stock band
    forecast_accuracy: int
    obsolescence_rate: float      # obsolete value / total value


class WizardCell(BaseModel):
    fsn: str
    tier: str
    tier_label: str
    sku_count: int
    opp_count: int
    stock_value: float
    savings: float
    action: str
    label: str
    narration: str


class WizardMatrix(BaseModel):
    kpis: dict
    cells: list[WizardCell]
    insights: list[str]
    tier: dict[str, str]


class WizardNarrative(BaseModel):
    story: list[str]
    cells: dict[str, str]


class Classification(BaseModel):
    total_value: float
    material_count: int
    abc: list[ClassBucket]
    xyz: list[ClassBucket]
    fsn: list[ClassBucket]
    ved: list[ClassBucket]
    abc_xyz: list[MatrixCell]
    ved_fsn: list[MatrixCell]
    scorecard: Scorecard
