from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.session import get_session
from ...repositories.inventory_repo import InventoryRepo
from ...schemas.inventory import Recommendation

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


class RecommendationPage(BaseModel):
    items: list[Recommendation]
    total: int
    page: int
    page_size: int


@router.get("", response_model=RecommendationPage)
async def list_recommendations(
    plant_id: list[str] | None = Query(None),
    search: str | None = None,
    type: str | None = None,
    risk: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    session: AsyncSession = Depends(get_session),
):
    items, total = await InventoryRepo(session).list_recommendations(
        plant_ids=plant_id, search=search, type_=type, risk=risk, page=page, page_size=page_size,
    )
    return RecommendationPage(items=items, total=total, page=page, page_size=page_size)
