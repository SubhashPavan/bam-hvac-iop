/**
 * Single source of truth for number formatting across the app.
 *
 * Strict rules:
 *   1. ALWAYS comma-separated thousands (en-US locale): 1,234,567
 *   2. Integers: no decimals       → "1,234"
 *   3. Floats:   exactly 2 decimals → "1,234.56"
 *   4. Currency: always 2 decimals  → "$543.00", "$1,234.56"
 *   5. Compact suffixes (K / M / B) use exactly 2 decimals on the
 *      reduced value: "12.34K", "1.23M", "1.00B" — never 1 decimal,
 *      never zero decimals on a non-integer.
 *
 * Use these helpers everywhere. Don't re-invent `.toFixed(...)` locally.
 */

/** Plain number with strict commas + 2-decimal float rule. */
export function fmtNumber(value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (Number.isInteger(value)) return value.toLocaleString('en-US');
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Currency — always 2 decimals, always commas, $ prefix. */
export function fmtCurrency(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${value < 0 ? '-' : ''}$${Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Heuristic: does a column name suggest a money value?
 *  Matches: amount, total, revenue, spend, cost, price, sales, value,
 *  payment, invoice, dollars, usd, paid, billed, charge, fee.
 *  Excludes count-like names. */
const _CURRENCY_HINTS = [
  'amount', 'total', 'revenue', 'spend', 'cost', 'price', 'sales', 'value',
  'payment', 'invoice', 'dollars', 'usd', 'paid', 'billed', 'charge', 'fee',
  'gross', 'net', 'margin', 'profit', 'expense', 'budget', 'committed',
];
const _CURRENCY_NEGATIVES = [
  'count', 'qty', 'quantity', 'days', 'day', 'pct', 'percent', '_pct',
  'rate', 'ratio', 'num_', 'number', 'id', '_id', 'year', 'month', 'week',
];
export function isCurrencyColumn(name?: string | null): boolean {
  if (!name) return false;
  const n = name.toLowerCase();
  for (const neg of _CURRENCY_NEGATIVES) {
    if (n.includes(neg)) return false;
  }
  for (const pos of _CURRENCY_HINTS) {
    if (n.includes(pos)) return true;
  }
  return false;
}

/** Compact format for body values (KPI tiles, big numbers).
 *  Prefers full-number-with-commas below 1M, then K/M/B suffixes
 *  with exactly 2 decimals. Currency mode always shows 2 decimals
 *  even on integer dollar amounts ($543.00 not $543).
 */
export function fmtCompact(value: number, opts: { currency?: boolean } = {}): string {
  if (!Number.isFinite(value)) return '—';
  const { currency = false } = opts;
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  const prefix = currency ? `${sign}$` : sign;

  if (abs >= 1_000_000_000) {
    return `${prefix}${(abs / 1_000_000_000).toLocaleString('en-US', {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    })}B`;
  }
  if (abs >= 1_000_000) {
    return `${prefix}${(abs / 1_000_000).toLocaleString('en-US', {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    })}M`;
  }
  // Below 1M: full number with commas (this is the change — no K
  // suffix at all here, so users see the precise figure on KPI tiles).
  // For currency we force 2 decimals so $543 reads "$543.00".
  if (currency || !Number.isInteger(abs)) {
    return `${prefix}${abs.toLocaleString('en-US', {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    })}`;
  }
  return `${prefix}${abs.toLocaleString('en-US')}`;
}

/** Compact format for axis ticks where label space is tight.
 *  Same as fmtCompact, but uses K suffix from 10K up so axes don't
 *  blow out horizontally. Always 2 decimals on the suffix portion. */
export function fmtAxisTick(value: number, opts: { currency?: boolean } = {}): string {
  if (!Number.isFinite(value)) return '—';
  const { currency = false } = opts;
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  const prefix = currency ? `${sign}$` : sign;

  if (abs >= 1_000_000_000) {
    return `${prefix}${(abs / 1_000_000_000).toFixed(2)}B`;
  }
  if (abs >= 1_000_000) {
    return `${prefix}${(abs / 1_000_000).toFixed(2)}M`;
  }
  // 10K threshold — keeps short numbers readable, abbreviates only
  // when they'd otherwise crowd the axis.
  if (abs >= 10_000) {
    return `${prefix}${(abs / 1_000).toFixed(2)}K`;
  }
  // Currency keeps 2 decimals at all magnitudes.
  if (currency) {
    return `${prefix}${abs.toLocaleString('en-US', {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    })}`;
  }
  if (Number.isInteger(abs)) return `${prefix}${abs.toLocaleString('en-US')}`;
  return `${prefix}${abs.toLocaleString('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })}`;
}

/** Percent — always 1 decimal place. e.g. 23 → "23.0%". Pass values
 *  already × 100 (i.e. the agent emits 23 for 23%, not 0.23). */
export function fmtPercent(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${value.toFixed(1)}%`;
}
