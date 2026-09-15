from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.session import get_session
from ...repositories.inventory_repo import InventoryRepo
from ...schemas.inventory import Material, MaterialPage

router = APIRouter(prefix="/materials", tags=["materials"])


@router.get("", response_model=MaterialPage)
async def list_materials(
    plant_id: list[str] | None = Query(None),
    search: str | None = None,
    ved: str | None = None,
    fsn: str | None = None,
    xyz: str | None = None,
    category: str | None = None,
    sort: str = "current_stock_value",
    desc: bool = True,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    session: AsyncSession = Depends(get_session),
):
    items, total = await InventoryRepo(session).list_materials(
        plant_ids=plant_id, search=search, ved=ved, fsn=fsn, xyz=xyz, category=category,
        sort=sort, desc=desc, page=page, page_size=page_size,
    )
    return MaterialPage(items=items, total=total, page=page, page_size=page_size)


@router.get("/{material_id}", response_model=Material)
async def get_material(material_id: str, session: AsyncSession = Depends(get_session)):
    material = await InventoryRepo(session).get_material(material_id)
    if not material:
        raise HTTPException(404, "Material not found")
    return material
