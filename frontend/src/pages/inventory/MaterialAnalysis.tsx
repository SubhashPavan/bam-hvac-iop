import { useEffect, useMemo, useState } from 'react';
import {
  Area, Line, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  ArrowLeft, Sparkles, Gauge, TrendingUp, AlertTriangle, PackageCheck,
  Camera, Paperclip, X, History, RefreshCw, ArrowRight,
} from 'lucide-react';
import type { Material } from '../../types/inventory';
import { MATERIALS } from '../../data/inventoryMock';
import {
  useRequestStore, STAGE_LABEL, type ActionSeed, type ActionKind, type SimSnapshot, type Stage,
} from '../../store/requestStore';
import { getForecast, getMaterialInsight, getInventoryPolicy, type PolicyRow } from '../../services/inventoryApi';
import { useDebounced } from './useLiveData';
import { Spinner } from './LoadingBar';

const C = { indigo: '#6366f1', amber: '#f59e0b', mint: '#22c55e', rose: '#f43f5e', violet: '#8b5cf6' };
const AXIS = 'text-navy-400 dark:text-slate-500';
const GRID = 'text-navy-100 dark:text-slate-800';
const tip = { fontSize: 11, borderRadius: 8, border: '1px solid rgba(120,120,140,0.2)' };
const money = (n: number) => (Math.abs(n) >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : Math.abs(n) >= 1e3 ? `$${(n / 1e3).toFixed(1)}K` : `$${Math.round(n)}`);
const TT: Record<string, string> = { rose: 'text-rose-600 dark:text-rose-400', amber: 'text-amber-600 dark:text-amber-400', mint: 'text-emerald-600 dark:text-emerald-400', violet: 'text-violet-600 dark:text-violet-400' };

function erf(x: number) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
}
const normCdf = (x: number) => 0.5 * (1 + erf(x / Math.SQRT2));

