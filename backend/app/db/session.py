"""Async engine + session factory.

Normalizes the DATABASE_URL so a managed-Postgres string (e.g. Neon) works as
pasted: forces the asyncpg driver and strips the psycopg-style `sslmode` /
`channel_binding` query params (asyncpg rejects them), enabling TLS via
connect_args instead. SQLite (local dev) is passed through untouched.
"""
from __future__ import annotations

from collections.abc import AsyncIterator

from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from ..core.config import settings
from .models import Base


def _prepare(raw: str):
    url = make_url(raw)
    connect_args: dict = {}
    if url.drivername.startswith("postgresql"):
        if "+asyncpg" not in url.drivername:
            url = url.set(drivername="postgresql+asyncpg")
        q = dict(url.query)
        sslmode = q.pop("sslmode", None)
        q.pop("channel_binding", None)  # asyncpg does not accept this
        url = url.set(query=q)
        if sslmode and sslmode != "disable":
            connect_args["ssl"] = True
    return url, connect_args


_url, _connect_args = _prepare(settings.database_url)
_engine_kw: dict = {"echo": False, "future": True, "pool_pre_ping": True, "connect_args": _connect_args}
if _url.drivername.startswith("postgresql"):
    # Shared Burstable server — keep a small pool so we don't exhaust its slots.
    _engine_kw.update(pool_size=3, max_overflow=2, pool_timeout=30, pool_recycle=1800)
engine = create_async_engine(_url, **_engine_kw)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # Additive migrations — each in its OWN transaction so one failure can't poison
    # the others (Postgres aborts the whole tx on any error).
    for table, column, coltype in (
        ("materials", "opening_stock", "FLOAT"),
        ("materials", "lead_time_days", "FLOAT"),
        ("demand_series", "receipts", "JSON"),
    ):
        await _add_column_if_missing(table, column, coltype)


async def _add_column_if_missing(table: str, column: str, coltype: str) -> None:
    dialect = engine.dialect.name
    try:
        async with engine.begin() as conn:
            if dialect == "postgresql":
                await conn.exec_driver_sql(
                    f'ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {column} {coltype}')
            else:  # sqlite (no ADD COLUMN IF NOT EXISTS) — check first
                rows = await conn.exec_driver_sql(f"PRAGMA table_info({table})")
                cols = {r[1] for r in rows.fetchall()}
                if column not in cols:
                    await conn.exec_driver_sql(f'ALTER TABLE {table} ADD COLUMN {column} {coltype}')
    except Exception as e:  # noqa: BLE001
        print(f"[migrate] {table}.{column} skipped: {e}")
