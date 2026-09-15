"""Deterministic monthly demand-history generator.

Produces realistic *intermittent* MRO series per material — occurrence driven
by FSN (Fast/Slow/Non-moving), nonzero-size variability by XYZ, mild trend for
fast movers, and obsolescence (demand dies partway) for some non-movers. This
gives series spread across all four Syntetos–Boylan quadrants for the models.

Seeded from a per-material FNV hash — independent of the global generator LCG,
so adding this layer does not shift the material/recommendation data.
"""
from __future__ import annotations

MONTHS = 36
END_YEAR, END_MONTH = 2026, 8  # last historical month (period MONTHS-1)

_FSN_P = {"Fast": 0.85, "Slow": 0.45, "Non-moving": 0.16}
_XYZ_CV = {"X": 0.18, "Y": 0.38, "Z": 0.65}


def _rng(material_id: str):
    h = 2166136261
    for ch in material_id:
        h = ((h ^ ord(ch)) * 16777619) & 0xFFFFFFFF
    seed = h

    def rnd() -> float:
        nonlocal seed
        seed = (seed * 1664525 + 1013904223) % 4294967296
        return seed / 4294967296

    return rnd


def month_label(i: int, months: int = MONTHS) -> str:
    """period i (0=oldest .. months-1=END) → 'YYYY-MM'. i may exceed months-1 (future)."""
    total = END_YEAR * 12 + (END_MONTH - 1) - (months - 1 - i)
    y, m = divmod(total, 12)
    return f"{y:04d}-{m + 1:02d}"


def make_receipts(*, material_id: str, consumption: list[float], closing_stock: float) -> tuple[list[float], float]:
    """Deterministic monthly receipts + opening stock consistent with the SME
    balance (opening + Σreceipts − Σconsumption = closing). ~8% of materials get a
    deliberate imbalance so data-validation (SME item 6) has 'Data incorrect' cases.
    """
    n = len(consumption) or 1
    total = sum(consumption)
    rnd = _rng(material_id + "rec")
    rec = [max(0.0, (total / n) * (0.5 + rnd())) for _ in range(n)]
    s = sum(rec) or 1.0
    rec = [round(r * total / s, 1) for r in rec]  # scale so Σreceipts ≈ Σconsumption
    opening = float(closing_stock)                # balanced ⇒ Data OK
    if rnd() > 0.92:                              # inject an error for ~8%
        err = round((total or 10.0) * (0.05 + rnd() * 0.15), 1)
        rec[-1] = round(rec[-1] + err, 1)         # Σreceipts > Σconsumption ⇒ Data incorrect
    return rec, opening


def make_series(*, material_id: str, fsn: str, xyz: str, avg_monthly_demand: float,
                months: int = MONTHS) -> list[float]:
    rnd = _rng(material_id)
    p = _FSN_P.get(fsn, 0.45)
    cv = _XYZ_CV.get(xyz, 0.38)
    mean_size = (avg_monthly_demand / p) if p > 0 else avg_monthly_demand

    # Obsolescence: ~half of non-movers stop consuming partway through history.
    death = None
    if fsn == "Non-moving" and rnd() > 0.5:
        death = int(months * (0.4 + rnd() * 0.4))

    out: list[float] = []
    for i in range(months):
        if death is not None and i >= death:
            out.append(0.0)
            continue
        if rnd() >= p:  # no demand this month
            out.append(0.0)
            continue
        # size ~ mean_size, symmetric noise (sum of 3 uniforms ≈ normal), + trend for fast
        noise = 1 + cv * ((rnd() + rnd() + rnd()) - 1.5)
        trend = 1 + (i / months - 0.5) * (0.3 if fsn == "Fast" else 0.0)
        size = mean_size * max(0.05, noise) * trend
        out.append(round(max(0.0, size), 1))
    return out
