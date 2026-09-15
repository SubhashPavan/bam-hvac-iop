"""Pydantic schemas — mirror the frontend `types/inventory.ts` (snake_case) so
the UI consumes the API with no shape changes."""
from __future__ import annotations

from pydantic import BaseModel


class Plant(BaseModel):
    id: str
    name: str
    region: str
    country: str
    material_count: int
    inventory_value: float
    service_level: float

    model_config = {"from_attributes": True}


class Material(BaseModel):
    id: str
    description: str
    category: str
    supplier: str
    plant_id: str
    region: str
    country: str
    xyz: str
    fsn: str
    ved: str
    criticality_score: int
    coverage_days: int
    on_hand_qty: int
    unit_cost: float
    current_stock_value: float
    avg_monthly_demand: float

    model_config = {"from_attributes": True}


class Recommendation(BaseModel):
    id: str
    material_id: str
    material_desc: str
    category: str
    plant_id: str
    region: str
    country: str
    type: str
    confidence: int
    current_stock_value: float
    recommended_value: float
    savings_potential: float
    cash_release: float
    risk: str
    ai_reasoning: str
    coverage_days: int
    fsn: str
    ved: str
    criticality_score: int
    workflow_status: str

    model_config = {"from_attributes": True}


class MaterialPage(BaseModel):
    items: list[Material]
    total: int
    page: int
    page_size: int


class Kpis(BaseModel):
    """The 8 overview tiles."""
    total_inventory_value: float
    savings_potential: float
    service_level: float
    working_capital_released: float
    inventory_turns_yoy: float
    days_inventory_outstanding: float
    obsolete_stock_value: float
    stockouts: int
