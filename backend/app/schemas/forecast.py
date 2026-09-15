"""Forecast API schemas. `points` matches the frontend ForecastPoint
(label/actual/forecast/lower/upper) plus an absolute `month`."""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class ForecastPoint(BaseModel):
    month: str
    label: str
    actual: Optional[float]
    forecast: float
    lower: float
    upper: float


class Accuracy(BaseModel):
    model_accuracy: int          # 0–100 for the UI
    mae: Optional[float]
    bias: Optional[float]
    mase: Optional[float]


class Planning(BaseModel):
    lead_time_days: int
    service_level: float
    z: float
    sigma_period: float
    demand_over_lead: float
    safety_stock: float
    reorder_point: float
    reorder_qty: float
    recommended_coverage_days: Optional[float]
    safety_stock_value: float


class Driver(BaseModel):
    factor: str
    label: str
    detail: str
    severity: str


class ForecastResult(BaseModel):
    material_id: str
    plant_id: str
    method: str
    demand_pattern: str
    adi: Optional[float]
    cv2: Optional[float]
    horizon_m: int
    history_m: int
    per_period_demand: float
    total_forecast_qty: float
    trend_pct: int
    accuracy: Accuracy
    forecast_confidence: int
    points: list[ForecastPoint]
    planning: Planning
    insight: str
    root_cause_state: str = "healthy"
    drivers: list[Driver] = []


class ForecastSummary(BaseModel):
    material_id: str
    description: str
    plant_id: str
    category: str
    ved: str
    fsn: str
    xyz: str
    demand_pattern: str
    method: str
    per_period_demand: float
    model_accuracy: int
    trend_pct: int
    understocked: bool
    coverage_days: int
    on_hand_qty: float
    stock_value: float
    unit_cost: float
    safety_stock: float
    reorder_point: float
    reorder_qty: float
    target_units: float
    recommended_coverage_days: Optional[float]
    lead_time_days: int
    service_level: float
    savings: float


class MaterialInsight(BaseModel):
    insight: str
    actions: list[str] = []


class ForecastSummaryPage(BaseModel):
    items: list[ForecastSummary]
    total: int
    page: int
    page_size: int


class AggregatePoint(BaseModel):
    month: str
    label: str
    actual: Optional[float]
    forecast: float
    lower: float
    upper: float


class DemandOutlook(BaseModel):
    total_forecast_qty: float
    model_accuracy: int
    growth_count: int
    decline_count: int
    material_count: int
    xyz_mix: dict[str, int]
    pattern_mix: dict[str, int]
    points: list[AggregatePoint]


class Mover(BaseModel):
    material_id: str
    description: str
    plant_id: str
    per_period_demand: float
    trend_pct: int
    direction: str
