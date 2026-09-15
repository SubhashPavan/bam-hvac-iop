"""SQLAlchemy 2.0 ORM models.

Two concerns live here, mirroring the architecture split:
  • analytical reads  — Plant / Material / Recommendation (later served from
    Databricks gold; for now generated deterministically into this DB)
  • transactional state — ActionRequest (the workflow spine)
"""
from __future__ import annotations

from sqlalchemy import JSON, Float, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Plant(Base):
    __tablename__ = "plants"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    region: Mapped[str] = mapped_column(String, index=True)
    country: Mapped[str] = mapped_column(String)
    material_count: Mapped[int] = mapped_column(Integer, default=0)
    inventory_value: Mapped[float] = mapped_column(Float, default=0.0)
    service_level: Mapped[float] = mapped_column(Float, default=0.0)


class Material(Base):
    __tablename__ = "materials"

    # Surrogate PK — the business `code` can (rarely) collide across plants,
    # so it is an indexed column, not the primary key.
    row_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id: Mapped[str] = mapped_column(String, index=True)  # 9-digit material code
    description: Mapped[str] = mapped_column(String)
    category: Mapped[str] = mapped_column(String, index=True)
    supplier: Mapped[str] = mapped_column(String, index=True)
    plant_id: Mapped[str] = mapped_column(String, index=True)
    region: Mapped[str] = mapped_column(String, index=True)
    country: Mapped[str] = mapped_column(String)
    xyz: Mapped[str] = mapped_column(String(1))
    fsn: Mapped[str] = mapped_column(String)
    ved: Mapped[str] = mapped_column(String)
    criticality_score: Mapped[int] = mapped_column(Integer)
    coverage_days: Mapped[int] = mapped_column(Integer)
    on_hand_qty: Mapped[int] = mapped_column(Integer)
    unit_cost: Mapped[float] = mapped_column(Float)
    current_stock_value: Mapped[float] = mapped_column(Float)  # SME: closing value
    avg_monthly_demand: Mapped[float] = mapped_column(Float)
    opening_stock: Mapped[float | None] = mapped_column(Float, nullable=True)  # stock ledger
    lead_time_days: Mapped[float | None] = mapped_column(Float, nullable=True)  # from source when provided


class Recommendation(Base):
    __tablename__ = "recommendations"

    row_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id: Mapped[str] = mapped_column(String, index=True)
    material_id: Mapped[str] = mapped_column(String, index=True)
    material_desc: Mapped[str] = mapped_column(String)
    category: Mapped[str] = mapped_column(String, index=True)
    plant_id: Mapped[str] = mapped_column(String, index=True)
    region: Mapped[str] = mapped_column(String, index=True)
    country: Mapped[str] = mapped_column(String)
    type: Mapped[str] = mapped_column(String, index=True)
    confidence: Mapped[int] = mapped_column(Integer)
    current_stock_value: Mapped[float] = mapped_column(Float)
    recommended_value: Mapped[float] = mapped_column(Float)
    savings_potential: Mapped[float] = mapped_column(Float)
    cash_release: Mapped[float] = mapped_column(Float)
    risk: Mapped[str] = mapped_column(String)
    ai_reasoning: Mapped[str] = mapped_column(Text)
    coverage_days: Mapped[int] = mapped_column(Integer)
    fsn: Mapped[str] = mapped_column(String)
    ved: Mapped[str] = mapped_column(String)
    criticality_score: Mapped[int] = mapped_column(Integer)
    workflow_status: Mapped[str] = mapped_column(String, index=True)


class DemandSeries(Base):
    """Monthly demand history per material (the `fact_demand_history` gold table).

    Stored as one JSON array per material (oldest→newest) — compact and fast to
    read for the forecasting service.
    """

    __tablename__ = "demand_series"

    material_id: Mapped[str] = mapped_column(String, primary_key=True)
    plant_id: Mapped[str] = mapped_column(String, index=True)
    months: Mapped[int] = mapped_column(Integer)
    start_label: Mapped[str] = mapped_column(String)
    end_label: Mapped[str] = mapped_column(String)
    series: Mapped[list] = mapped_column(JSON)  # list[float] consumption, oldest → newest
    receipts: Mapped[list | None] = mapped_column(JSON, nullable=True)  # SME item 6: monthly receipts


class IngestionSource(Base):
    """A record of a data ingestion run (bronze reference + gold promotion)."""

    __tablename__ = "ingestion_sources"

    id: Mapped[str] = mapped_column(String, primary_key=True)  # SRC-1001
    filename: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String, default="ingested")  # ingested | active
    row_count: Mapped[int] = mapped_column(Integer, default=0)
    material_count: Mapped[int] = mapped_column(Integer, default=0)
    plant_count: Mapped[int] = mapped_column(Integer, default=0)
    issue_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[str] = mapped_column(String)
    mapping: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class SimSnapshotRow(Base):
    """A saved what-if scenario — referenced as evidence on workflow requests."""

    __tablename__ = "sim_snapshots"

    id: Mapped[str] = mapped_column(String, primary_key=True)  # SNAP-1001
    scenario: Mapped[str] = mapped_column(String)
    service: Mapped[float] = mapped_column(Float)
    investment: Mapped[float] = mapped_column(Float)
    stockout_risk: Mapped[float] = mapped_column(Float)
    saved_at: Mapped[str] = mapped_column(String)
    plant_ids: Mapped[list | None] = mapped_column(JSON, nullable=True)
    params: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class ActionRequest(Base):
    """The workflow request — the approval-chain spine. Transactional."""

    __tablename__ = "action_requests"

    id: Mapped[str] = mapped_column(String, primary_key=True)  # REQ-1001
    material_id: Mapped[str] = mapped_column(String, index=True)
    material_desc: Mapped[str] = mapped_column(String)
    plant_id: Mapped[str] = mapped_column(String, index=True)
    kind: Mapped[str] = mapped_column(String, index=True)
    current_value: Mapped[float] = mapped_column(Float)
    proposed_value: Mapped[float] = mapped_column(Float)
    savings: Mapped[float] = mapped_column(Float)
    cash_release: Mapped[float] = mapped_column(Float)
    justification: Mapped[str] = mapped_column(Text, default="")
    note: Mapped[str] = mapped_column(Text, default="")
    priority: Mapped[str] = mapped_column(String, default="medium")
    routing: Mapped[str] = mapped_column(String, default="save_execute")
    stage: Mapped[str] = mapped_column(String, index=True, default="maintenance")
    created_at: Mapped[str] = mapped_column(String)
    history: Mapped[list] = mapped_column(JSON, default=list)
    snapshot: Mapped[dict | None] = mapped_column(JSON, nullable=True)
