"""Simulation schemas. Snapshot matches the frontend SimSnapshot exactly
(scenario / service / investment / stockoutRisk / savedAt)."""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class Snapshot(BaseModel):
    scenario: str
    service: float
    investment: float
    stockoutRisk: float
    savedAt: str


class SimScenarioRequest(BaseModel):
    plant_id: Optional[list[str]] = None
    label: str = "What-if scenario"
    demand_multiplier: float = 1.0
    lead_multiplier: float = 1.0
    target_service_level: float = 0.95
    trials: int = 500


class SimResult(BaseModel):
    scenario: str
    demand_multiplier: float
    lead_multiplier: float
    target_service_level: float
    material_count: int
    trials: int
    baseline_investment: float
    scenario_investment: float
    working_capital_delta: float
    attained_service_level: float
    stockout_risk: float
    at_risk_count: int
    snapshot: Snapshot


class TradeoffPoint(BaseModel):
    service: float
    investment: float


class TradeoffResult(BaseModel):
    curve: list[TradeoffPoint]
    current_service: Optional[float]
    current_investment: float


class SaveSnapshot(BaseModel):
    snapshot: Snapshot
    plant_ids: Optional[list[str]] = None
    params: Optional[dict] = None


class SnapshotOut(Snapshot):
    id: str
