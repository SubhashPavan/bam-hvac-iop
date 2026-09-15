"""Seed the deterministic demo dataset into the DB when empty."""
from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import DemandSeries, Material, Plant, Recommendation
from .demand import MONTHS, make_receipts, make_series, month_label
from .generate import generate


async def seed_if_empty(session: AsyncSession) -> dict:
    result: dict = {"seeded": False}

    existing = await session.scalar(select(func.count()).select_from(Material))
    if not existing:
        data = generate()
        session.add_all([Plant(**p) for p in data["plants"]])
        session.add_all([Material(**m) for m in data["materials"]])
        session.add_all([Recommendation(**r) for r in data["recommendations"]])
        await session.commit()
        result.update(seeded=True, plants=len(data["plants"]),
                      materials=len(data["materials"]),
                      recommendations=len(data["recommendations"]))

    await seed_demand_if_empty(session, result)
    return result


async def seed_demand_if_empty(session: AsyncSession, result: dict) -> None:
    existing = await session.scalar(select(func.count()).select_from(DemandSeries))
    if existing:
        return
    materials = list(await session.scalars(select(Material)))
    start, end = month_label(0), month_label(MONTHS - 1)
    rows = []
    for m in materials:
        series = make_series(material_id=m.id, fsn=m.fsn, xyz=m.xyz,
                             avg_monthly_demand=m.avg_monthly_demand)
        receipts, opening = make_receipts(material_id=m.id, consumption=series,
                                          closing_stock=m.on_hand_qty)
        m.opening_stock = opening  # SME item 6 input
        rows.append(DemandSeries(material_id=m.id, plant_id=m.plant_id, months=MONTHS,
                                 start_label=start, end_label=end, series=series, receipts=receipts))
    session.add_all(rows)
    await session.commit()
    result["seeded"] = True
    result["demand_series"] = len(rows)
