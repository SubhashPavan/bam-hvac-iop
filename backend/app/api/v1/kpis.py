from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.cache import cached, scope_key
from ...db.session import get_session
from ...repositories.inventory_repo import InventoryRepo
from ...schemas.inventory import Kpis
from ...services.kpi_service import compute_kpis

router = APIRouter(prefix="/kpis", tags=["kpis"])


@router.get("", response_model=Kpis)
async def get_kpis(
    plant_id: list[str] | None = Query(None),
    session: AsyncSession = Depends(get_session),
):
    async def compute():
        repo = InventoryRepo(session)
        materials = await repo.materials_for_kpis(plant_ids=plant_id)
        smap = await repo.series_for_plants(plant_id)
        pairs = [(m, smap.get(m.id, [])) for m in materials if m.id in smap]
        plants = await repo.list_plants()
        if plant_id:
            plants = [p for p in plants if p.id in plant_id]
        # Derived from the Savings Wizard matrix so the overview tiles reconcile with it.
        return await asyncio.to_thread(compute_kpis, pairs, plants)

    return await cached(("kpis", scope_key(plant_id)), compute, ttl=600)
