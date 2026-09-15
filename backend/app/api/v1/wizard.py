from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.cache import cached, scope_key
from ...db.session import get_session
from ...repositories.inventory_repo import InventoryRepo
from ...schemas.optimization import WizardMatrix, WizardNarrative
from ...services.wizard_narrative import narrate
from ...services.wizard_service import build_matrix

router = APIRouter(prefix="/savings-matrix", tags=["wizard"])


async def _matrix(plant_id, session):
    async def compute():
        repo = InventoryRepo(session)
        materials = await repo.materials_for_kpis(plant_ids=plant_id)
        smap = await repo.series_for_plants(plant_id)
        pairs = [(m, smap.get(m.id, [])) for m in materials if m.id in smap]
        plants = await repo.list_plants()
        if plant_id:
            plants = [p for p in plants if p.id in plant_id]
        # offload the CPU-bound build off the event loop so cached callers stay responsive
        return await asyncio.to_thread(build_matrix, pairs, plants)

    return await cached(("matrix", scope_key(plant_id)), compute, ttl=600)


@router.get("", response_model=WizardMatrix)
async def savings_matrix(
    plant_id: list[str] | None = Query(None),
    session: AsyncSession = Depends(get_session),
):
    """FSN × criticality opportunity matrix + comprehensive KPI band + insights."""
    return await _matrix(plant_id, session)


@router.get("/narrative", response_model=WizardNarrative)
async def savings_narrative(
    plant_id: list[str] | None = Query(None),
    session: AsyncSession = Depends(get_session),
):
    """LLM-written analyst narration for the matrix — the story + per-cell one-liners."""
    matrix = await _matrix(plant_id, session)
    return await cached(("matrix-narrative", scope_key(plant_id)), lambda: narrate(matrix), ttl=600)
