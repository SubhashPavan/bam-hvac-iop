"""Data access + state machine for the workflow spine (ActionRequest).

Mirrors the frontend requestStore: create -> routes to `maintenance`; approve
advances one stage along STAGE_FLOW; reject -> `rejected`; send-back -> prev.
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import ActionRequest

STAGE_FLOW = ["plant_mgr", "maintenance", "finance", "regional", "global", "executing", "done"]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class WorkflowRepo:
    def __init__(self, session: AsyncSession):
        self.s = session

    async def list(self, *, stage: str | None = None, plant_ids: list[str] | None = None) -> list[ActionRequest]:
        stmt = select(ActionRequest)
        if stage:
            stmt = stmt.where(ActionRequest.stage == stage)
        if plant_ids:
            stmt = stmt.where(ActionRequest.plant_id.in_(plant_ids))
        stmt = stmt.order_by(ActionRequest.created_at.desc())
        rows = await self.s.scalars(stmt)
        return list(rows)

    async def get(self, req_id: str) -> ActionRequest | None:
        return await self.s.get(ActionRequest, req_id)

    async def _next_seq(self) -> int:
        count = await self.s.scalar(select(func.count()).select_from(ActionRequest))
        return int(count or 0) + 1

    async def create(self, *, seed: dict, note: str, priority: str, routing: str) -> ActionRequest:
        seq = await self._next_seq()
        req = ActionRequest(
            id=f"REQ-{1000 + seq}",
            material_id=seed["materialId"],
            material_desc=seed["materialDesc"],
            plant_id=seed["plantId"],
            kind=seed["kind"],
            current_value=seed["currentValue"],
            proposed_value=seed["proposedValue"],
            savings=seed["savings"],
            cash_release=seed["cashRelease"],
            justification=seed.get("justification", ""),
            note=note,
            priority=priority,
            routing=routing,
            stage="maintenance",  # Plant Manager originates -> Maintenance next
            created_at=_now(),
            history=[{"stage": "plant_mgr", "actor": "You · Plant Manager", "decision": "created", "at": _now()}],
            snapshot=seed.get("snapshot"),
        )
        self.s.add(req)
        await self.s.commit()
        await self.s.refresh(req)
        return req

    async def decide(self, req_id: str, decision: str, actor: str, comment: str | None) -> ActionRequest | None:
        req = await self.get(req_id)
        if not req:
            return None
        history = list(req.history or [])
        history.append({"stage": req.stage, "actor": actor, "decision": decision, "comment": comment, "at": _now()})
        if decision == "rejected":
            req.stage = "rejected"
        else:
            i = STAGE_FLOW.index(req.stage) if req.stage in STAGE_FLOW else 0
            req.stage = STAGE_FLOW[min(i + 1, len(STAGE_FLOW) - 1)]
        req.history = history
        await self.s.commit()
        await self.s.refresh(req)
        return req

    async def send_back(self, req_id: str, actor: str, comment: str | None) -> ActionRequest | None:
        req = await self.get(req_id)
        if not req:
            return None
        history = list(req.history or [])
        history.append({"stage": req.stage, "actor": actor, "decision": "sent_back", "comment": comment, "at": _now()})
        i = STAGE_FLOW.index(req.stage) if req.stage in STAGE_FLOW else 0
        req.stage = STAGE_FLOW[max(0, i - 1)]
        req.history = history
        await self.s.commit()
        await self.s.refresh(req)
        return req


def to_out(req: ActionRequest) -> dict:
    """ORM -> the camelCase ActionRequestOut shape."""
    return {
        "id": req.id,
        "materialId": req.material_id,
        "materialDesc": req.material_desc,
        "plantId": req.plant_id,
        "kind": req.kind,
        "currentValue": req.current_value,
        "proposedValue": req.proposed_value,
        "savings": req.savings,
        "cashRelease": req.cash_release,
        "justification": req.justification,
        "note": req.note,
        "priority": req.priority,
        "routing": req.routing,
        "createdAt": req.created_at,
        "stage": req.stage,
        "history": req.history or [],
        "snapshot": req.snapshot,
    }
