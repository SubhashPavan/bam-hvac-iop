import { useMemo, useState } from 'react';
import { ChevronRight, ArrowUp, ArrowDown } from 'lucide-react';
import type { Material } from '../../types/inventory';
import type { ForecastSummaryRow } from '../../services/inventoryApi';

const money = (n: number) => (Math.abs(n) >= 1e6 ? `€${(n / 1e6).toFixed(1)}M` : Math.abs(n) >= 1e3 ? `€${(n / 1e3).toFixed(0)}K` : `€${Math.round(n)}`);
const PATTERN_TONE: Record<string, string> = { smooth: 'text-emerald-600 dark:text-emerald-400', intermittent: 'text-violet-600 dark:text-violet-400', erratic: 'text-amber-600 dark:text-amber-400', lumpy: 'text-rose-600 dark:text-rose-400', no_demand: 'text-rose-600 dark:text-rose-400' };

export const isCritical = (m: Material) => m.ved === 'Vital' || m.criticality_score >= 75;

export function statusOf(m: Material, s?: ForecastSummaryRow) {
  // Non-moving with no demand: critical spares are retained (insurance), only low-criticality is disposable.
  if (s && s.demand_pattern === 'no_demand' && m.fsn === 'Non-moving' && m.current_stock_value > 2000) {
    return isCritical(m)
      ? { label: 'Retain', tone: 'bg-sky-500/15 text-sky-600 dark:text-sky-400' }
      : { label: 'Dispose', tone: 'bg-rose-500/15 text-rose-600 dark:text-rose-400' };
  }
  if (s ? m.on_hand_qty < s.reorder_point : m.coverage_days < 20) return { label: 'Reorder', tone: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' };
  if (s ? s.savings > 5000 : m.coverage_days > 180) return { label: 'Reduce', tone: 'bg-violet-500/15 text-violet-600 dark:text-violet-400' };
  return { label: 'Healthy', tone: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' };
}

type SortKey = 'material' | 'pattern' | 'pred' | 'soh' | 'ss' | 'rop' | 'roq' | 'target' | 'cover' | 'fcst' | 'savings' | 'action';
const STATUS_RANK: Record<string, number> = { Healthy: 0, Retain: 1, Reduce: 2, Reorder: 3, Dispose: 4 };
const ACTIONS = ['All', 'Reduce', 'Reorder', 'Dispose', 'Retain', 'Healthy'];

function sortVal(m: Material, s: ForecastSummaryRow | undefined, key: SortKey): number | string {
  switch (key) {
    case 'material': return m.description.toLowerCase();
    case 'pattern': return s?.demand_pattern || '';
    case 'pred': return s?.per_period_demand ?? -1;
    case 'soh': return m.on_hand_qty;
    case 'ss': return s?.safety_stock ?? -1;
    case 'rop': return s?.reorder_point ?? -1;
    case 'roq': return s?.reorder_qty ?? -1;
    case 'target': return s?.target_units ?? -1;
    case 'cover': return m.coverage_days;
    case 'fcst': return s?.model_accuracy ?? -1;
    case 'savings': return s?.savings ?? -1;
    case 'action': return STATUS_RANK[statusOf(m, s).label] ?? -1;
  }
}

/** The canonical SKU metrics grid — sortable + filterable. Used by the Savings Wizard drill and the Material Master. */
export default function SkuGrid({ mats, sumById, onOpen, limit = 80 }: {
  mats: Material[]; sumById: Map<string, ForecastSummaryRow>; onOpen: (m: Material) => void; limit?: number;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'savings', dir: 'desc' });
  const [actionFilter, setActionFilter] = useState('All');

  const toggle = (key: SortKey) => setSort((s) => (s.key === key
    ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
    : { key, dir: key === 'material' || key === 'pattern' ? 'asc' : 'desc' }));

  const rows = useMemo(() => {
    const filtered = actionFilter === 'All' ? mats : mats.filter((m) => statusOf(m, sumById.get(m.id)).label === actionFilter);
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = sortVal(a, sumById.get(a.id), sort.key);
      const vb = sortVal(b, sumById.get(b.id), sort.key);
      if (va < vb) return -dir;
      if (va > vb) return dir;
      return 0;
    });
  }, [mats, sumById, sort, actionFilter]);

  const Th = ({ k, label, right }: { k: SortKey; label: string; right?: boolean }) => (
    <th className={`px-2.5 py-2.5 font-semibold ${right ? 'text-right' : ''}`}>
      <button onClick={() => toggle(k)} className={`inline-flex items-center gap-0.5 hover:text-navy-600 dark:hover:text-slate-300 ${right ? 'flex-row-reverse' : ''} ${sort.key === k ? 'text-navy-700 dark:text-slate-200' : ''}`}>
        {label}{sort.key === k && (sort.dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </button>
    </th>
  );

  return (
    <div>
      {/* Action filter */}
      <div className="mb-2 flex items-center gap-1.5">
        <span className="text-[11px] font-medium text-navy-400 dark:text-slate-500">Filter:</span>
        {ACTIONS.map((a) => (
          <button key={a} onClick={() => setActionFilter(a)} className={`rounded-md px-2 py-1 text-[11.5px] font-medium ${actionFilter === a ? 'bg-accent-500 text-white' : 'text-navy-600 hover:bg-navy-50 dark:text-slate-300 dark:hover:bg-white/5'}`}>{a}</button>
        ))}
        <span className="ml-auto text-[11px] text-navy-400 dark:text-slate-500">{rows.length} shown{rows.length > limit ? ` · top ${limit}` : ''}</span>
      </div>
      <div className="overflow-hidden rounded-xl border border-navy-100 bg-white dark:border-slate-800 dark:bg-[#211c33]"><div className="overflow-x-auto">
        <table className="w-full min-w-[1160px] text-[13.5px]">
          <thead><tr className="border-b border-navy-100 bg-navy-50/40 text-left text-[11px] uppercase tracking-wide text-navy-400 dark:border-slate-800 dark:bg-slate-900/30 dark:text-slate-500">
            <th className="px-4 py-2.5 font-semibold"><button onClick={() => toggle('material')} className={`inline-flex items-center gap-0.5 hover:text-navy-600 dark:hover:text-slate-300 ${sort.key === 'material' ? 'text-navy-700 dark:text-slate-200' : ''}`}>Material{sort.key === 'material' && (sort.dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}</button></th>
            <Th k="pattern" label="Demand pattern" />
            <Th k="pred" label="Pred. /mo" right />
            <Th k="soh" label="SOH" right />
            <Th k="ss" label="Safety stock" right />
            <Th k="rop" label="ROP" right />
            <Th k="roq" label="ROQ" right />
            <Th k="target" label="Target" right />
            <Th k="cover" label="Cover→rec" right />
            <Th k="fcst" label="Fcst acc" right />
            <Th k="savings" label="Savings" right />
            <Th k="action" label="Action" /><th className="px-2 py-2.5"></th>
          </tr></thead>
          <tbody>{rows.slice(0, limit).map((m) => { const s = sumById.get(m.id); const st = statusOf(m, s); return (
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
            {rows.length === 0 && <tr><td colSpan={13} className="px-3 py-10 text-center text-[14px] text-navy-500 dark:text-slate-400">No materials match.</td></tr>}
          </tbody>
        </table>
      </div></div>
    </div>
  );
}
