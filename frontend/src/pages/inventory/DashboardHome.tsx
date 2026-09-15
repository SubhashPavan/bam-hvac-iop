import { useMemo, useState } from 'react';
import {
  Area, Line, BarChart, Bar, ComposedChart, Cell,
  ScatterChart, Scatter, ReferenceDot, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import {
  TrendingUp, ShieldAlert, Boxes, Coins, Target, Zap, Layers, LineChart as LineIcon, FlaskConical, AlertTriangle, Globe,
} from 'lucide-react';
import {
  PLANTS, plantTrends, makeForecast, availabilityRisk, savingsFunnel, savingsPipeline, plantBenchmark,
  abcXyzMatrix, demandByClass, forecastItems, tradeoffCurve, simulateService, type ForecastResult,
} from '../../data/inventoryMock';
import { REC_TYPE_LABEL, type Material, type Recommendation, type RecommendationType } from '../../types/inventory';
import { useRequestStore } from '../../store/requestStore';
import PlantsMap from './PlantsMap';
import { useLiveOrMock, useDebounced } from './useLiveData';
import { fetchForecastSummaries, fetchTradeoff, fetchSimulate, getForecast, getSavingsMatrix } from '../../services/inventoryApi';

const money = (n: number) => (Math.abs(n) >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : Math.abs(n) >= 1_000 ? `$${(n / 1_000).toFixed(0)}K` : `$${Math.round(n)}`);
const plantName = (id: string) => PLANTS.find((p) => p.id === id)?.name || id;

const C = { indigo: '#6366f1', amber: '#f59e0b', mint: '#22c55e', rose: '#f43f5e', violet: '#8b5cf6', cyan: '#0891b2' };
const AXIS = 'text-navy-400 dark:text-slate-500';
const GRID = 'text-navy-100 dark:text-slate-800';
const tip = { fontSize: 11, borderRadius: 8, border: '1px solid rgba(120,120,140,0.2)' };

type Tab = 'overview' | 'forecasting' | 'simulation' | 'availability' | 'plants';
const TABS: { k: Tab; label: string; icon: typeof Layers }[] = [
  { k: 'overview', label: 'Overview', icon: Layers },
  { k: 'forecasting', label: 'Forecasting', icon: LineIcon },
  { k: 'simulation', label: 'Simulation', icon: FlaskConical },
  { k: 'availability', label: 'Availability & Risk', icon: ShieldAlert },
  { k: 'plants', label: 'Plants', icon: Globe },
];

type Props = { mats: Material[]; recs: Recommendation[]; selected: string[]; period: number; onNavigate: (v: string) => void; onSubmit: (id: string, label: string) => void };

export default function DashboardHome({ mats, recs, selected, period, onNavigate, onSubmit }: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  return (
    <div className="px-5 py-4">
      <div className="mb-4">
        <div className="text-[11.5px] text-navy-500 dark:text-slate-400">Good morning · <span className="font-medium text-accent-600 dark:text-accent-400">{recs.length} recommendations need you</span> across {selected.map(plantName).join(', ')}</div>
        <div className="text-[20px] font-semibold tracking-tight">Inventory planning cockpit</div>
      </div>
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-navy-100 dark:border-slate-800">
        {TABS.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)} className={`-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3.5 py-2 text-[12.5px] font-medium ${tab === t.k ? 'border-accent-500 text-navy-900 dark:text-slate-100' : 'border-transparent text-navy-400 hover:text-navy-600 dark:text-slate-500 dark:hover:text-slate-300'}`}><t.icon className="h-3.5 w-3.5" />{t.label}</button>
        ))}
      </div>
      {tab === 'overview' && <OverviewTab mats={mats} recs={recs} selected={selected} period={period} onSubmit={onSubmit} />}
      {tab === 'forecasting' && <ForecastingTab selected={selected} />}
      {tab === 'simulation' && <SimulationTab selected={selected} onNavigate={onNavigate} />}
      {tab === 'availability' && <AvailabilityTab selected={selected} recs={recs} onSubmit={onSubmit} />}
      {tab === 'plants' && <PlantsMap selected={selected} embedded />}
    </div>
  );
}

