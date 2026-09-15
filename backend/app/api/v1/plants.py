from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.session import get_session
from ...repositories.inventory_repo import InventoryRepo
from ...schemas.inventory import Plant

router = APIRouter(prefix="/plants", tags=["plants"])


@router.get("", response_model=list[Plant])
async def list_plants(session: AsyncSession = Depends(get_session)):
    return await InventoryRepo(session).list_plants()


@router.get("/{plant_id}", response_model=Plant)
async def get_plant(plant_id: str, session: AsyncSession = Depends(get_session)):
    plant = await InventoryRepo(session).get_plant(plant_id)
    if not plant:
        raise HTTPException(404, "Plant not found")
    return plant
