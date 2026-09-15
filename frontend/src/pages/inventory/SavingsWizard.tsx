import { Fragment, useMemo, useState } from 'react';
import { Sparkles, ArrowLeft, Search, ChevronRight, Lightbulb } from 'lucide-react';
import { MATERIALS } from '../../data/inventoryMock';
import type { Material } from '../../types/inventory';
import { getSavingsMatrix, fetchForecastSummaries, type ForecastSummaryRow } from '../../services/inventoryApi';
import { useLiveOrMock } from './useLiveData';
import MaterialAnalysis from './MaterialAnalysis';

const money = (n: number) => (Math.abs(n) >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : Math.abs(n) >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${Math.round(n)}`);
const TT: Record<string, string> = { rose: 'text-rose-600 dark:text-rose-400', amber: 'text-amber-600 dark:text-amber-400', mint: 'text-emerald-600 dark:text-emerald-400', violet: 'text-violet-600 dark:text-violet-400', accent: 'text-accent-600 dark:text-accent-400' };
const PATTERN_TONE: Record<string, string> = { smooth: 'text-emerald-600 dark:text-emerald-400', intermittent: 'text-violet-600 dark:text-violet-400', erratic: 'text-amber-600 dark:text-amber-400', lumpy: 'text-rose-600 dark:text-rose-400', no_demand: 'text-rose-600 dark:text-rose-400' };
const ACTION_LABEL: Record<string, string> = { reduce_stock: 'Reduce excess', dispose: 'Dispose / write-off', reorder: 'Reorder', healthy: 'Healthy', none: '—' };
const FSN_ROWS = ['Fast', 'Slow', 'Non-moving'];
const ABC_COLS = ['A', 'B', 'C'];
const ABC_SUB: Record<string, string> = { A: 'top 80% value', B: 'next 15%', C: 'last 5%' };

function Kpi({ value, label, sub, tone }: { value: string; label: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-navy-100 bg-white p-3 dark:border-slate-800 dark:bg-[#211c33]">
      <div className={`text-[19.5px] font-semibold leading-none tracking-tight ${tone ? TT[tone] : ''}`}>{value}</div>
      <div className="mt-1.5 text-[12px] font-medium">{label}</div>
      {sub && <div className="text-[11px] text-navy-400 dark:text-slate-500">{sub}</div>}
    </div>
  );
}

// highlight $amounts and integers in insight text (reference-style)
function Insight({ text }: { text: string }) {
  const parts = text.split(/(\$[\d.,]+[MK]?|\b\d[\d,]*\b)/g);
  return <p className="text-[13px] leading-relaxed text-navy-600 dark:text-slate-400">{parts.map((s, i) => /^(\$|\d)/.test(s) ? <b key={i} className="text-accent-600 dark:text-accent-300">{s}</b> : <Fragment key={i}>{s}</Fragment>)}</p>;
}

function statusOf(m: Material, s?: ForecastSummaryRow) {
  if (s?.demand_pattern === 'no_demand' && m.fsn === 'Non-moving') return { label: 'Obsolete', tone: 'bg-rose-500/15 text-rose-600 dark:text-rose-400' };
  if (s?.understocked || m.coverage_days < 20) return { label: 'Reorder', tone: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' };
  if (m.coverage_days > 180 && m.fsn !== 'Fast') return { label: 'Excess', tone: 'bg-violet-500/15 text-violet-600 dark:text-violet-400' };
  return { label: 'Healthy', tone: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' };
}

export default function SavingsWizard({ plantIds }: { plantIds: string[] }) {
  const data = useLiveOrMock<any>(() => getSavingsMatrix(plantIds), null, [plantIds.join(',')]);
  const summaries = useLiveOrMock(() => fetchForecastSummaries(plantIds), null, [plantIds.join(',')]);
  const sumById = useMemo(() => new Map((summaries || []).map((s) => [s.material_id, s])), [summaries]);
  const [cell, setCell] = useState<{ fsn: string; abc: string } | null>(null);
  const [material, setMaterial] = useState<Material | null>(null);
  const [search, setSearch] = useState('');

  // Level 3 — full 360; back returns to the filtered SKU list (cell preserved).
  if (material) return <MaterialAnalysis material={material} onBack={() => setMaterial(null)} />;

  const k = data?.kpis || {};
  const cellMap = useMemo(() => {
    const m: Record<string, any> = {};
    for (const c of data?.cells || []) m[`${c.fsn}|${c.abc}`] = c;
    return m;
  }, [data]);
  const maxSav = useMemo(() => Math.max(1, ...(data?.cells || []).map((c: any) => c.savings)), [data]);
  const abcMap: Record<string, string> = data?.abc || {};

  const drillMats = useMemo(() => {
    if (!cell) return [];
    return MATERIALS.filter((m) => plantIds.includes(m.plant_id) && m.fsn === cell.fsn && abcMap[m.id] === cell.abc)
      .filter((m) => !search || m.description.toLowerCase().includes(search.toLowerCase()) || m.id.includes(search))
      .sort((a, b) => b.current_stock_value - a.current_stock_value);
  }, [cell, plantIds, abcMap, search]);

  // heat tone for a cell by savings share
  const heat = (sav: number) => {
    const r = sav / maxSav;
    return r > 0.5 ? 'border-rose-300/50 bg-rose-500/10 dark:border-rose-500/25' : r > 0.2 ? 'border-amber-300/50 bg-amber-500/10 dark:border-amber-500/25' : r > 0.02 ? 'border-accent-300/40 bg-accent-500/8 dark:border-accent-500/20' : 'border-navy-100 bg-white dark:border-slate-800 dark:bg-[#211c33]';
  };

  if (cell) {
    return (
      <div className="px-6 py-5">
        <button onClick={() => { setCell(null); setSearch(''); }} className="mb-3 inline-flex items-center gap-1.5 rounded-lg border border-navy-200 px-2.5 py-1 text-[13px] font-medium text-navy-600 hover:bg-navy-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-white/5">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to matrix
        </button>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-[19.5px] font-semibold tracking-tight">{cell.fsn}-moving · Class {cell.abc}</h1>
            <p className="text-[13.5px] text-navy-500 dark:text-slate-500">{drillMats.length} SKUs · {money(cellMap[`${cell.fsn}|${cell.abc}`]?.stock_value || 0)} stock · <span className="text-amber-600 dark:text-amber-400">{money(cellMap[`${cell.fsn}|${cell.abc}`]?.savings || 0)} savings potential</span> · suggested: <b>{ACTION_LABEL[cellMap[`${cell.fsn}|${cell.abc}`]?.action] || '—'}</b></p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-navy-200 bg-white px-2.5 py-1 dark:border-slate-700 dark:bg-slate-900">
            <Search className="h-3.5 w-3.5 text-navy-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search SKU…" className="w-44 border-none bg-transparent text-[13.5px] outline-none placeholder:text-navy-400 dark:text-slate-200" />
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-navy-100 bg-white dark:border-slate-800 dark:bg-[#211c33]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-[13.5px]">
              <thead><tr className="border-b border-navy-100 text-left text-[11.5px] uppercase tracking-wide text-navy-400 dark:border-slate-800 dark:text-slate-500">
                <th className="px-4 py-2 font-semibold">Material</th><th className="px-3 py-2 font-semibold">Class</th><th className="px-3 py-2 font-semibold">Demand</th>
                <th className="px-3 py-2 text-right font-semibold">SOH</th><th className="px-3 py-2 text-right font-semibold">Cover</th><th className="px-3 py-2 text-right font-semibold">Stock value</th><th className="px-3 py-2 font-semibold">Status</th><th className="px-3 py-2"></th>
              </tr></thead>
              <tbody>{drillMats.slice(0, 60).map((m) => {
                const s = sumById.get(m.id); const st = statusOf(m, s);
                return (
                  <tr key={m.id} onClick={() => setMaterial(m)} className="cursor-pointer border-b border-navy-50 last:border-0 hover:bg-navy-50/60 dark:border-slate-800/60 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-2.5"><div className="font-medium">{m.description}</div><div className="font-mono text-[11.5px] text-navy-400 dark:text-slate-500">{m.id} · {m.plant_id}</div></td>
                    <td className="px-3 py-2.5 text-navy-500 dark:text-slate-400">{m.xyz}·{m.fsn[0]}·{m.ved[0]}</td>
                    <td className={`px-3 py-2.5 capitalize ${PATTERN_TONE[s?.demand_pattern || ''] || 'text-navy-400 dark:text-slate-500'}`}>{s?.demand_pattern?.replace('_', ' ') || '—'}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{m.on_hand_qty}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{m.coverage_days}d</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{money(m.current_stock_value)}</td>
                    <td className="px-3 py-2.5"><span className={`rounded px-1.5 py-0.5 text-[11.5px] font-semibold ${st.tone}`}>{st.label}</span></td>
                    <td className="px-3 py-2.5 text-right"><ChevronRight className="ml-auto h-4 w-4 text-navy-300 dark:text-slate-600" /></td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-5">
      <div className="mb-4">
        <h1 className="flex items-center gap-2 text-[20px] font-semibold tracking-tight"><Sparkles className="h-5 w-5 text-accent-500" /> Savings Wizard</h1>
        <p className="text-[14px] text-navy-500 dark:text-slate-500">Opportunity across the FSN × ABC matrix. Click any tile to drill into those SKUs and their 360° analysis.</p>
      </div>

      {/* comprehensive KPI band */}
      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-8">
        <Kpi value={money(k.total_inventory || 0)} label="Total inventory" sub={`${k.sku_count || 0} SKUs`} />
        <Kpi value={money(k.total_opportunity || 0)} label="Total opportunity" sub="identified" tone="amber" />
        <Kpi value={money(k.working_capital_release || 0)} label="Working capital" sub="releasable" tone="mint" />
        <Kpi value={money(k.surplus_stock || 0)} label="Surplus / excess" tone="violet" />
        <Kpi value={money(k.obsolete_stock || 0)} label="Obsolete stock" tone="rose" />
        <Kpi value={money(k.safety_stock || 0)} label="Safety stock" sub="optimal policy" />
        <Kpi value={`${k.service_level || 0}%`} label="Service level" sub={`turns ${k.inventory_turns || 0}×`} tone={k.service_level < 92 ? 'amber' : 'mint'} />
        <Kpi value={String(k.at_risk_skus || 0)} label="At stockout risk" sub="below reorder" tone="rose" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
        {/* FSN × ABC matrix */}
        <div className="rounded-xl border border-navy-100 bg-white p-4 dark:border-slate-800 dark:bg-[#211c33]">
          <div className="mb-3 text-[14px] font-semibold">Opportunity matrix <span className="text-[12.5px] font-normal text-navy-400 dark:text-slate-500">movement (FSN) × value (ABC) — # SKUs · value · savings</span></div>
          <div className="grid grid-cols-[70px_repeat(3,1fr)] gap-2">
            <div />
            {ABC_COLS.map((a) => <div key={a} className="pb-1 text-center text-[12px] font-semibold text-navy-500 dark:text-slate-400">{a} <span className="font-normal text-navy-400 dark:text-slate-500">· {ABC_SUB[a]}</span></div>)}
            {FSN_ROWS.map((f) => (
              <Fragment key={f}>
                <div className="flex items-center text-[12.5px] font-semibold text-navy-500 dark:text-slate-400">{f}</div>
                {ABC_COLS.map((a) => {
                  const c = cellMap[`${f}|${a}`];
                  const sav = c?.savings || 0;
                  return (
                    <button key={a} onClick={() => c?.sku_count && setCell({ fsn: f, abc: a })} disabled={!c?.sku_count}
                      className={`rounded-lg border p-2.5 text-left transition-all ${heat(sav)} ${c?.sku_count ? 'hover:shadow-md hover:ring-1 hover:ring-accent-400/40' : 'opacity-50'}`}>
                      <div className="text-[21px] font-semibold leading-none tracking-tight">{c?.sku_count || 0}</div>
                      <div className="mt-0.5 text-[10.5px] uppercase tracking-wide text-navy-400 dark:text-slate-500">SKUs</div>
                      <div className="mt-1.5 text-[11.5px] text-navy-500 dark:text-slate-400">{money(c?.stock_value || 0)}</div>
                      <div className="text-[12.5px] font-semibold text-amber-600 dark:text-amber-400">{money(sav)}</div>
                      {c?.sku_count > 0 && <div className="mt-1 inline-block rounded bg-navy-100 px-1.5 py-0.5 text-[9.5px] font-medium text-navy-500 dark:bg-slate-800 dark:text-slate-400">{ACTION_LABEL[c.action]}</div>}
                    </button>
                  );
                })}
              </Fragment>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3 text-[11.5px] text-navy-400 dark:text-slate-500">
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-rose-500/40" /> high savings</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-amber-500/40" /> medium</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-accent-500/30" /> low</span>
          </div>
        </div>

        {/* Insights */}
        <div className="rounded-xl border border-navy-100 bg-white p-4 dark:border-slate-800 dark:bg-[#211c33]">
          <div className="mb-2.5 flex items-center gap-1.5 text-[14px] font-semibold"><Lightbulb className="h-4 w-4 text-amber-500" /> Insights</div>
          <div className="space-y-3">
            {(data?.insights || []).map((t: string, i: number) => <Insight key={i} text={t} />)}
            {!data && <p className="text-[13px] text-navy-400 dark:text-slate-500">Analyzing…</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
