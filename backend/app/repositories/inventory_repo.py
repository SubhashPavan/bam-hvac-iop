"""Data access for the analytical reads (plants / materials / recommendations).

Kept as a repository so the binding can later swap to a DatabricksGoldRepo with
the same interface without touching the API layer.
"""
from __future__ import annotations

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import DemandSeries, Material, Plant, Recommendation


class InventoryRepo:
    def __init__(self, session: AsyncSession):
        self.s = session

    async def list_plants(self) -> list[Plant]:
        rows = await self.s.scalars(select(Plant).order_by(Plant.region, Plant.name))
        return list(rows)

    async def get_plant(self, plant_id: str) -> Plant | None:
        return await self.s.get(Plant, plant_id)

    async def list_materials(
        self,
        *,
        plant_ids: list[str] | None = None,
        search: str | None = None,
        ved: str | None = None,
        fsn: str | None = None,
        xyz: str | None = None,
        category: str | None = None,
        page: int = 1,
        page_size: int = 50,
        sort: str = "current_stock_value",
        desc: bool = True,
    ) -> tuple[list[Material], int]:
        stmt = select(Material)
        if plant_ids:
            stmt = stmt.where(Material.plant_id.in_(plant_ids))
        if ved:
            stmt = stmt.where(Material.ved == ved)
        if fsn:
            stmt = stmt.where(Material.fsn == fsn)
        if xyz:
            stmt = stmt.where(Material.xyz == xyz)
        if category:
            stmt = stmt.where(Material.category == category)
        if search:
            like = f"%{search}%"
            stmt = stmt.where(or_(
                Material.id.ilike(like),
                Material.description.ilike(like),
                Material.category.ilike(like),
                Material.supplier.ilike(like),
            ))

        total = await self.s.scalar(select(func.count()).select_from(stmt.subquery()))

        sort_col = getattr(Material, sort, Material.current_stock_value)
        stmt = stmt.order_by(sort_col.desc() if desc else sort_col.asc())
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)
        rows = await self.s.scalars(stmt)
        return list(rows), int(total or 0)

    async def get_material(self, material_id: str) -> Material | None:
        return await self.s.scalar(select(Material).where(Material.id == material_id).limit(1))

    async def materials_for_kpis(self, plant_ids: list[str] | None = None) -> list[Material]:
        stmt = select(Material)
        if plant_ids:
            stmt = stmt.where(Material.plant_id.in_(plant_ids))
        rows = await self.s.scalars(stmt)
        return list(rows)

    async def list_recommendations(
        self,
        *,
        plant_ids: list[str] | None = None,
        search: str | None = None,
        type_: str | None = None,
        risk: str | None = None,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[list[Recommendation], int]:
        stmt = select(Recommendation)
        if plant_ids:
            stmt = stmt.where(Recommendation.plant_id.in_(plant_ids))
        if type_:
            stmt = stmt.where(Recommendation.type == type_)
        if risk:
            stmt = stmt.where(Recommendation.risk == risk)
        if search:
            like = f"%{search}%"
            stmt = stmt.where(or_(
                Recommendation.material_id.ilike(like),
                Recommendation.material_desc.ilike(like),
                Recommendation.category.ilike(like),
            ))
        total = await self.s.scalar(select(func.count()).select_from(stmt.subquery()))
        stmt = stmt.order_by(Recommendation.savings_potential.desc())
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)
        rows = await self.s.scalars(stmt)
        return list(rows), int(total or 0)

    async def all_recommendations(self, plant_ids: list[str] | None = None) -> list[Recommendation]:
        stmt = select(Recommendation)
        if plant_ids:
            stmt = stmt.where(Recommendation.plant_id.in_(plant_ids))
        rows = await self.s.scalars(stmt)
        return list(rows)

    # ── demand series (for forecasting) ──────────────────────────────
    async def get_series(self, material_id: str) -> DemandSeries | None:
        return await self.s.get(DemandSeries, material_id)

    async def series_map(self, material_ids: list[str]) -> dict[str, list[float]]:
        if not material_ids:
            return {}
        rows = await self.s.scalars(
            select(DemandSeries).where(DemandSeries.material_id.in_(material_ids))
        )
        return {r.material_id: r.series for r in rows}

    async def series_for_plants(self, plant_ids: list[str] | None) -> dict[str, list[float]]:
        stmt = select(DemandSeries)
        if plant_ids:
            stmt = stmt.where(DemandSeries.plant_id.in_(plant_ids))
        rows = await self.s.scalars(stmt)
        return {r.material_id: r.series for r in rows}

    async def receipts_for_plants(self, plant_ids: list[str] | None) -> dict[str, list[float]]:
        """Monthly receipts per material (SME item 6); None where not stored."""
        stmt = select(DemandSeries)
        if plant_ids:
            stmt = stmt.where(DemandSeries.plant_id.in_(plant_ids))
        rows = await self.s.scalars(stmt)
        return {r.material_id: r.receipts for r in rows}
