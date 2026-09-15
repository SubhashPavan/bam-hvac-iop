import { ChevronRight } from 'lucide-react';
import type { Material } from '../../types/inventory';
import type { ForecastSummaryRow } from '../../services/inventoryApi';

const money = (n: number) => (Math.abs(n) >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : Math.abs(n) >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${Math.round(n)}`);
const PATTERN_TONE: Record<string, string> = { smooth: 'text-emerald-600 dark:text-emerald-400', intermittent: 'text-violet-600 dark:text-violet-400', erratic: 'text-amber-600 dark:text-amber-400', lumpy: 'text-rose-600 dark:text-rose-400', no_demand: 'text-rose-600 dark:text-rose-400' };

export function statusOf(m: Material, s?: ForecastSummaryRow) {
  if (s && s.demand_pattern === 'no_demand' && m.fsn === 'Non-moving' && m.current_stock_value > 2000) return { label: 'Dispose', tone: 'bg-rose-500/15 text-rose-600 dark:text-rose-400' };
  if (s ? m.on_hand_qty < s.reorder_point : m.coverage_days < 20) return { label: 'Reorder', tone: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' };
  if (s ? s.savings > 5000 : m.coverage_days > 180) return { label: 'Reduce', tone: 'bg-violet-500/15 text-violet-600 dark:text-violet-400' };
  return { label: 'Healthy', tone: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' };
}

/** The canonical SKU metrics grid — used by the Savings Wizard drill and the Material Master, so they stay aligned. */
export default function SkuGrid({ mats, sumById, onOpen, limit = 80 }: {
  mats: Material[]; sumById: Map<string, ForecastSummaryRow>; onOpen: (m: Material) => void; limit?: number;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-navy-100 bg-white dark:border-slate-800 dark:bg-[#211c33]"><div className="overflow-x-auto">
      <table className="w-full min-w-[1160px] text-[13.5px]">
        <thead><tr className="border-b border-navy-100 bg-navy-50/40 text-left text-[11px] uppercase tracking-wide text-navy-400 dark:border-slate-800 dark:bg-slate-900/30 dark:text-slate-500">
          <th className="px-4 py-2.5 font-semibold">Material</th>
          <th className="px-2.5 py-2.5 font-semibold">Demand pattern</th>
          <th className="px-2.5 py-2.5 text-right font-semibold">Pred. /mo</th>
          <th className="px-2.5 py-2.5 text-right font-semibold">SOH</th>
          <th className="px-2.5 py-2.5 text-right font-semibold">Safety stock</th>
          <th className="px-2.5 py-2.5 text-right font-semibold">ROP</th>
          <th className="px-2.5 py-2.5 text-right font-semibold">ROQ</th>
          <th className="px-2.5 py-2.5 text-right font-semibold">Target</th>
          <th className="px-2.5 py-2.5 text-right font-semibold">Cover→rec</th>
          <th className="px-2.5 py-2.5 text-right font-semibold">Fcst acc</th>
          <th className="px-2.5 py-2.5 text-right font-semibold">Savings</th>
          <th className="px-2.5 py-2.5 font-semibold">Action</th><th className="px-2 py-2.5"></th>
        </tr></thead>
        <tbody>{mats.slice(0, limit).map((m) => { const s = sumById.get(m.id); const st = statusOf(m, s); return (
          <tr key={m.id} onClick={() => onOpen(m)} className="cursor-pointer border-b border-navy-50 last:border-0 hover:bg-navy-50/60 dark:border-slate-800/60 dark:hover:bg-slate-800/40">
            <td className="px-4 py-2.5"><div className="font-medium">{m.description}</div><div className="font-mono text-[11.5px] text-navy-400 dark:text-slate-500">{m.id} · {m.plant_id} · {m.xyz}·{m.fsn[0]}·{m.ved[0]}</div></td>
            <td className={`px-2.5 py-2.5 capitalize ${PATTERN_TONE[s?.demand_pattern || ''] || 'text-navy-400 dark:text-slate-500'}`}>{s?.demand_pattern?.replace('_', ' ') || '—'}<div className="text-[10.5px] text-navy-400 dark:text-slate-500">{s?.method || ''}</div></td>
            <td className="px-2.5 py-2.5 text-right tabular-nums">{s ? <>{s.per_period_demand.toFixed(1)}<div className={`text-[10.5px] ${s.trend_pct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{s.trend_pct >= 0 ? '+' : ''}{s.trend_pct}%</div></> : '—'}</td>
            <td className="px-2.5 py-2.5 text-right tabular-nums">{m.on_hand_qty}<div className="text-[10.5px] text-navy-400 dark:text-slate-500">{money(m.current_stock_value)}</div></td>
            <td className="px-2.5 py-2.5 text-right tabular-nums text-violet-600 dark:text-violet-400">{s ? Math.round(s.safety_stock) : '—'}</td>
            <td className="px-2.5 py-2.5 text-right tabular-nums">{s ? Math.round(s.reorder_point) : '—'}</td>
            <td className="px-2.5 py-2.5 text-right tabular-nums">{s ? Math.round(s.reorder_qty) : '—'}</td>
            <td className="px-2.5 py-2.5 text-right font-medium tabular-nums">{s ? Math.round(s.target_units) : '—'}</td>
            <td className="px-2.5 py-2.5 text-right tabular-nums">{m.coverage_days}d<div className="text-[10.5px] text-navy-400 dark:text-slate-500">→ {s?.recommended_coverage_days ?? '—'}d</div></td>
            <td className="px-2.5 py-2.5 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{s ? `${s.model_accuracy}%` : '—'}</td>
            <td className="px-2.5 py-2.5 text-right font-semibold tabular-nums text-amber-600 dark:text-amber-400">{s && s.savings > 0 ? money(s.savings) : '—'}</td>
            <td className="px-2.5 py-2.5"><span className={`rounded px-1.5 py-0.5 text-[11.5px] font-semibold ${st.tone}`}>{st.label}</span></td>
            <td className="px-2 py-2.5 text-right"><ChevronRight className="ml-auto h-4 w-4 text-navy-300 dark:text-slate-600" /></td>
          </tr>); })}
          {mats.length === 0 && <tr><td colSpan={13} className="px-3 py-10 text-center text-[14px] text-navy-500 dark:text-slate-400">No materials match.</td></tr>}
        </tbody>
      </table>
    </div></div>
  );
}
