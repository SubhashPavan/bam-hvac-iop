from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.models import SimSnapshotRow
from ...db.session import get_session
from ...ml.simulate import simulate_scenario, tradeoff_curve
from ...repositories.inventory_repo import InventoryRepo
from ...schemas.simulation import (
    SaveSnapshot,
    SimResult,
    SimScenarioRequest,
    SnapshotOut,
    TradeoffResult,
)

router = APIRouter(prefix="/simulate", tags=["simulation"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _pairs(repo: InventoryRepo, plant_id):
    materials = await repo.materials_for_kpis(plant_ids=plant_id)
    smap = await repo.series_for_plants(plant_id)
    return [(m, smap.get(m.id, [])) for m in materials if m.id in smap]


@router.post("", response_model=SimResult)
async def run_scenario(body: SimScenarioRequest, session: AsyncSession = Depends(get_session)):
    """Monte Carlo what-if: demand surge / supplier delay / service target."""
    pairs = await _pairs(InventoryRepo(session), body.plant_id)
    return simulate_scenario(
        pairs, label=body.label, demand_mult=body.demand_multiplier,
        lead_mult=body.lead_multiplier, target_service=body.target_service_level,
        trials=min(body.trials, 2000), saved_at=_now(),
    )


@router.get("/tradeoff", response_model=TradeoffResult)
async def tradeoff(
    plant_id: list[str] | None = Query(None),
    session: AsyncSession = Depends(get_session),
):
    """Service-level ↔ investment curve (diminishing returns)."""
    repo = InventoryRepo(session)
    pairs = await _pairs(repo, plant_id)
    plants = await repo.list_plants()
    if plant_id:
        plants = [p for p in plants if p.id in plant_id]
    return tradeoff_curve(pairs, plants=plants)


@router.post("/snapshots", response_model=SnapshotOut, status_code=201)
async def save_snapshot(body: SaveSnapshot, session: AsyncSession = Depends(get_session)):
    """Persist a scenario snapshot (to attach as workflow evidence)."""
    count = await session.scalar(select(func.count()).select_from(SimSnapshotRow))
    snap_id = f"SNAP-{1000 + int(count or 0) + 1}"
    row = SimSnapshotRow(
        id=snap_id, scenario=body.snapshot.scenario, service=body.snapshot.service,
        investment=body.snapshot.investment, stockout_risk=body.snapshot.stockoutRisk,
        saved_at=body.snapshot.savedAt or _now(), plant_ids=body.plant_ids, params=body.params,
    )
    session.add(row)
    await session.commit()
    return {"id": snap_id, **body.snapshot.model_dump()}


@router.get("/snapshots", response_model=list[SnapshotOut])
async def list_snapshots(session: AsyncSession = Depends(get_session)):
    rows = await session.scalars(select(SimSnapshotRow).order_by(SimSnapshotRow.saved_at.desc()))
    return [{"id": r.id, "scenario": r.scenario, "service": r.service, "investment": r.investment,
             "stockoutRisk": r.stockout_risk, "savedAt": r.saved_at} for r in rows]
