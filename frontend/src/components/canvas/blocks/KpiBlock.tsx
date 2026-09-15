import { memo } from 'react';
import type { KpiBlockData } from '../../../types/canvas';
import { fmtCompact, isCurrencyColumn } from '../../../utils/formatNumbers';

function fmtVal(value: number | string, label?: string): string {
  if (typeof value !== 'number') return String(value);
  // Pass the metric's label to detect currency columns and force the
  // 2-decimal rule on money values.
  return fmtCompact(value, { currency: isCurrencyColumn(label) });
}

interface KpiBlockProps {
  data: KpiBlockData;
}

function KpiBlockImpl({ data }: KpiBlockProps) {
  const metrics = data.metrics || [];

  // ── Single metric: tile fills its grid cell ─────────────────────
  if (metrics.length === 1) {
    const m = metrics[0];
    const isTextAnswer = typeof m.value === 'string';
    return (
      <div className="flex h-full w-full flex-col justify-center rounded-xl border border-navy-100 bg-white px-4 py-3 shadow-sm transition-all hover:shadow-md animate-fade-slide-in">
        <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-navy-500">
          {m.label}
        </p>
        <p
          className={`mt-0.5 truncate font-bold leading-tight text-accent-700 ${
            isTextAnswer ? 'text-[18px]' : 'text-[24px] tabular-nums tracking-tight'
          }`}
          title={String(m.value)}
        >
          {fmtVal(m.value, m.label)}
        </p>
        {m.secondary && (
          <p className="mt-1 truncate text-[11.5px] text-navy-400">{m.secondary}</p>
        )}
      </div>
    );
  }

  // ── Multi-metric: grid of compact tiles ──────────────────────────
  return (
    <div className="grid h-full auto-rows-fr grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
      {metrics.map((metric, i) => {
        const isTextAnswer = typeof metric.value === 'string';
        return (
          <div
            key={i}
            className="flex flex-col justify-center rounded-xl border border-navy-100 bg-white p-3 shadow-sm transition-all hover:border-accent-200 hover:shadow-md animate-fade-slide-in"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <p className="truncate text-[10.5px] font-semibold uppercase tracking-wider text-navy-500">
              {metric.label}
            </p>
            <p
              className={`mt-0.5 truncate font-bold text-accent-700 ${
                isTextAnswer ? 'text-[15px]' : 'text-[20px] tabular-nums tracking-tight'
              }`}
              title={String(metric.value)}
            >
              {fmtVal(metric.value, metric.label)}
            </p>
            {metric.secondary && (
              <p className="mt-0.5 truncate text-[11px] text-navy-400">{metric.secondary}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

const KpiBlock = memo(KpiBlockImpl, (prev, next) => prev.data === next.data);
export default KpiBlock;
