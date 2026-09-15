from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.session import get_session
from ...repositories.inventory_repo import InventoryRepo
from ...schemas.optimization import Classification
from ...services.classification_service import classify_portfolio

router = APIRouter(prefix="/classification", tags=["classification"])


@router.get("", response_model=Classification)
async def get_classification(
    plant_id: list[str] | None = Query(None),
    session: AsyncSession = Depends(get_session),
):
    """ABC / XYZ / FSN / VED buckets + matrices + performance scorecard."""
    repo = InventoryRepo(session)
    materials = await repo.materials_for_kpis(plant_ids=plant_id)
    plants = await repo.list_plants()
    if plant_id:
        plants = [p for p in plants if p.id in plant_id]
    return classify_portfolio(materials, plants=plants)
