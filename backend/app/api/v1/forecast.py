from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.cache import cached, scope_key
from ...db.session import get_session
from ...ml import service
from ...repositories.inventory_repo import InventoryRepo
from ...schemas.forecast import (
    DemandOutlook,
    ForecastResult,
    ForecastSummary,
    ForecastSummaryPage,
    MaterialInsight,
    Mover,
)
from ...services.wizard_narrative import narrate_material

router = APIRouter(prefix="/forecast", tags=["forecast"])


@router.get("", response_model=ForecastSummaryPage)
async def list_forecasts(
    plant_id: list[str] | None = Query(None),
    search: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
):
    """Per-material forecast summaries for the grid (pattern / method / accuracy / trend)."""
    async def compute():
        repo = InventoryRepo(session)
        materials, total = await repo.list_materials(
            plant_ids=plant_id, search=search, page=page, page_size=page_size,
        )
        smap = await repo.series_map([m.id for m in materials])
        items = await asyncio.to_thread(
            lambda: [service.forecast_summary(m, smap.get(m.id, [])) for m in materials]
        )
        return ForecastSummaryPage(items=items, total=total, page=page, page_size=page_size)

    return await cached(("forecast-list", scope_key(plant_id), search or "", page, page_size),
                        compute, ttl=600)


@router.get("/aggregate", response_model=DemandOutlook)
async def aggregate(
    plant_id: list[str] | None = Query(None),
    horizon: int = Query(12, ge=1, le=24),
    session: AsyncSession = Depends(get_session),
):
    """Aggregate demand outlook across a plant selection (dashboard forecasting tab)."""
    repo = InventoryRepo(session)
    materials = await repo.materials_for_kpis(plant_ids=plant_id)
    smap = await repo.series_for_plants(plant_id)
    pairs = [(m, smap.get(m.id, [])) for m in materials if m.id in smap]
    return service.aggregate_outlook(pairs, horizon=horizon)


@router.get("/movers", response_model=list[Mover])
async def movers(
    plant_id: list[str] | None = Query(None),
    limit: int = Query(10, ge=1, le=50),
    session: AsyncSession = Depends(get_session),
):
    """Biggest demand shifts (growth / decline) across the selection."""
    repo = InventoryRepo(session)
    materials = await repo.materials_for_kpis(plant_ids=plant_id)
    smap = await repo.series_for_plants(plant_id)
    pairs = [(m, smap[m.id]) for m in materials if m.id in smap]
    return service.movers(pairs, limit=limit)


@router.get("/policy")
async def stocking_policy(
    plant_id: list[str] | None = Query(None),
    session: AsyncSession = Depends(get_session),
):
    """Full inventory stocking policy per material: unit rate, ledger validation,
    FSN, CV band, service level, ABC, safety stock, ROL, ROQ, max/avg stock +
    values. Portfolio pass (ABC ranks the whole set)."""
    from ...ml.stocking_policy import compute_policy

    async def compute():
        repo = InventoryRepo(session)
        materials = await repo.materials_for_kpis(plant_ids=plant_id)
        smap = await repo.series_for_plants(plant_id)
        rmap = await repo.receipts_for_plants(plant_id)
        payload = [{
            "id": m.id, "description": m.description,
            "opening_stock": getattr(m, "opening_stock", None),
            "closing_stock": m.on_hand_qty, "closing_value": m.current_stock_value,
            "unit_cost": m.unit_cost, "consumption": smap.get(m.id, []),
            "receipts": rmap.get(m.id), "lead_days": getattr(m, "lead_time_days", None),
        } for m in materials]
        rows = await asyncio.to_thread(compute_policy, payload)
        return list(rows.values())

    return await cached(("policy", scope_key(plant_id)), compute, ttl=600)


@router.get("/{material_id}/insight", response_model=MaterialInsight)
async def material_insight(
    material_id: str,
    service_level: float = Query(0.95, gt=0.5, lt=0.9999),
    session: AsyncSession = Depends(get_session),
):
    """Agentic per-SKU recommendation from Claude (falls back to the templated insight)."""
    repo = InventoryRepo(session)
    material = await repo.get_material(material_id)
    if not material:
        raise HTTPException(404, "Material not found")
    ds = await repo.get_series(material_id)
    if not ds:
        raise HTTPException(404, "No demand history for material")
    detail = service.forecast_detail(material, ds.series, service_level=service_level)
    return await narrate_material(material, detail)


@router.get("/{material_id}", response_model=ForecastResult)
async def forecast_material(
    material_id: str,
    horizon: int = Query(6, ge=1, le=24),
    service_level: float = Query(0.95, gt=0.5, lt=0.9999),
    history_window: int = Query(12, ge=6, le=36),
    session: AsyncSession = Depends(get_session),
):
    """Full forecast for one material: history + horizon + accuracy + inventory policy."""
    repo = InventoryRepo(session)
    material = await repo.get_material(material_id)
    if not material:
        raise HTTPException(404, "Material not found")
    ds = await repo.get_series(material_id)
    if not ds:
        raise HTTPException(404, "No demand history for material")
    return service.forecast_detail(
        material, ds.series, horizon=horizon, service_level=service_level,
        history_window=history_window,
    )