function Panel({ title, sub, children, className }: { title?: string; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-navy-100 bg-white p-4 dark:border-slate-800 dark:bg-[#211c33] ${className || ''}`}>
      {title && <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5"><span className="text-[12.5px] font-semibold">{title}</span>{sub && <span className="text-[11px] text-navy-400 dark:text-slate-500">{sub}</span>}</div>}
      {children}
    </div>
  );
}
function Stat({ value, label, sub, tone }: { value: string; label: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-navy-100 bg-white p-3 dark:border-slate-800 dark:bg-[#211c33]">
      <div className={`text-[18px] font-semibold leading-none tracking-tight ${tone ? TT[tone] : ''}`}>{value}</div>
      <div className="mt-1.5 text-[11px] font-medium">{label}</div>
      {sub && <div className="text-[9.5px] text-navy-400 dark:text-slate-500">{sub}</div>}
    </div>
  );
}
const Chip = ({ k, v, tone }: { k: string; v: string; tone?: string }) => (
  <span className="inline-flex items-center gap-1 rounded-md border border-navy-100 bg-white px-2 py-1 text-[10.5px] dark:border-slate-700 dark:bg-[#0e1730]">
    <span className="text-navy-400 dark:text-slate-500">{k}</span><b className={tone ? TT[tone] : ''}>{v}</b>
  </span>
);
const PolicyChip = ({ k, v, tone }: { k: string; v: string; tone?: string }) => (
  <span className="inline-flex items-center gap-1 rounded-md bg-navy-50/70 px-2 py-1 text-[10.5px] ring-1 ring-navy-100 dark:bg-slate-900/40 dark:ring-slate-700">
    <span className="text-navy-400 dark:text-slate-500">{k}</span><b className={tone ? TT[tone] : ''}>{v}</b>
  </span>
);
function PolicyStat({ label, qty, val, tone }: { label: string; qty: number | string; val: number | string; tone?: string }) {
  const money = (n: number) => (Math.abs(n) >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : Math.abs(n) >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${Math.round(n)}`);
  return (
    <div className="rounded-xl border border-navy-100 bg-white p-3 dark:border-slate-800 dark:bg-[#211c33]">
      <div className={`text-[18px] font-semibold leading-none tracking-tight ${tone ? TT[tone] : ''}`}>{typeof qty === 'number' ? Math.round(qty) : qty}</div>
      <div className="mt-1.5 text-[11px] font-medium">{label}</div>
      <div className="text-[9.5px] text-navy-400 dark:text-slate-500">{typeof val === 'number' ? money(val) : val}</div>
    </div>
  );
}

const PATTERN_TONE: Record<string, string> = { smooth: 'mint', intermittent: 'violet', erratic: 'amber', lumpy: 'rose', no_demand: 'rose' };
const STATE_LABEL: Record<string, string> = { overstocked: 'Overstocked', understocked: 'Below reorder point', obsolete: 'Obsolete / dead stock', healthy: 'Healthy' };
const SEV_BORDER: Record<string, string> = { high: 'border-rose-500/30 bg-rose-500/[0.04]', medium: 'border-amber-500/30 bg-amber-500/[0.04]', low: 'border-navy-100 dark:border-slate-800' };
const SEV_DOT: Record<string, string> = { high: 'bg-rose-500', medium: 'bg-amber-500', low: 'bg-emerald-500' };
const KIND_LABEL: Record<string, string> = { reduce_stock: 'Reduce excess', dispose: 'Write off / dispose', increase_stock: 'Reorder now', transfer: 'Rebalance / transfer', keep_unchanged: 'Hold' };
const STAGE_TONE: Record<Stage, string> = {
  plant_mgr: 'bg-navy-100 text-navy-600 dark:bg-slate-700 dark:text-slate-300',
  maintenance: 'bg-sky-500/15 text-sky-600 dark:text-sky-400', finance: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  regional: 'bg-violet-500/15 text-violet-600 dark:text-violet-400', global: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  executing: 'bg-amber-500/15 text-amber-600 dark:text-amber-400', done: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  rejected: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
};
const ago = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export default function MaterialAnalysis({ material, onBack }: { material: Material; onBack: () => void }) {
  const [serviceLevel, setServiceLevel] = useState(95); // percent
  const dSL = useDebounced(serviceLevel, 300);
  const [detail, setDetail] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const openAction = useRequestStore((s) => s.openAction);
  const saveSnapshot = useRequestStore((s) => s.saveSnapshot);
  const clearSnapshot = useRequestStore((s) => s.clearSnapshot);
  const pendingSnapshot = useRequestStore((s) => s.pendingSnapshot);
  const requests = useRequestStore((s) => s.requests);
  const audit = useMemo(() => requests.filter((r) => r.materialId === material.id), [requests, material.id]);
  const [snaps, setSnaps] = useState<SimSnapshot[]>([]);

  // Agentic per-SKU read from Claude — fetched per material, refreshable at the chosen policy.
  const [insight, setInsight] = useState<{ insight: string; actions: string[] } | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const loadInsight = (sl: number) => {
    setInsightLoading(true);
    getMaterialInsight(material.id, sl / 100)
      .then((d) => setInsight(d))
      .catch(() => setInsight(null))
      .finally(() => setInsightLoading(false));
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getForecast(material.id, dSL / 100)
      .then((d) => { if (!cancelled) { setDetail(d); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [material.id, dSL]);

  useEffect(() => { setInsight(null); setSnaps([]); loadInsight(95); }, [material.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Full inventory stocking policy for this material (our standard method).
  const [policy, setPolicy] = useState<PolicyRow | null>(null);
  useEffect(() => {
    let cancelled = false;
    setPolicy(null);
    getInventoryPolicy([material.plant_id]).then((rows) => { if (!cancelled) setPolicy(rows.find((r) => r.id === material.id) || null); }).catch(() => {});
    return () => { cancelled = true; };
  }, [material.id, material.plant_id]);

  const p = detail?.planning;
  const rate = detail?.per_period_demand ?? material.avg_monthly_demand;
  const points = detail?.points ?? [];

  // Policy target & the opportunity that falls out of it.
  const opp = useMemo(() => {
    if (!p) return null;
    const target = Math.max(0, p.reorder_point + rate); // reorder point + one cycle
    const onHand = material.on_hand_qty;
    const unit = material.unit_cost;
    if ((detail?.demand_pattern === 'no_demand' || rate < 0.05) && material.fsn === 'Non-moving' && material.current_stock_value > 2000) {
      return { kind: 'dispose' as ActionKind, savings: material.current_stock_value, target: 0, tone: 'rose', why: `No consumption on record (${detail?.demand_pattern}). Write-off recovers ${money(material.current_stock_value)}.` };
    }
    if (onHand > target) {
      const savings = (onHand - target) * unit;
      // Rebalance beats reduce when another plant is short on the same part.
      const need = MATERIALS.find((x) => x.plant_id !== material.plant_id && x.category === material.category &&
        x.supplier === material.supplier && x.coverage_days < 25 && (x.ved === 'Vital' || x.ved === 'Essential'));
      if (need) {
        return { kind: 'transfer' as ActionKind, savings, target: Math.round(target), tone: 'amber',
          why: `${need.plant_id} is short on ${material.category}/${material.supplier} (cover ${need.coverage_days}d, ${need.ved}). Rebalance the excess there instead of buying — avoids a purchase and frees ${money(savings)} here.` };
      }
      return { kind: 'reduce_stock' as ActionKind, savings, target: Math.round(target), tone: 'amber', why: `On-hand ${onHand} vs optimal ${Math.round(target)} for ${dSL}% service. Rightsize to release ${money(savings)}.` };
    }
    if (onHand < p.reorder_point) {
      return { kind: 'increase_stock' as ActionKind, savings: 0, target: Math.round(target), tone: 'rose', why: `On-hand ${onHand} below reorder point ${Math.round(p.reorder_point)}. Reorder ${Math.round(p.reorder_qty)} to protect ${dSL}% service.` };
    }
    return { kind: 'keep_unchanged' as const, savings: 0, target: Math.round(target), tone: 'mint', why: `On-hand ${onHand} is within the healthy band for ${dSL}% service. No action.` };
  }, [p, rate, material, detail, dSL]);

  const takeSnapshot = () => {
    if (!p) return;
    const snap: SimSnapshot = {
      scenario: `SL ${serviceLevel}% · SS ${Math.round(p.safety_stock)} · ROP ${Math.round(p.reorder_point)}`,
      service: serviceLevel,
      investment: Math.round(p.reorder_point * material.unit_cost),
      stockoutRisk: +(100 - serviceLevel).toFixed(1),
      savedAt: new Date().toISOString(),
    };
    setSnaps((s) => [snap, ...s].slice(0, 5));
    saveSnapshot(snap); // most recent auto-arms for attach on the next action
  };

  const act = () => {
    if (!opp || !p || opp.kind === 'keep_unchanged') return;
    const proposed = opp.kind === 'dispose' ? 0 : opp.target * material.unit_cost;
    const seed: ActionSeed = {
      materialId: material.id, materialDesc: material.description, plantId: material.plant_id, kind: opp.kind,
      currentValue: material.current_stock_value, proposedValue: Math.round(proposed),
      savings: Math.round(opp.savings), cashRelease: Math.round(opp.savings * 0.7), justification: opp.why,
    };
    openAction(seed);
  };

  const coverBad = material.coverage_days < (p?.recommended_coverage_days ?? 0) * 0.6 || material.coverage_days > (p?.recommended_coverage_days ?? 9999) * 2;

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-5">
      <button onClick={onBack} className="mb-3 inline-flex items-center gap-1.5 rounded-lg border border-navy-200 px-2.5 py-1 text-[11.5px] font-medium text-navy-600 hover:bg-navy-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-white/5">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to SKU list
      </button>

      {/* Header + classification */}
      <div className="mb-4">
        <h1 className="text-[19px] font-semibold tracking-tight">{material.description}</h1>
        <div className="mt-0.5 font-mono text-[11px] text-navy-400 dark:text-slate-500">{material.id} · {material.plant_id} · {material.category} · {material.supplier}</div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <Chip k="Demand" v={detail?.demand_pattern ?? '—'} tone={PATTERN_TONE[detail?.demand_pattern] || 'violet'} />
          <Chip k="Method" v={detail?.method ?? '—'} />
          <Chip k="XYZ" v={material.xyz} />
          <Chip k="FSN" v={material.fsn} />
          <Chip k="VED" v={material.ved} tone={material.ved === 'Vital' ? 'rose' : material.ved === 'Essential' ? 'amber' : undefined} />
          <Chip k="Criticality" v={String(material.criticality_score)} />
          <Chip k="Fcst acc." v={detail ? `${detail.accuracy.model_accuracy}%` : '—'} tone="mint" />
        </div>
      </div>

      {/* Agentic read — Claude's recommendation for this SKU */}
      <div className="mb-4 rounded-xl border border-accent-500/30 bg-gradient-to-br from-accent-500/[0.07] to-transparent p-4 dark:border-accent-500/25">
        <div className="mb-1.5 flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-accent-500/15"><Sparkles className="h-3.5 w-3.5 text-accent-500" /></div>
          <span className="text-[12.5px] font-semibold">Sage's read on this SKU</span>
          <button onClick={() => loadInsight(serviceLevel)} disabled={insightLoading}
            className="ml-auto inline-flex items-center gap-1 rounded-md border border-navy-200 px-2 py-0.5 text-[10.5px] font-medium text-navy-500 hover:bg-navy-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-white/5">
            <RefreshCw className={`h-3 w-3 ${insightLoading ? 'animate-spin' : ''}`} /> Re-run at {serviceLevel}%
          </button>
        </div>
        {insightLoading && !insight ? (
          <div className="flex items-center gap-2 text-[12px] text-navy-400 dark:text-slate-500"><Spinner /> Analyzing this SKU…</div>
        ) : (
          <>
            <p className="text-[12.5px] leading-relaxed text-navy-700 dark:text-slate-200">{insight?.insight || detail?.insight || 'Insight unavailable.'}</p>
            {!!insight?.actions?.length && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {insight.actions.map((a, i) => (
                  <span key={i} className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[10.5px] font-medium text-navy-600 ring-1 ring-navy-100 dark:bg-[#0e1730] dark:text-slate-300 dark:ring-slate-700">
                    <ArrowRight className="h-3 w-3 text-accent-500" />{a}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {loading && !detail ? (
        <div className="flex h-64 items-center justify-center gap-2.5 text-[13px] text-navy-400 dark:text-slate-500"><Spinner className="h-5 w-5" /> Running analysis…</div>
      ) : !detail ? (
        <div className="flex h-64 items-center justify-center text-[13px] text-navy-400 dark:text-slate-500">Analysis unavailable — the backend is not reachable.</div>
      ) : (
        <div className="space-y-4">
          {/* Policy stat row — computed from demand pattern + lead time + service level */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            <Stat value={`${rate.toFixed(1)}`} label="Avg demand / mo" sub={`trend ${detail.trend_pct >= 0 ? '+' : ''}${detail.trend_pct}%`} tone={detail.trend_pct >= 0 ? 'mint' : 'rose'} />
            <Stat value={String(Math.round(p.safety_stock))} label="Safety stock" sub={money(p.safety_stock_value)} tone="violet" />
            <Stat value={String(Math.round(p.reorder_point))} label="Reorder point" sub={`lead ${p.lead_time_days}d`} />
            <Stat value={String(Math.round(p.reorder_qty))} label="Reorder qty (EOQ)" sub="per order" />
            <Stat value={`${material.coverage_days}d`} label="Current coverage" sub={`target ${p.recommended_coverage_days ?? '—'}d`} tone={coverBad ? 'amber' : 'mint'} />
            <Stat value={String(material.on_hand_qty)} label="On-hand units" sub={money(material.current_stock_value)} />
          </div>

          {/* Full stocking policy — our standard replenishment method */}
          {policy && (
            <Panel title="Inventory stocking policy" sub="service-level safety stock · class-based reorder qty · 30-day lead">
              {!policy.active ? (
                <div className="text-[12px] text-navy-400 dark:text-slate-500">Inactive material — no consumption, receipts or stock on record.</div>
              ) : (
                <>
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    <PolicyChip k="FSN" v={String(policy.fsn)} />
                    <PolicyChip k="CV" v={`${policy.cv} · ${policy.cv_band}`} />
                    <PolicyChip k="ABC" v={String(policy.abc)} />
                    <PolicyChip k="Service level" v={`${(Number(policy.service_level) * 100).toFixed(0)}% (z ${policy.z_score})`} />
                    <PolicyChip k="Unit rate" v={typeof policy.unit_rate === 'number' ? `$${policy.unit_rate}` : String(policy.unit_rate)} />
                    <PolicyChip k="Lead time" v={`${policy.lead_time_days}d`} />
                    <PolicyChip k="Ledger" v={String(policy.data_status)} tone={policy.data_status === 'Data incorrect' ? 'rose' : 'mint'} />
                    {policy.data_status === 'Data incorrect' && <PolicyChip k="Error qty" v={String(policy.data_error_qty)} tone="rose" />}
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                    <PolicyStat label="Safety stock" qty={policy.safety_stock} val={policy.ss_value} tone="violet" />
                    <PolicyStat label="Reorder level (ROL)" qty={policy.rol} val={policy.rol_value} />
                    <PolicyStat label="Reorder qty (ROQ)" qty={policy.roq} val={policy.roq_value} />
                    <PolicyStat label="Maximum stock" qty={policy.max_stock} val={policy.max_value} tone="amber" />
                    <PolicyStat label="Average stock" qty={policy.avg_stock} val={policy.avg_value} tone="mint" />
                  </div>
                  <div className="mt-2.5 text-[10.5px] text-navy-400 dark:text-slate-500">Annual consumption value {typeof policy.annual_consumption_value === 'number' ? money(policy.annual_consumption_value) : policy.annual_consumption_value} · consumption in {String(policy.consumption_months)} months · avg {policy.avg_monthly_consumption}/mo</div>
                </>
              )}
            </Panel>
          )}

          {/* Demand + forecast */}
          <Panel title="Demand & forecast" sub={`${detail.method} · history + ${detail.horizon_m}-mo forecast with confidence band`}>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={points} margin={{ top: 8, right: 10, left: -10, bottom: 0 }}>
                  <defs><linearGradient id="maBand" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.amber} stopOpacity={0.18} /><stop offset="100%" stopColor={C.amber} stopOpacity={0.02} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className={GRID} />
                  <XAxis dataKey="label" tick={{ fontSize: 9 }} stroke="currentColor" className={AXIS} />
                  <YAxis tick={{ fontSize: 10 }} stroke="currentColor" className={AXIS} />
                  <Tooltip contentStyle={tip} />
                  <Area type="monotone" dataKey="upper" stroke="none" fill="url(#maBand)" name="Upper CI" />
                  <Area type="monotone" dataKey="lower" stroke="none" fill="#fff" fillOpacity={0} name="Lower CI" />
                  <Line type="monotone" dataKey="forecast" name="Forecast" stroke={C.indigo} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="actual" name="Actual" stroke={C.mint} strokeWidth={2} dot={false} connectNulls={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          {/* Root cause — why this SKU is in its current state */}
          {!!detail.drivers?.length && (
            <Panel title="Root cause" sub={`diagnosis: ${STATE_LABEL[detail.root_cause_state] || detail.root_cause_state}`}>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {detail.drivers.map((d: any, i: number) => (
                  <div key={i} className={`rounded-lg border p-2.5 ${SEV_BORDER[d.severity] || 'border-navy-100 dark:border-slate-800'}`}>
                    <div className="mb-0.5 flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${SEV_DOT[d.severity] || 'bg-navy-300'}`} />
                      <span className="text-[11.5px] font-semibold">{d.label}</span>
                    </div>
                    <p className="text-[10.5px] leading-relaxed text-navy-500 dark:text-slate-400">{d.detail}</p>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {/* Simulation + recommended action, side by side */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
            <Panel title="Simulate policy" sub="drag service level — safety stock, reorder point & stockout risk recompute live">
              <div className="mb-3 flex items-center gap-3">
                <Gauge className="h-4 w-4 text-accent-500" />
                <span className="text-[11.5px] font-medium">Target service level</span>
                <input type="range" min={80} max={99} step={0.5} value={serviceLevel} onChange={(e) => setServiceLevel(+e.target.value)} className="h-1.5 flex-1 cursor-pointer accent-accent-500" />
                <span className="w-14 text-right text-[13px] font-semibold text-accent-600 dark:text-accent-400">{serviceLevel}%</span>
              </div>
              {/* Safety-stock slider maps back to service level */}
              <div className="mb-3 flex items-center gap-3">
                <PackageCheck className="h-4 w-4 text-violet-500" />
                <span className="text-[11.5px] font-medium">Safety stock</span>
                <input type="range" min={0} max={Math.max(5, Math.round(p.safety_stock * 2.2))} step={1}
                  value={Math.round(p.safety_stock)}
                  onChange={(e) => {
                    const ss = +e.target.value;
                    const leadM = p.lead_time_days / 30;
                    const sigmaLtd = (p.sigma_period || 1) * Math.sqrt(Math.max(leadM, 1e-6));
                    const z = sigmaLtd > 0 ? ss / sigmaLtd : 1.645;
                    const sl = Math.min(99, Math.max(80, normCdf(z) * 100));
                    setServiceLevel(Math.round(sl * 2) / 2);
                  }}
                  className="h-1.5 flex-1 cursor-pointer accent-violet-500" />
                <span className="w-14 text-right text-[13px] font-semibold text-violet-600 dark:text-violet-400">{Math.round(p.safety_stock)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat value={String(Math.round(p.safety_stock))} label="Safety stock" sub={money(p.safety_stock_value)} tone="violet" />
                <Stat value={String(Math.round(p.reorder_point))} label="Reorder point" />
                <Stat value={`${(100 - serviceLevel).toFixed(1)}%`} label="Stockout risk" tone={100 - serviceLevel > 8 ? 'rose' : 'amber'} />
                <Stat value={money(p.reorder_point * material.unit_cost)} label="Policy stock value" sub="at reorder point" tone="mint" />
              </div>
              <div className="mt-3 flex items-center gap-2 border-t border-navy-100 pt-3 dark:border-slate-800">
                <button onClick={takeSnapshot} className="inline-flex items-center gap-1.5 rounded-lg border border-accent-500/40 bg-accent-500/10 px-2.5 py-1.5 text-[11.5px] font-semibold text-accent-600 hover:bg-accent-500/15 dark:text-accent-400">
                  <Camera className="h-3.5 w-3.5" /> Save this scenario
                </button>
                <span className="text-[10.5px] text-navy-400 dark:text-slate-500">Snapshots the current what-if so you can compare or attach it to an action.</span>
              </div>
              {snaps.length > 0 && (
                <div className="mt-2.5 space-y-1.5">
                  {snaps.map((s) => {
                    const attached = pendingSnapshot?.savedAt === s.savedAt;
                    return (
                      <div key={s.savedAt} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] ${attached ? 'border-accent-500/50 bg-accent-500/[0.06]' : 'border-navy-100 dark:border-slate-800'}`}>
                        <Camera className="h-3.5 w-3.5 text-navy-400 dark:text-slate-500" />
                        <span className="font-medium">{s.scenario}</span>
                        <span className="text-navy-400 dark:text-slate-500">· invest {money(s.investment)} · risk {s.stockoutRisk}%</span>
                        <button onClick={() => saveSnapshot(s)} className={`ml-auto inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold ${attached ? 'bg-accent-500 text-white' : 'border border-navy-200 text-navy-500 hover:bg-navy-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-white/5'}`}>
                          <Paperclip className="h-3 w-3" />{attached ? 'Attached' : 'Attach'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>

            <Panel title="Recommended action" sub="derived from this policy">
              {opp && (
                <div className="flex h-full flex-col">
                  <div className={`mb-2 inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold ${opp.tone === 'rose' ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400' : opp.tone === 'amber' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'}`}>
                    {opp.tone === 'rose' ? <AlertTriangle className="h-3.5 w-3.5" /> : opp.tone === 'mint' ? <PackageCheck className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
                    {KIND_LABEL[opp.kind]}
                  </div>
                  {opp.savings > 0 && <div className="text-[24px] font-semibold tracking-tight text-amber-600 dark:text-amber-400">{money(opp.savings)}</div>}
                  {opp.savings > 0 && <div className="mb-1 text-[10px] uppercase tracking-wide text-navy-400 dark:text-slate-500">potential savings</div>}
                  <p className="text-[11.5px] leading-relaxed text-navy-600 dark:text-slate-400">{opp.why}</p>
                  {opp.kind !== 'keep_unchanged' && (
                    <div className="mt-3">
                      {pendingSnapshot ? (
                        <div className="mb-2 flex items-center gap-1.5 rounded-lg border border-accent-500/40 bg-accent-500/[0.06] px-2.5 py-1.5 text-[10.5px]">
                          <Paperclip className="h-3 w-3 text-accent-500" />
                          <span className="font-medium text-accent-600 dark:text-accent-400">Scenario attached</span>
                          <span className="truncate text-navy-500 dark:text-slate-400">{pendingSnapshot.scenario}</span>
                          <button onClick={clearSnapshot} className="ml-auto text-navy-400 hover:text-rose-500"><X className="h-3 w-3" /></button>
                        </div>
                      ) : (
                        <div className="mb-2 text-[10.5px] text-navy-400 dark:text-slate-500">Tip: save a scenario above to attach it as evidence.</div>
                      )}
                      <button onClick={act} className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent-500 px-3 py-2 text-[12px] font-semibold text-white hover:bg-accent-600">
                        <Sparkles className="h-3.5 w-3.5" /> Create action → workflow
                      </button>
                    </div>
                  )}
                </div>
              )}
            </Panel>
          </div>

          {/* Audit trail — every action raised on this material and where it stands */}
          <Panel title="Audit trail" sub={audit.length ? `${audit.length} action${audit.length > 1 ? 's' : ''} on record` : undefined}>
            {audit.length === 0 ? (
              <div className="flex items-center gap-2 py-2 text-[11.5px] text-navy-400 dark:text-slate-500">
                <History className="h-4 w-4" /> No actions have been raised on this SKU yet.
              </div>
            ) : (
              <div className="space-y-3">
                {audit.map((r) => (
                  <div key={r.id} className="rounded-lg border border-navy-100 p-3 dark:border-slate-800">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10.5px] text-navy-400 dark:text-slate-500">{r.id}</span>
                      <span className="text-[12px] font-semibold">{KIND_LABEL[r.kind] ?? r.kind}</span>
                      {r.savings > 0 && <span className="text-[11.5px] font-semibold text-amber-600 dark:text-amber-400">{money(r.savings)}</span>}
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${STAGE_TONE[r.stage]}`}>{STAGE_LABEL[r.stage]}</span>
                      {r.snapshot && <span className="inline-flex items-center gap-1 rounded bg-accent-500/10 px-1.5 py-0.5 text-[10px] font-medium text-accent-600 dark:text-accent-400"><Paperclip className="h-2.5 w-2.5" />{r.snapshot.scenario}</span>}
                      <span className="ml-auto text-[10.5px] text-navy-400 dark:text-slate-500">{ago(r.createdAt)}</span>
                    </div>
                    <ol className="mt-2 space-y-1 border-l border-navy-100 pl-3 dark:border-slate-800">
                      {r.history.map((h, i) => (
                        <li key={i} className="flex flex-wrap items-baseline gap-x-1.5 text-[10.5px] text-navy-500 dark:text-slate-400">
                          <span className="font-medium text-navy-700 dark:text-slate-200">{h.actor}</span>
                          <span className="capitalize">{h.decision.replace('_', ' ')}</span>
                          {h.comment && <span className="italic text-navy-400 dark:text-slate-500">“{h.comment}”</span>}
                          <span className="ml-auto text-navy-300 dark:text-slate-600">{ago(h.at)}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
