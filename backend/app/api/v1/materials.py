from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.cache import bump_version
from ...db.session import get_session
from ...repositories.inventory_repo import InventoryRepo
from ...schemas.inventory import Material, MaterialPage

router = APIRouter(prefix="/materials", tags=["materials"])

# VED → a criticality score (Vital is the "keep even if dead" insurance tier).
_VED_SCORE = {"Vital": 85, "Essential": 60, "Desirable": 30}


class CriticalityUpdate(BaseModel):
    ved: str | None = None                 # "Vital" | "Essential" | "Desirable"
    criticality_score: int | None = None   # 0-100; optional explicit override


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


@router.post("/{material_id}/criticality", response_model=Material)
async def set_criticality(material_id: str, body: CriticalityUpdate,
                          session: AsyncSession = Depends(get_session)):
    """Plant-manager override of a material's criticality (VED / score). Drives the
    retain-vs-dispose decision for non-moving items — a Vital spare is retained as
    insurance even with no demand. Recomputes the analysis (cache bumped)."""
    material = await InventoryRepo(session).get_material(material_id)
    if not material:
        raise HTTPException(404, "Material not found")
    if body.ved:
        if body.ved not in _VED_SCORE:
            raise HTTPException(422, "ved must be Vital, Essential or Desirable")
        material.ved = body.ved
        material.criticality_score = _VED_SCORE[body.ved]
    if body.criticality_score is not None:
        material.criticality_score = max(0, min(100, body.criticality_score))
    await session.commit()
    await session.refresh(material)
    bump_version()   # invalidate cached matrix / policy / opportunities
    return material
