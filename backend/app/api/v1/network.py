from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.cache import cached, scope_key
from ...db.session import get_session
from ...repositories.inventory_repo import InventoryRepo
from ...services.network_service import build_pooling
from ...services.vendor_service import build_vendors

router = APIRouter(tags=["network"])


async def _pairs_and_plants(plant_id, session):
    repo = InventoryRepo(session)
    materials = await repo.materials_for_kpis(plant_ids=plant_id)
    smap = await repo.series_for_plants(plant_id)
    pairs = [(m, smap.get(m.id, [])) for m in materials if m.id in smap]
    plants = await repo.list_plants()
    if plant_id:
        plants = [p for p in plants if p.id in plant_id]
    return pairs, plants


@router.get("/network/pooling")
async def network_pooling(
    plant_id: list[str] | None = Query(None),
    session: AsyncSession = Depends(get_session),
):
    """Multi-site stock pooling — cover shortages from network surplus instead of buying."""
    async def compute():
        pairs, plants = await _pairs_and_plants(plant_id, session)
        return await asyncio.to_thread(build_pooling, pairs, plants)
    return await cached(("pooling", scope_key(plant_id)), compute, ttl=600)


@router.get("/vendors")
async def vendors(
    plant_id: list[str] | None = Query(None),
    session: AsyncSession = Depends(get_session),
):
    """Supplier & lead-time analytics — how much stock each vendor's lead time drives."""
    async def compute():
        pairs, plants = await _pairs_and_plants(plant_id, session)
        return await asyncio.to_thread(build_vendors, pairs, plants)
    return await cached(("vendors", scope_key(plant_id)), compute, ttl=600)
