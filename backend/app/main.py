"""Inventory Optimization accelerator — FastAPI backend.

Phase 1: serves the analytical contract (plants / materials / recommendations /
KPIs) + the workflow spine (requests + approval state machine) that the
frontend already speaks to. Postgres in prod, SQLite for local dev.
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.v1.router import api_router
from .core.config import settings
from .data.seed import seed_if_empty
from .db.session import SessionLocal, init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    if settings.seed_on_startup:
        async with SessionLocal() as session:
            result = await seed_if_empty(session)
            if result.get("seeded"):
                print(f"[seed] {result}")
    yield


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.get("/health", tags=["meta"])
async def health():
    return {"status": "ok", "app": settings.app_name}
