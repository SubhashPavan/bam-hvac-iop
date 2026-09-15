import { useMemo, useState } from 'react';
import { RefreshCw, Search, ChevronRight, Layers } from 'lucide-react';
import {
  MATERIALS, classification, abcXyzMatrix, type ClassDim,
} from '../../data/inventoryMock';
import type { Material } from '../../types/inventory';
import { fetchForecastSummaries, type ForecastSummaryRow } from '../../services/inventoryApi';
import { useLiveOrMock } from './useLiveData';

const money = (n: number) => (Math.abs(n) >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : Math.abs(n) >= 1e3 ? `$${(n / 1e3).toFixed(1)}K` : `$${Math.round(n)}`);
const PATTERN_TONE: Record<string, string> = { smooth: 'text-emerald-600 dark:text-emerald-400', intermittent: 'text-violet-600 dark:text-violet-400', erratic: 'text-amber-600 dark:text-amber-400', lumpy: 'text-rose-600 dark:text-rose-400', no_demand: 'text-rose-600 dark:text-rose-400' };

const GROUPS: { k: ClassDim | 'pattern'; label: string }[] = [
  { k: 'abc', label: 'ABC (value)' }, { k: 'xyz', label: 'XYZ (variability)' },
  { k: 'fsn', label: 'FSN (movement)' }, { k: 'ved', label: 'VED (criticality)' },
  { k: 'pattern', label: 'Demand pattern' },
];

