import { useMemo, useState } from 'react';
import {
  Sparkles, ArrowLeft, Search, ChevronRight, Layers, Ban, ArrowLeftRight, Truck,
  AlertTriangle, ArrowRight, Grid3x3, LayoutGrid,
} from 'lucide-react';
import { MATERIALS } from '../../data/inventoryMock';
import type { Material } from '../../types/inventory';
import { getSavingsMatrix, getMatrixNarrative, getOpportunities, fetchForecastSummaries } from '../../services/inventoryApi';
import { useLiveOrMock } from './useLiveData';
import MaterialAnalysis from './MaterialAnalysis';
import SkuGrid from './SkuGrid';

const money = (n: number) => (Math.abs(n) >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : Math.abs(n) >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${Math.round(n)}`);
const TT: Record<string, string> = { rose: 'text-rose-600 dark:text-rose-400', amber: 'text-amber-600 dark:text-amber-400', mint: 'text-emerald-600 dark:text-emerald-400', violet: 'text-violet-600 dark:text-violet-400', accent: 'text-accent-600 dark:text-accent-400' };
const GRAD: Record<string, string> = { rose: 'from-rose-400 to-rose-600', amber: 'from-amber-400 to-amber-600', mint: 'from-emerald-400 to-emerald-600', violet: 'from-violet-400 to-violet-600', accent: 'from-accent-400 to-accent-600' };
const SOFT_TONE: Record<string, string> = { mint: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', amber: 'bg-amber-500/15 text-amber-600 dark:text-amber-400', rose: 'bg-rose-500/15 text-rose-600 dark:text-rose-400' };
const FSN_DOT: Record<string, string> = { Fast: 'bg-emerald-500', Slow: 'bg-amber-500', 'Non-moving': 'bg-rose-500' };
const FSN_TONE: Record<string, string> = { Fast: 'mint', Slow: 'amber', 'Non-moving': 'rose' };
const fsnLabel = (f: string) => (f === 'Non-moving' ? 'Non-moving' : `${f}-moving`);
const FSN_ROWS = ['Fast', 'Slow', 'Non-moving'];
const TIER_ORDER = ['A', 'B', 'C', 'D', 'E'];

function Kpi({ value, label, sub, tone }: { value: string; label: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-navy-100 bg-white p-3 dark:border-slate-800 dark:bg-[#211c33]">
      <div className={`text-[17px] font-semibold leading-none tracking-tight ${tone ? TT[tone] : ''}`}>{value}</div>
      <div className="mt-1.5 text-[10.5px] font-medium">{label}</div>
      {sub && <div className="text-[9.5px] text-navy-400 dark:text-slate-500">{sub}</div>}
    </div>
  );
}

interface Pocket { key: string; label: string; desc: string; savings: number; count: number; ids: string[]; icon: any; tone: string; risk?: boolean }

export default function SavingsPockets({ plantIds }: { plantIds: string[] }) {
  const keyDep = plantIds.join(',');
  const matrix = useLiveOrMock<any>(() => getSavingsMatrix(plantIds), null, [keyDep]);
  const narrative = useLiveOrMock<any>(() => getMatrixNarrative(plantIds), null, [keyDep]);
  const opps = useLiveOrMock<any>(() => getOpportunities(plantIds), null, [keyDep]);
  const summaries = useLiveOrMock(() => fetchForecastSummaries(plantIds), null, [keyDep]);
  const sumById = useMemo(() => new Map((summaries || []).map((s) => [s.material_id, s])), [summaries]);
  const [material, setMaterial] = useState<Material | null>(null);
  const [drill, setDrill] = useState<Pocket | { key: 'cell'; label: string; ids: string[]; savings: number } | null>(null);
  const [search, setSearch] = useState('');

  const POCKET_META: Record<string, { label: string; desc: string; icon: any; tone: string }> = {
    excess_inventory: { label: 'Excess & overstock', desc: 'stock held above the optimal policy', icon: Layers, tone: 'amber' },
    obsolete_stock: { label: 'Dead / obsolete', desc: 'no movement — write-off candidates', icon: Ban, tone: 'rose' },
    stock_transfer: { label: 'Rebalance across plants', desc: 'move excess to where it is short', icon: ArrowLeftRight, tone: 'accent' },
    supplier_consolidation: { label: 'Supplier consolidation', desc: 'fewer POs · leverage spend', icon: Truck, tone: 'mint' },
  };

  const pockets: Pocket[] = useMemo(() => {
    const out: Pocket[] = [];
    for (const g of opps?.groups || []) {
      const meta = POCKET_META[g.type];
      if (!meta || !g.count) continue;
      out.push({ key: g.type, label: meta.label, desc: meta.desc, savings: g.total_savings, count: g.count,
        ids: (g.items || []).map((it: any) => it.material_id), icon: meta.icon, tone: meta.tone });
    }
    // reorder / stockout-risk pocket — client-side from understocked SKUs
    const reorder = MATERIALS.filter((m) => plantIds.includes(m.plant_id) && (sumById.get(m.id)?.understocked || (m.coverage_days < 18 && m.ved !== 'Desirable')));
    if (reorder.length) out.push({ key: 'reorder', label: 'Reorder / stockout risk', desc: 'below reorder point — protect service', icon: AlertTriangle, tone: 'rose', savings: 0, count: reorder.length, ids: reorder.map((m) => m.id), risk: true });
    return out.sort((a, b) => b.savings - a.savings || b.count - a.count);
  }, [opps, sumById, plantIds]);

  const drillMats = useMemo(() => {
    if (!drill) return [];
    const set = new Set(drill.ids);
    return MATERIALS.filter((m) => set.has(m.id) && plantIds.includes(m.plant_id))
      .filter((m) => !search || m.description.toLowerCase().includes(search.toLowerCase()) || m.id.includes(search))
      .sort((a, b) => b.current_stock_value - a.current_stock_value);
  }, [drill, plantIds, search]);

  const cells = matrix?.cells || [];
  const tierMap: Record<string, string> = matrix?.tier || {};
  const cellMap = useMemo(() => { const m: Record<string, any> = {}; for (const c of cells) m[`${c.fsn}|${c.tier}`] = c; return m; }, [cells]);
  const k = matrix?.kpis || {};

  // ── all hooks above; safe to branch ──
  if (material) return <MaterialAnalysis material={material} onBack={() => setMaterial(null)} />;

  if (drill) {
    return (
      <div className="px-6 py-5">
        <button onClick={() => { setDrill(null); setSearch(''); }} className="mb-3 inline-flex items-center gap-1.5 rounded-lg border border-navy-200 px-2.5 py-1 text-[11.5px] font-medium text-navy-600 hover:bg-navy-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-white/5"><ArrowLeft className="h-3.5 w-3.5" /> Back</button>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-[18px] font-semibold tracking-tight">{drill.label}</h1>
            <p className="text-[12px] text-navy-500 dark:text-slate-500">{drillMats.length} SKUs{drill.savings ? <> · <span className="text-amber-600 dark:text-amber-400">{money(drill.savings)} savings potential</span></> : null} · click a SKU for its 360° analysis</p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-navy-200 bg-white px-2.5 py-1 dark:border-slate-700 dark:bg-slate-900"><Search className="h-3.5 w-3.5 text-navy-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search SKU…" className="w-44 border-none bg-transparent text-[12px] outline-none placeholder:text-navy-400 dark:text-slate-200" /></div>
        </div>
        <SkuGrid mats={drillMats} sumById={sumById} onOpen={setMaterial} />
      </div>
    );
  }

  const totalInv = k.total_inventory || 0;
  const surplus = k.surplus_stock || 0;
  const obsolete = k.obsolete_stock || 0;
  const optimized = Math.max(0, totalInv - surplus - obsolete);
  const seg = (v: number) => (totalInv ? `${(v / totalInv) * 100}%` : '0%');
  const totalOpp = pockets.reduce((n, p) => n + p.savings, 0) || 1;

  return (
    <div className="px-6 py-5">
      <div className="mb-4">
        <h1 className="flex items-center gap-2 text-[19px] font-semibold tracking-tight"><Sparkles className="h-5 w-5 text-accent-500" /> Savings Wizard</h1>
        <p className="text-[12.5px] text-navy-500 dark:text-slate-500">Where your working capital is trapped, and the action to free it. Click a tile or pocket → its SKUs → the 360° analysis.</p>
      </div>

      {/* Savings bridge — where the money is */}
      <div className="mb-4 rounded-xl border border-navy-100 bg-white p-4 dark:border-slate-800 dark:bg-[#211c33]">
        <div className="mb-1.5 text-[13px] font-semibold">You're holding <span className="text-accent-600 dark:text-accent-300">{money(totalInv)}</span> across {k.sku_count || 0} SKUs — <span className="text-amber-600 dark:text-amber-400">{money(surplus + obsolete)} is optimization opportunity</span>.</div>
        <div className="mb-2 text-[11px] text-navy-500 dark:text-slate-500">Rightsizing to the optimal policy releases working capital and writes off dead stock, landing you at an optimized ~{money(optimized)}.</div>
        <div className="flex h-8 w-full overflow-hidden rounded-lg">
          <div className="flex items-center justify-center bg-emerald-500/80 text-[10px] font-semibold text-white" style={{ width: seg(optimized) }} title="Optimized">{surplus + obsolete < totalInv * 0.9 ? 'Optimized' : ''}</div>
          <div className="flex items-center justify-center bg-amber-500/80 text-[10px] font-semibold text-white" style={{ width: seg(surplus) }} title="Excess">{surplus > totalInv * 0.08 ? money(surplus) : ''}</div>
          <div className="flex items-center justify-center bg-rose-500/80 text-[10px] font-semibold text-white" style={{ width: seg(obsolete) }} title="Obsolete">{obsolete > totalInv * 0.05 ? money(obsolete) : ''}</div>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-3 text-[10px] text-navy-500 dark:text-slate-400">
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500/80" /> Optimized {money(optimized)}</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-amber-500/80" /> Excess / overstock {money(surplus)}</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-rose-500/80" /> Obsolete {money(obsolete)}</span>
        </div>
      </div>

      {/* KPI band */}
      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-8">
        <Kpi value={money(totalInv)} label="Total inventory" sub={`${k.sku_count || 0} SKUs`} />
        <Kpi value={money(k.total_opportunity || 0)} label="Total opportunity" tone="amber" />
        <Kpi value={money(k.working_capital_release || 0)} label="Working capital" sub="releasable" tone="mint" />
        <Kpi value={money(surplus)} label="Surplus / excess" tone="violet" />
        <Kpi value={money(obsolete)} label="Obsolete" tone="rose" />
        <Kpi value={money(k.safety_stock || 0)} label="Safety stock" sub="optimal" />
        <Kpi value={`${k.service_level || 0}%`} label="Service level" sub={`turns ${k.inventory_turns || 0}×`} tone={k.service_level < 92 ? 'amber' : 'mint'} />
        <Kpi value={String(k.at_risk_skus || 0)} label="At stockout risk" tone="rose" />
      </div>

      {/* Opportunity matrix */}
      <div className="mb-2 flex items-center gap-2">
        <Grid3x3 className="h-4 w-4 text-accent-500" />
        <span className="text-[13px] font-semibold">Opportunity matrix</span>
        <span className="text-[11px] text-navy-400 dark:text-slate-500">Fast / Slow / Non-moving × maintenance criticality — click a tile for its SKUs</span>
      </div>
      <div className="mb-6">
        <div>
          {(
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {FSN_ROWS.map((f) => {
                const colCells = TIER_ORDER.map((t) => cellMap[`${f}|${t}`]).filter(Boolean);
                const colOpps = colCells.reduce((n, c) => n + (c.opp_count || 0), 0);
                const colSav = colCells.reduce((n, c) => n + (c.savings || 0), 0);
                const tone = FSN_TONE[f];
                return (
                  <div key={f} className="overflow-hidden rounded-xl border border-navy-100 bg-white dark:border-slate-800 dark:bg-[#211c33]">
                    <div className="flex items-center justify-between border-b border-navy-100 px-3.5 py-2.5 dark:border-slate-800">
                      <div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${FSN_DOT[f]}`} /><span className="text-[12.5px] font-semibold">{fsnLabel(f)}</span></div>
                      <span className="text-[10px] text-navy-400 dark:text-slate-500">{colOpps} opps · {money(colSav)}</span>
                    </div>
                    <div className="space-y-2 p-2.5">
                      {TIER_ORDER.map((t) => {
                        const c = cellMap[`${f}|${t}`];
                        if (!c || !c.opp_count) return null;
                        return (
                          <button key={t} onClick={() => setDrill({ key: 'cell', label: `${fsnLabel(f)} · ${c.tier_label}`, ids: MATERIALS.filter((m) => plantIds.includes(m.plant_id) && m.fsn === f && tierMap[m.id] === t).map((m) => m.id), savings: c.savings })}
                            className="flex w-full items-start gap-3 rounded-lg border border-navy-100 p-2.5 text-left transition-all hover:border-accent-300 hover:bg-navy-50/50 dark:border-slate-800 dark:hover:border-accent-500/40 dark:hover:bg-slate-800/40">
                            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${SOFT_TONE[tone]}`}><span className="text-[18px] font-bold leading-none">{c.opp_count}</span></div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5"><span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${SOFT_TONE[tone]}`}>{c.tier}</span><span className="text-[11px] font-semibold">{c.tier_label}</span></div>
                              <div className="mt-0.5 text-[10.5px] leading-snug text-navy-500 dark:text-slate-400">{narrative?.cells?.[`${f}|${t}`] || c.narration}</div>
                              <div className="mt-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">{money(c.savings)} · {c.sku_count} SKUs</div>
                            </div>
                            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-navy-300 dark:text-slate-600" />
                          </button>
                        );
                      })}
                      {colOpps === 0 && <div className="px-2 py-4 text-center text-[10.5px] text-navy-400 dark:text-slate-500">No material opportunities</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Savings pockets */}
      <div className="mb-2 flex items-center gap-2">
        <LayoutGrid className="h-4 w-4 text-accent-500" />
        <span className="text-[13px] font-semibold">Savings pockets</span>
        <span className="text-[11px] text-navy-400 dark:text-slate-500">the same opportunity grouped by the play that frees it</span>
      </div>
      <div>
        <div>
          {(
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {pockets.map((p) => {
                const Icon = p.icon; const pct = Math.round((p.savings / totalOpp) * 100);
                return (
                  <button key={p.key} onClick={() => setDrill(p)} className="group relative overflow-hidden rounded-2xl border border-navy-100 bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:border-navy-200 hover:shadow-lg dark:border-slate-800 dark:bg-[#211c33] dark:hover:border-slate-700">
                    <div className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br ${GRAD[p.tone]} opacity-[0.13] blur-2xl`} />
                    <div className="relative flex items-center gap-2.5">
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${GRAD[p.tone]} text-white shadow-sm`}><Icon style={{ width: 19, height: 19 }} /></span>
                      <div className="min-w-0"><div className="text-[13.5px] font-semibold leading-tight">{p.label}</div><div className="truncate text-[10px] text-navy-400 dark:text-slate-500">{p.desc}</div></div>
                    </div>
                    <div className="relative mt-3.5 flex items-end justify-between">
                      <div>
                        <div className={`text-[27px] font-bold leading-none tracking-tight ${p.risk ? TT.rose : TT.amber}`}>{p.risk ? p.count : money(p.savings)}</div>
                        <div className="mt-1 text-[9.5px] font-medium uppercase tracking-wide text-navy-400 dark:text-slate-500">{p.risk ? 'SKUs at stockout risk' : 'savings potential'}</div>
                      </div>
                      <div className="text-right text-[10px] text-navy-500 dark:text-slate-400"><div className="text-[13px] font-semibold text-navy-800 dark:text-slate-200">{p.count}</div><div>SKUs{!p.risk ? ` · ${pct}%` : ''}</div></div>
                    </div>
                    {!p.risk && <div className="relative mt-3 h-2 w-full overflow-hidden rounded-full bg-navy-100 dark:bg-slate-800/80"><div className={`h-full rounded-full bg-gradient-to-r ${GRAD[p.tone]}`} style={{ width: `${Math.max(4, pct)}%` }} /></div>}
                    <div className={`relative mt-3 inline-flex items-center gap-1 text-[10.5px] font-semibold ${TT[p.tone]} opacity-80 transition-opacity group-hover:opacity-100`}>View SKUs <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" /></div>
                  </button>
                );
              })}
              {!opps && <div className="col-span-full py-10 text-center text-[12px] text-navy-400 dark:text-slate-500">Finding your savings pockets…</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