/* ── Overview: 8 tiles · value-vs-target · savings pipeline · classification · recommendations rail ── */
const REC_TONE: Record<RecommendationType, string> = {
  reduce_stock: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  dispose: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
  increase_stock: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  keep_unchanged: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400',
  emergency_action: 'bg-red-500/20 text-red-600 dark:text-red-400',
};
function OverviewTab({ mats, recs, selected, period, onSubmit }: { mats: Material[]; recs: Recommendation[]; selected: string[]; period: number; onSubmit: (id: string, label: string) => void }) {
  const inventory = mats.reduce((n, m) => n + m.current_stock_value, 0);
  const savings = recs.reduce((n, r) => n + r.savings_potential, 0);
  const f = useMemo(() => savingsFunnel(recs), [recs]);
  const pipeline = useMemo(() => savingsPipeline(recs), [recs]);
  const trends = useMemo(() => plantTrends(selected, period), [selected, period]);
  const bench = useMemo(() => plantBenchmark(selected), [selected]);
  const matrix = useMemo(() => abcXyzMatrix(selected), [selected]);

  const plants = PLANTS.filter((p) => selected.includes(p.id));
  const worstSl = plants.length ? Math.min(...plants.map((p) => p.service_level)) : 0;
  const dead = mats.filter((m) => m.fsn === 'Non-moving');
  const deadVal = dead.reduce((n, m) => n + m.current_stock_value, 0);
  const stockouts = mats.filter((m) => m.coverage_days < 10).length;
  const first = trends[0], last = trends[trends.length - 1];
  const turnsDelta = Math.round((last.turns - first.turns) * 10) / 10;
  const dio = Math.round(365 / last.turns);
  const wcReleased = f.cashReleased > 0 ? f.cashReleased : Math.round(savings * 0.28);
  const invVsTarget = trends.map((p, i) => ({ ...p, target: Math.round(trends[0].inventory * (0.98 - 0.02 * i)) }));

  // Headline tiles reconcile with the Savings Wizard: read the same savings-matrix KPIs
  // (fall back to the mock-derived values when the backend is unreachable).
  const wiz = useLiveOrMock<any>(() => getSavingsMatrix(selected), null, [selected.join(',')]);
  const k = wiz?.kpis;
  const kInv = k ? k.total_inventory : inventory;
  const kSav = k ? k.total_opportunity : savings;
  const kSvc = k ? k.service_level : worstSl;
  const kWc = k ? k.working_capital_release : wcReleased;
  const kTurns = k ? k.inventory_turns : last.turns;
  const kDio = k && k.inventory_turns ? Math.round(365 / k.inventory_turns) : dio;
  const kObs = k ? k.obsolete_stock : deadVal;
  const kRisk = k ? k.at_risk_skus : stockouts;
  const kSkus = k ? k.sku_count : mats.length;

  const ABC = ['A', 'B', 'C'] as const; const XYZ = ['X', 'Y', 'Z'] as const;
  const w: Record<string, number> = { A: 3, B: 2, C: 1, X: 1, Y: 2, Z: 3 };
  const cell = (r: string, c: string) => matrix.find((m) => m.row === r && m.col === c)!;
  const tone = (r: string, c: string) => { const s = w[r] * w[c]; return s >= 8 ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300' : s >= 5 ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : s >= 3 ? 'bg-accent-500/10 text-accent-700 dark:text-accent-300' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'; };
  const topRecs = [...recs].sort((a, b) => (b.type === 'emergency_action' ? 1 : 0) - (a.type === 'emergency_action' ? 1 : 0) || b.savings_potential - a.savings_potential).slice(0, 12);

  return (
    <div className="space-y-4">
      {/* 8 tiles */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Stat value={money(kInv)} label="Total inventory value" sub={`${kSkus} SKUs`} />
        <Stat value={money(kSav)} label="Total opportunity" tone="amber" sub="AI-identified" />
        <Stat value={`${kSvc}%`} label="Service level" tone={kSvc < 92 ? 'rose' : 'mint'} sub="target 95%" />
        <Stat value={money(kWc)} label="Working capital" tone="mint" sub="releasable" />
        <Stat value={`${kTurns}×`} label="Inventory turns" tone={kTurns < 2 ? 'amber' : 'mint'} sub={`${turnsDelta >= 0 ? '+' : ''}${turnsDelta} YoY`} />
        <Stat value={`${kDio}d`} label="Days inv. outstanding" sub="DIO" />
        <Stat value={money(kObs)} label="Obsolete stock" tone="rose" sub={`${dead.length} items`} />
        <Stat value={String(kRisk)} label="At stockout risk" tone={kRisk > 0 ? 'rose' : 'mint'} sub="below reorder point" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Panel title="Inventory value vs target" sub={`trailing ${period} months`}>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={invVsTarget} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <defs><linearGradient id="ovVal" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.indigo} stopOpacity={0.35} /><stop offset="100%" stopColor={C.indigo} stopOpacity={0.03} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className={GRID} />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="currentColor" className={AXIS} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={money} stroke="currentColor" className={AXIS} />
                  <Tooltip formatter={(v) => money(Number(v))} contentStyle={tip} />
                  <Area type="monotone" dataKey="inventory" name="Actual" stroke={C.indigo} strokeWidth={2} fill="url(#ovVal)" />
                  <Line type="monotone" dataKey="target" name="Target" stroke={C.mint} strokeDasharray="5 4" strokeWidth={1.6} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Savings pipeline" sub="identified → approved → implemented → realized · by quarter">
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pipeline} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className={GRID} />
                  <XAxis dataKey="quarter" tick={{ fontSize: 10 }} stroke="currentColor" className={AXIS} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={money} stroke="currentColor" className={AXIS} />
                  <Tooltip formatter={(v) => money(Number(v))} contentStyle={tip} />
                  <Bar dataKey="identified" name="Identified" fill={C.indigo} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="approved" name="Approved" fill={C.violet} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="implemented" name="Implemented" fill={C.cyan} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="realized" name="Realized" fill={C.mint} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="Classification — ABC × XYZ" sub="value × demand variability">
              <div className="overflow-x-auto">
                <table className="min-w-[300px] border-separate" style={{ borderSpacing: 3 }}>
                  <thead><tr><th /><th className="pb-1 text-[9px] font-semibold text-navy-400 dark:text-slate-500">X</th><th className="pb-1 text-[9px] font-semibold text-navy-400 dark:text-slate-500">Y</th><th className="pb-1 text-[9px] font-semibold text-navy-400 dark:text-slate-500">Z</th></tr></thead>
                  <tbody>
                    {ABC.map((r) => (
                      <tr key={r}>
                        <td className="pr-1.5 text-right text-[9px] font-semibold text-navy-400 dark:text-slate-500">{r}</td>
                        {XYZ.map((c) => { const x = cell(r, c); return <td key={c}><div className={`min-w-[64px] rounded-md p-1.5 ${tone(r, c)}`}><div className="text-[11px] font-semibold leading-none">{money(x.value)}</div><div className="mt-0.5 text-[8.5px] opacity-80">{x.count}</div></div></td>; })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
            <Panel title="Plant performance" sub="value & service by plant">
              <div className="h-[150px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bench} layout="vertical" margin={{ left: 8, right: 12, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="currentColor" className={GRID} />
                    <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={money} stroke="currentColor" className={AXIS} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={58} stroke="currentColor" className={AXIS} />
                    <Tooltip formatter={(v) => money(Number(v))} contentStyle={tip} />
                    <Bar dataKey="inventory" name="Inventory" radius={[0, 4, 4, 0]}>{bench.map((b, i) => <Cell key={i} fill={b.service < 90 ? C.rose : C.indigo} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-1 flex flex-col gap-1">
                {bench.map((b) => <div key={b.id} className="flex items-center gap-2 text-[11px]"><span className="flex-1 truncate">{b.name}</span><span className={`font-medium ${b.service < 90 ? 'text-rose-600 dark:text-rose-400' : ''}`}>{b.service}%</span><span className="text-navy-400 dark:text-slate-500">{b.turns}×</span></div>)}
              </div>
            </Panel>
          </div>
        </div>

        {/* Recommendations rail */}
        <div className="rounded-xl border border-navy-100 bg-white p-3.5 dark:border-slate-800 dark:bg-[#211c33]">
          <div className="mb-2 flex items-center gap-2"><span className="text-[12.5px] font-semibold">Recommendations</span><span className="ml-auto rounded-full bg-accent-500/10 px-2 py-0.5 text-[10px] font-semibold text-accent-600 dark:text-accent-400">{recs.length}</span></div>
          <div className="custom-scrollbar flex max-h-[640px] flex-col gap-2 overflow-y-auto pr-1">
            {topRecs.map((r) => {
              const emg = r.type === 'emergency_action';
              return (
                <div key={r.id} className={`rounded-lg border-l-2 p-2.5 ${emg ? 'border-l-rose-500 border border-rose-300/40 bg-rose-50/60 dark:border-rose-500/30 dark:bg-rose-500/10' : 'border-l-accent-400 border border-navy-100 dark:border-slate-800'}`}>
                  <div className="flex items-center gap-1.5">
                    <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${REC_TONE[r.type]}`}>{REC_TYPE_LABEL[r.type]}</span>
                    <span className="ml-auto text-[9.5px] text-navy-400 dark:text-slate-500">{emg ? 'urgent' : `${r.confidence}%`}</span>
                  </div>
                  <div className="mt-1.5 text-[11.5px] font-medium leading-tight">{r.material_desc}</div>
                  <div className="text-[10px] text-navy-400 dark:text-slate-500">{r.plant_id} · {money(r.savings_potential)} savings</div>
                  <button onClick={() => onSubmit(r.id, r.material_desc)} className={`mt-2 w-full rounded-md py-1.5 text-[10.5px] font-semibold text-white ${emg ? 'bg-rose-500 hover:bg-rose-600' : 'bg-accent-500 hover:bg-accent-600'}`}>{emg ? 'Act now' : 'Act'}</button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Forecasting: insight → class patterns → items → graph ──────── */
/** Map the backend's real forecast (/forecast/{id}) into the view's ForecastResult. */
async function liveForecast(item: Material): Promise<ForecastResult> {
  const d = await getForecast(item.id);
  return {
    material: item,
    horizonM: d.horizon_m ?? 12,
    model_accuracy: d.accuracy?.model_accuracy ?? 0,
    avg_monthly_demand: d.per_period_demand ?? 0,
    forecast_confidence: d.forecast_confidence ?? d.accuracy?.model_accuracy ?? 0,
    total_forecast_qty: d.total_forecast_qty ?? 0,
    demand_pattern: d.demand_pattern ?? '',
    points: (d.points || []).map((p: any) => ({
      label: p.label, actual: p.actual, forecast: p.forecast, lower: p.lower, upper: p.upper,
    })),
    insight: d.insight ?? '',
  };
}

function ForecastingTab({ selected }: { selected: string[] }) {
  const byClass = useMemo(() => demandByClass(selected), [selected]);
  const mockItems = useMemo(() => forecastItems(selected), [selected]);
  // Overlay real backend forecast metrics (method / accuracy / trend) onto the live items.
  const liveSummaries = useLiveOrMock(() => fetchForecastSummaries(selected), null, [selected.join(',')]);
  const items = useMemo(() => {
    if (!liveSummaries) return mockItems;
    const byId = new Map(liveSummaries.map((s) => [s.material_id, s]));
    return mockItems.map((m) => {
      const s = byId.get(m.id);
      return s ? { ...m, fcAccuracy: s.model_accuracy, trendPct: s.trend_pct, method: s.method,
                   understocked: s.understocked } : m;
    });
  }, [mockItems, liveSummaries]);
  const [selId, setSelId] = useState(items[0]?.id);
  const item = items.find((i) => i.id === selId) || items[0];
  // Real ML forecast for the selected item (Croston/SBA/TSB + prediction bands + policy insight).
  const mockFc = useMemo(() => (item ? makeForecast(item, 12) : null), [item]);
  const fc = useLiveOrMock<ForecastResult | null>(
    () => (item ? liveForecast(item) : Promise.resolve(null)), mockFc, [item?.id]);
  const rising = items.filter((i) => i.trendPct > 5).length;
  const declining = items.filter((i) => i.trendPct < -5).length;
  const intermittent = items.filter((i) => i.xyz === 'Z').length;
  const understocked = items.filter((i) => i.understocked).length;
  const avgAcc = Math.round(items.reduce((n, i) => n + i.fcAccuracy, 0) / Math.max(1, items.length));
  const safetyStock = item ? Math.round(item.avg_monthly_demand * 1.5) : 0;

  return (
    <div className="space-y-4">
      {/* Insight band */}
      <div className="rounded-xl border border-accent-300/40 bg-accent-500/5 px-4 py-3 dark:border-accent-500/25 dark:bg-accent-500/10">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-accent-600 dark:text-accent-400">Forecast read</div>
        <div className="text-[12.5px] text-navy-800 dark:text-slate-200"><b>{avgAcc}% avg accuracy</b> · {rising} SKUs trending up, {declining} down · <b>{intermittent} intermittent (Croston/SBA)</b> · <b className="text-amber-600 dark:text-amber-400">{understocked} under-stocked vs forecast</b></div>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Stat value={`${avgAcc}%`} label="Forecast accuracy" tone={avgAcc < 80 ? 'amber' : 'mint'} sub="MAPE-based" />
        <Stat value={String(rising)} label="Rising demand" tone="mint" sub="SKUs ↑" />
        <Stat value={String(intermittent)} label="Intermittent" tone="violet" sub="lumpy · Z-class" />
        <Stat value={String(understocked)} label="Under-stocked" tone="rose" sub="vs forecast need" />
      </div>

      <Panel title="Class-level demand patterns" sub="aggregated by category — where demand is moving">
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byClass} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className={GRID} />
              <XAxis dataKey="category" tick={{ fontSize: 9 }} interval={0} angle={-20} textAnchor="end" height={44} stroke="currentColor" className={AXIS} />
              <YAxis tick={{ fontSize: 10 }} stroke="currentColor" className={AXIS} />
              <Tooltip formatter={(v) => `${v} units/mo`} contentStyle={tip} />
              <Bar dataKey="avgDemand" name="Avg monthly demand" radius={[3, 3, 0, 0]}>{byClass.map((c, i) => <Cell key={i} fill={c.intermittent ? C.violet : C.indigo} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-1 text-[10.5px] text-navy-500 dark:text-slate-400"><span className="inline-block h-2 w-2 rounded-sm" style={{ background: C.violet }} /> intermittent categories use Croston / Syntetos-Boylan.</div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <Panel title="Items" sub="under-stocked first">
          <div className="custom-scrollbar max-h-[360px] space-y-1.5 overflow-y-auto pr-1">
            {items.slice(0, 30).map((m) => (
              <button key={m.id} onClick={() => setSelId(m.id)} className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left ${m.id === selId ? 'border-accent-400 bg-accent-500/10 dark:border-accent-500' : 'border-navy-100 hover:bg-navy-50 dark:border-slate-800 dark:hover:bg-slate-800/40'}`}>
                <div className="min-w-0 flex-1"><div className="truncate text-[11.5px] font-medium">{m.description}</div><div className="font-mono text-[9.5px] text-navy-400 dark:text-slate-500">{m.plant_id} · {m.xyz}-class · {m.method}</div></div>
                {m.understocked && <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-rose-600 dark:text-rose-400">low</span>}
                <span className={`text-[11px] font-semibold ${m.trendPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{m.trendPct >= 0 ? '+' : ''}{m.trendPct}%</span>
              </button>
            ))}
          </div>
        </Panel>

        {item && fc && (
          <Panel title={`${item.description}`} sub={`${item.id} · ${item.plant_id} · ${item.method} · ${item.fcAccuracy}% accuracy`}>
            <div className="mb-2 grid grid-cols-3 gap-2">
              <Stat value={String(fc.avg_monthly_demand)} label="Avg demand" sub="units/mo" />
              <Stat value={String(item.coverage_days) + 'd'} label="Current cover" tone={item.understocked ? 'rose' : undefined} sub={`safety ${safetyStock}`} />
              <Stat value={`${item.trendPct >= 0 ? '+' : ''}${item.trendPct}%`} label="Demand trend" tone={item.trendPct >= 0 ? 'mint' : 'rose'} sub="12-mo" />
            </div>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={fc.points} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className={GRID} />
                  <XAxis dataKey="label" tick={{ fontSize: 9 }} stroke="currentColor" className={AXIS} />
                  <YAxis tick={{ fontSize: 10 }} stroke="currentColor" className={AXIS} />
                  <Tooltip contentStyle={tip} />
                  <Line type="monotone" dataKey="upper" name="Upper CI" stroke={C.amber} strokeDasharray="4 3" strokeWidth={1} dot={false} />
                  <Line type="monotone" dataKey="lower" name="Lower CI" stroke={C.amber} strokeDasharray="4 3" strokeWidth={1} dot={false} />
                  <Line type="monotone" dataKey="forecast" name="Forecast" stroke={C.indigo} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="actual" name="Actual" stroke={C.mint} strokeWidth={2} dot={false} connectNulls={false} />
                  <ReferenceLine y={safetyStock} stroke={C.rose} strokeDasharray="5 4" strokeOpacity={0.7} label={{ value: 'safety stock', fontSize: 9, fill: C.rose, position: 'insideTopLeft' }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 rounded-lg bg-accent-500/5 p-2.5 text-[11.5px] text-navy-700 dark:bg-accent-500/10 dark:text-slate-300">{fc.insight}</div>
          </Panel>
        )}
      </div>
    </div>
  );
}

/* ── Simulation: tradeoff curve + policy what-ifs ───────────────── */
function SimulationTab({ selected, onNavigate }: { selected: string[]; onNavigate: (v: string) => void }) {
  const mockT = useMemo(() => tradeoffCurve(selected), [selected]);
  const t = useLiveOrMock(() => fetchTradeoff(selected), mockT, [selected.join(',')]);
  const [target, setTarget] = useState(mockT.currentService);
  const dTarget = useDebounced(target, 350);
  const mockSim = useMemo(() => simulateService(selected, dTarget), [selected, dTarget]);
  // Real Monte-Carlo simulation for the target service level.
  const sim = useLiveOrMock(() => fetchSimulate(selected, dTarget), mockSim, [selected.join(','), dTarget]);
  const curPoint = t.curve.find((p) => p.service === t.currentService) || t.curve[0];
  const saveSnapshot = useRequestStore((s) => s.saveSnapshot);
  const openAction = useRequestStore((s) => s.openAction);

  const draftFromSim = () => {
    const m = availabilityRisk(selected).atRisk[0];
    saveSnapshot({ scenario: `Target service ${target}% (from ${t.currentService}%)`, service: target, investment: sim.investment, stockoutRisk: sim.stockoutRisk, savedAt: new Date().toISOString() });
    if (m) openAction({ materialId: m.id, materialDesc: m.description, plantId: m.plant_id, kind: 'increase_stock', currentValue: m.current_stock_value, proposedValue: Math.round(m.current_stock_value * 1.3), savings: 0, cashRelease: 0, justification: 'Simulation shows the service target cannot be met without more safety stock on this vital spare. Raising safety stock — scenario attached as evidence.' });
    else onNavigate('recommendations');
  };

  const scenarios = [
    { key: 'delay', title: '3-week supplier delay', icon: AlertTriangle, tone: 'rose', stats: [['Service', '92% → 84%'], ['Vital breaches', '7 spares'], ['Extra cost', '$310K']] },
    { key: 'surge', title: '+20% demand surge', icon: TrendingUp, tone: 'amber', stats: [['Stockouts', '+14 SKUs'], ['Extra buy', money(t.baseInvestment * 0.09)], ['Service', '92% → 88%']] },
    { key: 'lean', title: 'Cut safety stock 15%', icon: Coins, tone: 'mint', stats: [['Freed capital', money(t.baseInvestment * 0.11)], ['Service', '92% → 90%'], ['Stockout risk', '+3.2%']] },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Stat value={`${t.currentService}%`} label="Current service" sub="fill rate" />
        <Stat value={money(t.baseInvestment)} label="Current investment" sub="on-hand value" />
        <Stat value={`${target}%`} label="Target service" tone="mint" sub="simulated" />
        <Stat value={`${sim.deltaPct > 0 ? '+' : ''}${sim.deltaPct}%`} label="Investment Δ" tone={sim.deltaPct > 0 ? 'amber' : 'mint'} sub={money(sim.investment)} />
      </div>

      <Panel title="Service level ↔ inventory investment" sub="the fundamental tradeoff · drag the target to simulate (live data untouched)">
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className={GRID} />
              <XAxis type="number" dataKey="service" domain={[80, 99]} tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} stroke="currentColor" className={AXIS} />
              <YAxis type="number" dataKey="investment" tick={{ fontSize: 10 }} tickFormatter={money} stroke="currentColor" className={AXIS} />
              <Tooltip formatter={(v, n) => (n === 'investment' ? money(Number(v)) : `${v}%`)} contentStyle={tip} />
              <Scatter data={t.curve} line={{ stroke: C.indigo, strokeWidth: 2 }} fill={C.indigo} shape={() => <g />} />
              <ReferenceDot x={t.currentService} y={curPoint.investment} r={5} fill={C.mint} stroke="#fff" strokeWidth={1.5} />
              <ReferenceDot x={target} y={sim.investment} r={6} fill={C.amber} stroke="#fff" strokeWidth={1.5} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className="text-[11.5px] font-medium">Target service</span>
          <input type="range" min={80} max={99} value={target} onChange={(e) => setTarget(+e.target.value)} className="h-1.5 flex-1 min-w-[160px] cursor-pointer accent-accent-500" />
          <span className="w-12 text-right text-[13px] font-semibold text-accent-600 dark:text-accent-400">{target}%</span>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <MiniOutcome label="Required investment" value={money(sim.investment)} delta={`${sim.deltaPct > 0 ? '+' : ''}${sim.deltaPct}%`} good={sim.deltaPct <= 0} />
          <MiniOutcome label="Stockout risk" value={`${sim.stockoutRisk}%`} delta={target >= t.currentService ? 'lower' : 'higher'} good={target >= t.currentService} />
          <MiniOutcome label="vs current" value={`${target - t.currentService >= 0 ? '+' : ''}${target - t.currentService} pts`} delta="service" good={target >= t.currentService} />
        </div>
        <div className="mt-2 flex items-center gap-3 text-[10.5px] text-navy-500 dark:text-slate-400"><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: C.mint }} /> current</span><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: C.amber }} /> simulated target</span></div>
      </Panel>

      <Panel title="What-if scenarios" sub="pre-modeled disruptions & policy moves">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {scenarios.map((s) => (
            <div key={s.key} className="rounded-xl border border-navy-100 p-3 dark:border-slate-800">
              <div className="mb-2 flex items-center gap-2"><span className={`flex h-7 w-7 items-center justify-center rounded-lg ${s.tone === 'rose' ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400' : s.tone === 'amber' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'}`}><s.icon className="h-4 w-4" /></span><span className="text-[12.5px] font-semibold">{s.title}</span></div>
              <div className="space-y-1">
                {s.stats.map(([l, v]) => <div key={l} className="flex items-center justify-between text-[11.5px]"><span className="text-navy-500 dark:text-slate-400">{l}</span><span className="font-semibold tabular-nums">{v}</span></div>)}
              </div>
            </div>
          ))}
        </div>
        <button onClick={draftFromSim} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-accent-500 px-3 py-1.5 text-[11.5px] font-semibold text-white hover:bg-accent-600"><Zap className="h-3.5 w-3.5" /> Draft safety-stock action (attach this scenario)</button>
      </Panel>
    </div>
  );
}

/* ── Availability & Risk ────────────────────────────────────────── */
function AvailabilityTab({ selected, recs, onSubmit }: { selected: string[]; recs: Recommendation[]; onSubmit: (id: string, label: string) => void }) {
  const ar = useMemo(() => availabilityRisk(selected), [selected]);
  const recByMat = useMemo(() => new Map(recs.map((r) => [r.material_id, r])), [recs]);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Scorecard icon={ShieldAlert} tone="indigo" value={String(ar.vitalCount)} label="Vital + essential" sub="availability-critical" />
        <Scorecard icon={Zap} tone="rose" value={String(ar.atRiskCount)} label="At stockout risk" sub="under 25d cover" />
        <Scorecard icon={Coins} tone="amber" value={money(ar.atRiskValue)} label="Value at risk" sub="in critical spares" />
        <Scorecard icon={Target} tone="rose" value={String(ar.safetyBreaches)} label="Safety breaches" sub="below reorder" />
      </div>
      <Panel title="Days-of-cover distribution" sub="how close to stockout your spares sit">
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ar.coverageBuckets} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className={GRID} />
              <XAxis dataKey="bucket" tick={{ fontSize: 10 }} stroke="currentColor" className={AXIS} />
              <YAxis tick={{ fontSize: 10 }} stroke="currentColor" className={AXIS} />
              <Tooltip formatter={(v) => `${v} SKUs`} contentStyle={tip} />
              <Bar dataKey="count" radius={[3, 3, 0, 0]}>{ar.coverageBuckets.map((_, i) => <Cell key={i} fill={i === 0 ? C.rose : i === 1 ? C.amber : C.indigo} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
      <Panel title="Vital spares at risk" sub="lowest cover first · act to expedite">
        <div className="flex flex-col gap-1.5">
          {ar.atRisk.map((m) => {
            const rec = recByMat.get(m.id);
            return (
              <div key={m.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-navy-100 px-3 py-2 dark:border-slate-800">
                <span className={`h-2.5 w-2.5 rounded-full ${m.coverage_days < 10 ? 'bg-rose-500' : 'bg-amber-500'}`} />
                <div className="min-w-0 flex-1"><div className="truncate text-[12px] font-medium">{m.description}</div><div className="font-mono text-[10px] text-navy-400 dark:text-slate-500">{m.id} · {m.plant_id} · {m.ved} · crit {m.criticality_score}</div></div>
                <div className="text-right"><div className={`text-[13px] font-semibold ${m.coverage_days < 10 ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>{m.coverage_days}d</div></div>
                {rec && <button onClick={() => onSubmit(rec.id, rec.material_desc)} className="rounded-md bg-rose-500 px-2.5 py-1.5 text-[10.5px] font-semibold text-white hover:bg-rose-600">Expedite</button>}
              </div>
            );
          })}
          {ar.atRisk.length === 0 && <div className="py-6 text-center text-[12.5px] text-navy-500 dark:text-slate-400">No vital spares at risk. 👍</div>}
        </div>
      </Panel>
    </div>
  );
}

/* ── Shared ─────────────────────────────────────────────────────── */
function Panel({ title, sub, children, className }: { title?: string; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-navy-100 bg-white p-4 dark:border-slate-800 dark:bg-[#211c33] ${className || ''}`}>
      {title && <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5"><span className="text-[12.5px] font-semibold">{title}</span>{sub && <span className="text-[11px] text-navy-400 dark:text-slate-500">{sub}</span>}</div>}
      {children}
    </div>
  );
}
const TT: Record<string, string> = { rose: 'text-rose-600 dark:text-rose-400', amber: 'text-amber-600 dark:text-amber-400', mint: 'text-emerald-600 dark:text-emerald-400', violet: 'text-violet-600 dark:text-violet-400' };
function Stat({ value, label, sub, tone }: { value: string; label: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-navy-100 bg-white p-3 dark:border-slate-800 dark:bg-[#211c33]">
      <div className={`text-[19px] font-semibold leading-none tracking-tight ${tone ? TT[tone] : ''}`}>{value}</div>
      <div className="mt-1.5 text-[11px] font-medium">{label}</div>
      {sub && <div className="text-[9.5px] text-navy-400 dark:text-slate-500">{sub}</div>}
    </div>
  );
}
function MiniOutcome({ label, value, delta, good }: { label: string; value: string; delta: string; good: boolean }) {
  return (
    <div className="rounded-lg border border-navy-100 bg-navy-50/50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/40">
      <div className="text-[10px] uppercase tracking-wide text-navy-400 dark:text-slate-500">{label}</div>
      <div className="flex items-baseline gap-1.5"><span className="text-[15px] font-semibold">{value}</span><span className={`text-[10px] ${good ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{delta}</span></div>
    </div>
  );
}
const SC_TONE: Record<string, string> = { indigo: 'bg-accent-500/12 text-accent-600 dark:text-accent-400', rose: 'bg-rose-500/12 text-rose-600 dark:text-rose-400', amber: 'bg-amber-500/12 text-amber-600 dark:text-amber-400', mint: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400' };
function Scorecard({ icon: Icon, tone, value, label, sub }: { icon: typeof Boxes; tone: string; value: string; label: string; sub: string }) {
  return (
    <div className="rounded-xl border border-navy-100 bg-white p-3.5 dark:border-slate-800 dark:bg-[#211c33]">
      <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${SC_TONE[tone]}`}><Icon className="h-4 w-4" /></span>
      <div className="mt-2.5 text-[21px] font-semibold leading-none tracking-tight">{value}</div>
      <div className="mt-1.5 text-[11.5px] font-medium">{label}</div>
      <div className="text-[10px] text-navy-400 dark:text-slate-500">{sub}</div>
    </div>
  );
}
