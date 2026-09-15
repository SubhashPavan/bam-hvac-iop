from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.models import IngestionSource
from ...db.session import get_session
from ...ingest import pipeline
from ...schemas.ingest import (
    IngestRequest,
    IngestResponse,
    PreviewRequest,
    PreviewResponse,
    SourceOut,
)

router = APIRouter(prefix="/ingest", tags=["ingestion"])

_TEMPLATE = ("material_id,description,plant,category,supplier,stock_value,coverage_days,ved,fsn,xyz\n"
             "100000001,Bearing SKF 6205,DE-BER-02,Bearings,SKF,42000,180,Vital,Slow,Z\n"
             "100000002,Filter Pall HC,IN-PUN-02,Filtration,Pall,8500,45,Essential,Fast,X\n")


@router.get("/template", response_class=PlainTextResponse)
async def template():
    return _TEMPLATE


@router.post("/preview", response_model=PreviewResponse)
async def preview(body: PreviewRequest):
    """Parse a CSV → headers, sample rows, and a suggested field mapping."""
    headers, rows = pipeline.parse_csv(body.csv_text)
    if not headers:
        raise HTTPException(400, "Could not parse any rows from the CSV.")
    mapping = pipeline.auto_map(headers)
    wide = pipeline.detect_wide_mro(headers)
    history = wide["consumption"] if wide else pipeline.detect_history(headers, mapping)
    return PreviewResponse(
        filename=body.filename, headers=headers, row_count=len(rows),
        sample_rows=rows[:5], suggested_mapping=mapping,
        required=pipeline.REQUIRED, core_fields=pipeline.CORE,
        history_columns=history,
    )


@router.post("/csv", response_model=IngestResponse)
async def ingest_csv(body: IngestRequest, session: AsyncSession = Depends(get_session)):
    """Validate + transform the CSV; activate replaces the analytical dataset (gold)."""
    headers, rows = pipeline.parse_csv(body.csv_text)
    if not headers or not rows:
        raise HTTPException(400, "No data rows found.")
    mapping = body.mapping or pipeline.auto_map(headers)
    # The wide MRO extract derives plant/stock value itself, so it only needs a material id.
    if pipeline.detect_wide_mro(headers):
        if not mapping.get("materialid"):
            raise HTTPException(422, "Missing required field mapping: material id.")
    else:
        missing = [f for f in pipeline.REQUIRED if not mapping.get(f)]
        if missing:
            raise HTTPException(422, f"Missing required field mapping(s): {', '.join(missing)}")

    gold = pipeline.validate_transform(rows, mapping)
    source_id = None
    if body.activate:
        src = await pipeline.activate(session, gold, filename=body.filename,
                                      mapping=mapping, row_count=len(rows))
        source_id = src.id
        from ...core.cache import bump_version
        bump_version()  # new active dataset → invalidate all cached analytics

    periods = max((s["months"] for s in gold["series"]), default=0)
    return IngestResponse(
        source_id=source_id, filename=body.filename, row_count=len(rows),
        material_count=len(gold["materials"]), plant_count=len(gold["plants"]),
        recommendation_count=len(gold["recommendations"]), history_periods=periods,
        issues=gold["issues"][:50], activated=body.activate,
    )


@router.get("/sources", response_model=list[SourceOut])
async def sources(session: AsyncSession = Depends(get_session)):
    rows = await session.scalars(select(IngestionSource).order_by(IngestionSource.created_at.desc()))
    return list(rows)
