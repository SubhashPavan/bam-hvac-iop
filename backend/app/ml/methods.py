"""Intermittent-demand forecasting methods for MRO spare parts.

Implements the classic family directly (no heavy statsforecast/numba dep):
  • Croston's method        — decompose demand into size × interval
  • SBA (Syntetos–Boylan)   — Croston with bias correction (1 − α/2)
  • TSB (Teunter et al.)    — updates demand *probability* every period, so
                              discontinued parts decay to zero (obsolescence)
  • SES                     — for smooth (non-intermittent) series

Plus Syntetos–Boylan demand-pattern classification (ADI / CV²) and a
rolling-origin backtest (MAE / bias / MASE / residual σ).

Production can swap these for Nixtla `statsforecast` behind `auto_forecast`.
"""
from __future__ import annotations

from collections.abc import Callable, Sequence

import numpy as np

# Syntetos–Boylan classification cutoffs
SB_ADI = 1.32
SB_CV2 = 0.49


def classify(series: Sequence[float]) -> dict:
    """ADI (avg inter-demand interval), CV² of nonzero sizes, and the quadrant."""
    s = np.asarray(series, dtype=float)
    n = len(s)
    nz = s[s > 0]
    k = len(nz)
    if n == 0 or k == 0:
        return {"adi": None, "cv2": None, "pattern": "no_demand"}
    adi = n / k
    mean_nz = float(nz.mean())
    cv2 = float((nz.std() / mean_nz) ** 2) if mean_nz > 0 else 0.0
    if adi < SB_ADI and cv2 < SB_CV2:
        pattern = "smooth"
    elif adi >= SB_ADI and cv2 < SB_CV2:
        pattern = "intermittent"
    elif adi < SB_ADI and cv2 >= SB_CV2:
        pattern = "erratic"
    else:
        pattern = "lumpy"
    return {"adi": round(adi, 2), "cv2": round(cv2, 2), "pattern": pattern}


def ses(series: Sequence[float], alpha: float = 0.3) -> float:
    """Simple exponential smoothing — the smooth-series baseline."""
    s = list(series)
    if not s:
        return 0.0
    level = s[0]
    for d in s[1:]:
        level = alpha * d + (1 - alpha) * level
    return float(level)


def croston(series: Sequence[float], alpha: float = 0.1) -> float:
    """Croston's method → per-period demand rate (size / interval)."""
    d = np.asarray(series, dtype=float)
    nz = np.nonzero(d)[0]
    if len(nz) == 0:
        return 0.0
    intervals = np.diff(np.concatenate(([-1], nz))).astype(float)  # 1st = nz[0]+1
    sizes = d[nz]
    z, p = sizes[0], intervals[0]
    for i in range(1, len(sizes)):
        z += alpha * (sizes[i] - z)
        p += alpha * (intervals[i] - p)
    return float(z / p) if p > 0 else 0.0


def sba(series: Sequence[float], alpha: float = 0.1) -> float:
    """Syntetos–Boylan Approximation — bias-corrected Croston."""
    return (1 - alpha / 2) * croston(series, alpha)


def tsb(series: Sequence[float], alpha: float = 0.2, beta: float = 0.1) -> float:
    """Teunter–Syntetos–Babai — probability updated every period (obsolescence-aware)."""
    d = np.asarray(series, dtype=float)
    n = len(d)
    nz = np.nonzero(d)[0]
    if len(nz) == 0:
        return 0.0
    z = float(d[nz].mean())              # size estimate
    p = float((d > 0).mean())            # demand probability
    for t in range(n):
        if d[t] > 0:
            z += alpha * (d[t] - z)
            p += beta * (1 - p)
        else:
            p += beta * (0 - p)
    return float(max(0.0, p * z))


# ── auto-selection by demand pattern ─────────────────────────────────
_METHODS: dict[str, tuple[str, Callable[[Sequence[float]], float]]] = {
    "smooth": ("SES", lambda s: ses(s, 0.3)),
    "intermittent": ("Croston SBA", lambda s: sba(s, 0.1)),
    "erratic": ("Croston SBA", lambda s: sba(s, 0.1)),
    "lumpy": ("TSB", lambda s: tsb(s, 0.2, 0.1)),
    "no_demand": ("TSB", lambda s: tsb(s, 0.2, 0.1)),
}


def method_for(pattern: str) -> tuple[str, Callable[[Sequence[float]], float]]:
    return _METHODS.get(pattern, _METHODS["intermittent"])


def auto_forecast(series: Sequence[float]) -> dict:
    """Classify, pick the method, return the per-period demand-rate forecast."""
    c = classify(series)
    name, fn = method_for(c["pattern"])
    rate = max(0.0, fn(series))
    return {"method": name, "per_period": rate, **c}


def backtest(series: Sequence[float], forecaster: Callable[[Sequence[float]], float],
             min_train: int = 12) -> dict:
    """Rolling-origin one-step backtest → MAE, bias, MASE, residual σ."""
    s = list(series)
    if len(s) <= min_train:
        return {"mae": None, "bias": None, "mase": None, "sigma": None}
    errs = np.array([s[t] - forecaster(s[:t]) for t in range(min_train, len(s))], dtype=float)
    mae = float(np.abs(errs).mean())
    bias = float(errs.mean())
    sigma = float(errs.std())
    naive = np.abs(np.diff(s))
    denom = float(naive.mean()) if len(naive) and naive.mean() > 0 else None
    mase = round(mae / denom, 3) if denom else None
    return {"mae": round(mae, 3), "bias": round(bias, 3), "mase": mase, "sigma": round(sigma, 3)}
