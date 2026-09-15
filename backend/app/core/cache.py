"""Tiny async single-flight TTL cache.

The analytical endpoints (savings matrix, KPIs, opportunities, network, vendors,
forecast summaries) recompute the same per-material policy over the whole
portfolio. For a large ingested dataset the frontend fires many identical
requests at once; without coordination each one recomputes and — being sync
numpy inside an async handler — blocks the event loop, so they serialize.

This gives every distinct (key) at most ONE in-flight computation: concurrent
callers for the same key await the same result, and the result is cached for a
short TTL. Bumping the version (on ingest / reseed) invalidates everything.
"""
from __future__ import annotations

import asyncio
import time
from typing import Awaitable, Callable, TypeVar

T = TypeVar("T")

_store: dict[tuple, tuple[object, float]] = {}
_locks: dict[tuple, asyncio.Lock] = {}
_version = 0


def bump_version() -> None:
    """Invalidate the whole cache (call after ingest / reseed)."""
    global _version
    _version += 1
    _store.clear()
    _locks.clear()


def version() -> int:
    return _version


async def cached(key: tuple, factory: Callable[[], Awaitable[T]], *, ttl: float = 300.0) -> T:
    full = (_version, *key)
    hit = _store.get(full)
    now = time.time()
    if hit and hit[1] > now:
        return hit[0]  # type: ignore[return-value]
    lock = _locks.setdefault(full, asyncio.Lock())
    async with lock:
        hit = _store.get(full)  # re-check inside the lock (another caller may have filled it)
        now = time.time()
        if hit and hit[1] > now:
            return hit[0]  # type: ignore[return-value]
        value = await factory()
        _store[full] = (value, time.time() + ttl)
        return value


def scope_key(plant_ids) -> tuple:
    return tuple(sorted(plant_ids)) if plant_ids else ("__all__",)
