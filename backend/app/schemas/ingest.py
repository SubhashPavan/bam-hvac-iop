"""Ingestion schemas — CSV passed as text (matches the Admin UI, no multipart dep)."""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class PreviewRequest(BaseModel):
    filename: str = "upload.csv"
    csv_text: str


class PreviewResponse(BaseModel):
    filename: str
    headers: list[str]
    row_count: int
    sample_rows: list[dict]
    suggested_mapping: dict[str, Optional[str]]
    required: list[str]
    core_fields: list[str]
    history_columns: list[str] = []


class IngestRequest(BaseModel):
    filename: str = "upload.csv"
    csv_text: str
    mapping: Optional[dict[str, Optional[str]]] = None  # field -> header; auto if omitted
    activate: bool = True
    plant: Optional[str] = None  # force all materials onto one named plant (wide extracts have no plant col)


class IngestResponse(BaseModel):
    source_id: Optional[str]
    filename: str
    row_count: int
    material_count: int
    plant_count: int
    recommendation_count: int
    history_periods: int = 0
    issues: list[str]
    activated: bool


class SourceOut(BaseModel):
    id: str
    filename: str
    status: str
    row_count: int
    material_count: int
    plant_count: int
    issue_count: int
    created_at: str
