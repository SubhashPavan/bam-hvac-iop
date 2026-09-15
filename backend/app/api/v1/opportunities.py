from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.cache import cached, scope_key
from ...db.session import get_session
from ...repositories.inventory_repo import InventoryRepo
from ...schemas.optimization import OpportunitiesResponse
from ...services.opportunity_service import build_opportunities

router = APIRouter(prefix="/opportunities", tags=["opportunities"])


@router.get("", response_model=OpportunitiesResponse)
async def list_opportunities(
    plant_id: list[str] | None = Query(None),
    min_value: float = Query(8000, ge=0),
    service_level: float = Query(0.95, gt=0.5, lt=0.9999),
    session: AsyncSession = Depends(get_session),
):
    """Detect + group the six optimization opportunities across a plant selection.

    Each item carries an `action_seed` ready to POST to `/requests`.
    """
    async def compute():
        repo = InventoryRepo(session)
        materials = await repo.materials_for_kpis(plant_ids=plant_id)
        smap = await repo.series_for_plants(plant_id)
        pairs = [(m, smap.get(m.id, [])) for m in materials if m.id in smap]
        return await asyncio.to_thread(
            lambda: build_opportunities(pairs, min_value=min_value, service_level=service_level))

    return await cached(("opportunities", scope_key(plant_id), min_value, service_level), compute, ttl=600)
