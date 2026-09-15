from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.session import get_session
from ...repositories.workflow_repo import WorkflowRepo, to_out
from ...schemas.workflow import ActionRequestOut, CreateRequest, Decision, SendBack

router = APIRouter(prefix="/requests", tags=["workflow"])


@router.get("", response_model=list[ActionRequestOut])
async def list_requests(
    stage: str | None = None,
    plant_id: list[str] | None = Query(None),
    session: AsyncSession = Depends(get_session),
):
    rows = await WorkflowRepo(session).list(stage=stage, plant_ids=plant_id)
    return [to_out(r) for r in rows]


@router.post("", response_model=ActionRequestOut, status_code=201)
async def create_request(body: CreateRequest, session: AsyncSession = Depends(get_session)):
    req = await WorkflowRepo(session).create(
        seed=body.seed.model_dump(), note=body.note, priority=body.priority, routing=body.routing,
    )
    return to_out(req)


@router.get("/{req_id}", response_model=ActionRequestOut)
async def get_request(req_id: str, session: AsyncSession = Depends(get_session)):
    req = await WorkflowRepo(session).get(req_id)
    if not req:
        raise HTTPException(404, "Request not found")
    return to_out(req)


@router.post("/{req_id}/decision", response_model=ActionRequestOut)
async def decide(req_id: str, body: Decision, session: AsyncSession = Depends(get_session)):
    req = await WorkflowRepo(session).decide(req_id, body.decision, body.actor, body.comment)
    if not req:
        raise HTTPException(404, "Request not found")
    return to_out(req)


@router.post("/{req_id}/send-back", response_model=ActionRequestOut)
async def send_back(req_id: str, body: SendBack, session: AsyncSession = Depends(get_session)):
    req = await WorkflowRepo(session).send_back(req_id, body.actor, body.comment)
    if not req:
        raise HTTPException(404, "Request not found")
    return to_out(req)