function statusOf(m: Material, s?: ForecastSummaryRow): { label: string; tone: string } {
  if (s?.demand_pattern === 'no_demand' && m.fsn === 'Non-moving') return { label: 'Obsolete', tone: 'bg-rose-500/15 text-rose-600 dark:text-rose-400' };
  if (s?.understocked || m.coverage_days < 20) return { label: 'Reorder', tone: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' };
  if (m.coverage_days > 180 && m.fsn !== 'Fast') return { label: 'Excess', tone: 'bg-violet-500/15 text-violet-600 dark:text-violet-400' };
  return { label: 'Healthy', tone: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' };
}

export default function PlantWorkspace({ plantIds, onOpen }: { plantIds: string[]; onOpen: (m: Material) => void }) {
  const [groupBy, setGroupBy] = useState<ClassDim | 'pattern'>('abc');
  const [search, setSearch] = useState('');
  const [lastRun, setLastRun] = useState<Date>(() => new Date());
  const [runKey, setRunKey] = useState(0);

  const mats = useMemo(() => MATERIALS.filter((m) => plantIds.includes(m.plant_id)), [plantIds, runKey]);
  const summaries = useLiveOrMock(() => fetchForecastSummaries(plantIds), null, [plantIds.join(','), runKey]);
  const sumById = useMemo(() => new Map((summaries || []).map((s) => [s.material_id, s])), [summaries]);

  const matrix = useMemo(() => abcXyzMatrix(plantIds), [plantIds, runKey]);
  const patternMix = useMemo(() => {
    const mix: Record<string, number> = {};
    for (const m of mats) { const p = sumById.get(m.id)?.demand_pattern || '—'; mix[p] = (mix[p] || 0) + 1; }
    return mix;
  }, [mats, sumById]);

  // grouped rows
  const groups = useMemo(() => {
    const filter = (list: Material[]) => list.filter((m) => !search || m.description.toLowerCase().includes(search.toLowerCase()) || m.id.includes(search));
    if (groupBy === 'pattern') {
      const by: Record<string, Material[]> = {};
      for (const m of mats) { const p = sumById.get(m.id)?.demand_pattern || 'unknown'; (by[p] ||= []).push(m); }
      return Object.entries(by).map(([key, items]) => ({ key, label: key, items: filter(items).sort((a, b) => b.current_stock_value - a.current_stock_value), value: items.reduce((n, m) => n + m.current_stock_value, 0) }))
        .filter((g) => g.items.length).sort((a, b) => b.value - a.value);
    }
    return classification(plantIds, groupBy as ClassDim).map((b) => ({ key: b.key, label: b.label, value: b.value, items: filter(b.items) })).filter((g) => g.items.length);
  }, [groupBy, mats, sumById, plantIds, search]);

  const ABC = ['A', 'B', 'C'] as const, XYZ = ['X', 'Y', 'Z'] as const;
  const w: Record<string, number> = { A: 3, B: 2, C: 1, X: 1, Y: 2, Z: 3 };
  const cell = (r: string, c: string) => matrix.find((m) => m.row === r && m.col === c);
  const tone = (r: string, c: string) => { const s = w[r] * w[c]; return s >= 8 ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300' : s >= 5 ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : s >= 3 ? 'bg-accent-500/10 text-accent-700 dark:text-accent-300' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'; };

  const nextRun = new Date(lastRun.getTime() + 7 * 864e5);
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const runNow = () => { setLastRun(new Date()); setRunKey((k) => k + 1); };

  return (
    <div className="px-6 py-5">
      {/* header + run badge */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-[19px] font-semibold tracking-tight"><Layers className="h-5 w-5 text-accent-500" /> Analysis workspace</h1>
          <p className="text-[12.5px] text-navy-500 dark:text-slate-500">{mats.length} materials classified · demand patterns → policy (safety stock, reorder point, ROQ). Click any material for the full analysis.</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-navy-100 bg-white px-3 py-2 dark:border-slate-800 dark:bg-[#211c33]">
          <div className="text-[10.5px] leading-tight text-navy-500 dark:text-slate-400">
            <div>Last run <b className="text-navy-800 dark:text-slate-200">{fmt(lastRun)}</b></div>
            <div>Next (weekly) {fmt(nextRun)}</div>
          </div>
          <button onClick={runNow} className="inline-flex items-center gap-1.5 rounded-lg bg-accent-500 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-accent-600"><RefreshCw className="h-3.5 w-3.5" /> Run now</button>
        </div>
      </div>

      {/* classification folded in: ABC×XYZ + pattern mix */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="rounded-xl border border-navy-100 bg-white p-4 dark:border-slate-800 dark:bg-[#211c33]">
          <div className="mb-2.5 text-[12.5px] font-semibold">Portfolio — ABC × XYZ <span className="text-[11px] font-normal text-navy-400 dark:text-slate-500">value × variability</span></div>
          <table className="w-full text-center text-[10.5px]">
            <thead><tr className="text-navy-400 dark:text-slate-500"><th></th>{XYZ.map((x) => <th key={x} className="py-1 font-semibold">{x}</th>)}</tr></thead>
            <tbody>{ABC.map((a) => (
              <tr key={a}><td className="pr-2 text-right font-semibold text-navy-400 dark:text-slate-500">{a}</td>
                {XYZ.map((x) => { const c = cell(a, x); return <td key={x} className="p-0.5"><div className={`rounded-md py-1.5 ${tone(a, x)}`}><div className="font-semibold">{c ? money(c.value) : '—'}</div><div className="text-[9px] opacity-70">{c?.count ?? 0}</div></div></td>; })}
              </tr>))}
            </tbody>
          </table>
        </div>
        <div className="rounded-xl border border-navy-100 bg-white p-4 dark:border-slate-800 dark:bg-[#211c33]">
          <div className="mb-2.5 text-[12.5px] font-semibold">Demand patterns <span className="text-[11px] font-normal text-navy-400 dark:text-slate-500">from historical consumption (drives forecast method)</span></div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Object.entries(patternMix).sort((a, b) => b[1] - a[1]).map(([p, n]) => (
              <div key={p} className="rounded-lg border border-navy-100 px-2.5 py-2 dark:border-slate-800">
                <div className={`text-[15px] font-semibold ${PATTERN_TONE[p] || ''}`}>{n}</div>
                <div className="text-[10px] capitalize text-navy-500 dark:text-slate-400">{p.replace('_', ' ')}</div>
              </div>
            ))}
            {!summaries && <div className="col-span-full text-[11px] text-navy-400 dark:text-slate-500">Loading demand patterns…</div>}
          </div>
        </div>
      </div>

      {/* group-by + search */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-medium text-navy-500 dark:text-slate-400">Group by</span>
        <div className="flex flex-wrap gap-1 rounded-lg border border-navy-100 p-0.5 dark:border-slate-800">
          {GROUPS.map((g) => (
            <button key={g.k} onClick={() => setGroupBy(g.k)} className={`rounded-md px-2.5 py-1 text-[11px] font-medium ${groupBy === g.k ? 'bg-accent-500 text-white' : 'text-navy-600 hover:bg-navy-50 dark:text-slate-300 dark:hover:bg-white/5'}`}>{g.label}</button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2 rounded-lg border border-navy-200 bg-white px-2.5 py-1 dark:border-slate-700 dark:bg-slate-900">
          <Search className="h-3.5 w-3.5 text-navy-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search material…" className="w-44 border-none bg-transparent text-[12px] outline-none placeholder:text-navy-400 dark:text-slate-200" />
        </div>
      </div>

      {/* grouped materials */}
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.key} className="overflow-hidden rounded-xl border border-navy-100 bg-white dark:border-slate-800 dark:bg-[#211c33]">
            <div className="flex items-center justify-between border-b border-navy-100 bg-navy-50/40 px-4 py-2 dark:border-slate-800 dark:bg-slate-900/30">
              <span className="text-[12.5px] font-semibold capitalize">{String(g.label).replace('_', ' ')}</span>
              <span className="text-[11px] text-navy-400 dark:text-slate-500">{g.items.length} materials · {money(g.value)}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-[12px]">
                <thead><tr className="border-b border-navy-100 text-left text-[10px] uppercase tracking-wide text-navy-400 dark:border-slate-800 dark:text-slate-500">
                  <th className="px-4 py-2 font-semibold">Material</th><th className="px-3 py-2 font-semibold">Class</th>
                  <th className="px-3 py-2 font-semibold">Demand</th><th className="px-3 py-2 text-right font-semibold">Cover</th>
                  <th className="px-3 py-2 text-right font-semibold">Stock value</th><th className="px-3 py-2 font-semibold">Status</th><th className="px-3 py-2"></th>
                </tr></thead>
                <tbody>{g.items.slice(0, 40).map((m) => {
                  const s = sumById.get(m.id); const st = statusOf(m, s);
                  return (
                    <tr key={m.id} onClick={() => onOpen(m)} className="cursor-pointer border-b border-navy-50 last:border-0 hover:bg-navy-50/60 dark:border-slate-800/60 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-2.5"><div className="font-medium">{m.description}</div><div className="font-mono text-[10px] text-navy-400 dark:text-slate-500">{m.id} · {m.plant_id}</div></td>
                      <td className="px-3 py-2.5 text-navy-500 dark:text-slate-400">{m.xyz}·{m.fsn[0]}·{m.ved[0]}</td>
                      <td className={`px-3 py-2.5 capitalize ${PATTERN_TONE[s?.demand_pattern || ''] || 'text-navy-400 dark:text-slate-500'}`}>{s?.demand_pattern?.replace('_', ' ') || '—'}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{m.coverage_days}d</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{money(m.current_stock_value)}</td>
                      <td className="px-3 py-2.5"><span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${st.tone}`}>{st.label}</span></td>
                      <td className="px-3 py-2.5 text-right"><ChevronRight className="ml-auto h-4 w-4 text-navy-300 dark:text-slate-600" /></td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
