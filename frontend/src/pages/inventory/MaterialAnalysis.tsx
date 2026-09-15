import { useEffect, useMemo, useState } from 'react';
import {
  Area, Line, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  ArrowLeft, Sparkles, TrendingUp, AlertTriangle, PackageCheck,
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

function Panel({ title, sub, children, className }: { title?: string; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-navy-100 bg-white p-4 dark:border-slate-800 dark:bg-[#211c33] ${className || ''}`}>
      {title && <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5"><span className="text-[14px] font-semibold">{title}</span>{sub && <span className="text-[12.5px] text-navy-400 dark:text-slate-500">{sub}</span>}</div>}
      {children}
    </div>
  );
}
function Stat({ value, label, sub, tone }: { value: string; label: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-navy-100 bg-white p-3 dark:border-slate-800 dark:bg-[#211c33]">
      <div className={`text-[19.5px] font-semibold leading-none tracking-tight ${tone ? TT[tone] : ''}`}>{value}</div>
      <div className="mt-1.5 text-[12.5px] font-medium">{label}</div>
      {sub && <div className="text-[11px] text-navy-400 dark:text-slate-500">{sub}</div>}
    </div>
  );
}
const Chip = ({ k, v, tone }: { k: string; v: string; tone?: string }) => (
  <span className="inline-flex items-center gap-1 rounded-md border border-navy-100 bg-white px-2 py-1 text-[12px] dark:border-slate-700 dark:bg-[#0e1730]">
    <span className="text-navy-400 dark:text-slate-500">{k}</span><b className={tone ? TT[tone] : ''}>{v}</b>
  </span>
);
const PolicyChip = ({ k, v, tone }: { k: string; v: string; tone?: string }) => (
  <span className="inline-flex items-center gap-1 rounded-md bg-navy-50/70 px-2 py-1 text-[12px] ring-1 ring-navy-100 dark:bg-slate-900/40 dark:ring-slate-700">
    <span className="text-navy-400 dark:text-slate-500">{k}</span><b className={tone ? TT[tone] : ''}>{v}</b>
  </span>
);
function PolicyStat({ label, qty, val, tone }: { label: string; qty: number | string; val: number | string; tone?: string }) {
  const money = (n: number) => (Math.abs(n) >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : Math.abs(n) >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${Math.round(n)}`);
  return (
    <div className="rounded-xl border border-navy-100 bg-white p-3 dark:border-slate-800 dark:bg-[#211c33]">
      <div className={`text-[19.5px] font-semibold leading-none tracking-tight ${tone ? TT[tone] : ''}`}>{typeof qty === 'number' ? Math.round(qty) : qty}</div>
      <div className="mt-1.5 text-[12.5px] font-medium">{label}</div>
      <div className="text-[11px] text-navy-400 dark:text-slate-500">{typeof val === 'number' ? money(val) : val}</div>
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
  const [serviceLevel] = useState(95); // percent — the agentic insight / forecast fetch baseline
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

  const rate = detail?.per_period_demand ?? material.avg_monthly_demand;
  const points = detail?.points ?? [];

  // ONE policy everywhere: parsed numbers from the stocking-policy engine.
  const pol = useMemo(() => (policy && policy.active && typeof policy.safety_stock === 'number' ? {
    ss: Number(policy.safety_stock), rol: Number(policy.rol), roq: Number(policy.roq),
    max: Number(policy.max_stock), avgStock: Number(policy.avg_stock),
    ssVal: typeof policy.ss_value === 'number' ? policy.ss_value : 0,
    unitRate: typeof policy.unit_rate === 'number' ? policy.unit_rate : material.unit_cost,
    sl: Math.round(Number(policy.service_level) * 100),
    lead: Number(policy.lead_time_days),
  } : null), [policy, material]);

  // The recommended action falls out of the stocking policy (ROL / Max stock).
  const opp = useMemo(() => {
    if (!pol || !policy) return null;
    const onHand = material.on_hand_qty;
    const unit = pol.unitRate;
    if (policy.fsn === 'Non-moving' && Number(policy.consumption_months) === 0 && material.current_stock_value > 2000) {
      return { kind: 'dispose' as ActionKind, savings: material.current_stock_value, target: 0, tone: 'rose', why: `No consumption on record. Write-off recovers ${money(material.current_stock_value)}.` };
    }
    if (onHand > pol.max) {
      const savings = (onHand - pol.max) * unit;
      // Rebalance beats reduce when another plant is short on the same part.
      const need = MATERIALS.find((x) => x.plant_id !== material.plant_id && x.category === material.category &&
        x.supplier === material.supplier && x.coverage_days < 25 && (x.ved === 'Vital' || x.ved === 'Essential'));
      if (need) {
        return { kind: 'transfer' as ActionKind, savings, target: pol.max, tone: 'amber',
          why: `${need.plant_id} is short on ${material.category}/${material.supplier} (cover ${need.coverage_days}d, ${need.ved}). Rebalance the excess there instead of buying — frees ${money(savings)} here.` };
      }
      return { kind: 'reduce_stock' as ActionKind, savings, target: pol.max, tone: 'amber', why: `On-hand ${onHand} vs max stock ${pol.max} (ROL ${pol.rol} + ROQ ${pol.roq}). Rightsize to release ${money(savings)}.` };
    }
    if (onHand < pol.rol) {
      return { kind: 'increase_stock' as ActionKind, savings: 0, target: pol.max, tone: 'rose', why: `On-hand ${onHand} below reorder level ${pol.rol}. Reorder ${pol.roq} to protect ${pol.sl}% service.` };
    }
    return { kind: 'keep_unchanged' as const, savings: 0, target: pol.max, tone: 'mint', why: `On-hand ${onHand} is within the healthy band (ROL ${pol.rol}–Max ${pol.max}). No action.` };
  }, [pol, policy, material]);

  const takeSnapshot = () => {
    if (!pol) return;
    const snap: SimSnapshot = {
      scenario: `SL ${pol.sl}% · SS ${pol.ss} · ROL ${pol.rol} · ROQ ${pol.roq}`,
      service: pol.sl,
      investment: Math.round(pol.rol * pol.unitRate),
      stockoutRisk: +(100 - pol.sl).toFixed(1),
      savedAt: new Date().toISOString(),
    };
    setSnaps((s) => [snap, ...s].slice(0, 5));
    saveSnapshot(snap); // arms for attach on the next action
  };

  const act = () => {
    if (!opp || !pol || opp.kind === 'keep_unchanged') return;
    const proposed = opp.kind === 'dispose' ? 0 : opp.target * pol.unitRate;
    const seed: ActionSeed = {
      materialId: material.id, materialDesc: material.description, plantId: material.plant_id, kind: opp.kind,
      currentValue: material.current_stock_value, proposedValue: Math.round(proposed),
      savings: Math.round(opp.savings), cashRelease: Math.round(opp.savings * 0.7), justification: opp.why,
    };
    openAction(seed);
  };

  const coverBad = !!pol && (material.on_hand_qty < pol.rol || material.on_hand_qty > pol.max);

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-5">
      <button onClick={onBack} className="mb-3 inline-flex items-center gap-1.5 rounded-lg border border-navy-200 px-2.5 py-1 text-[13px] font-medium text-navy-600 hover:bg-navy-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-white/5">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to SKU list
      </button>

      {/* Header + classification */}
      <div className="mb-4">
        <h1 className="text-[20px] font-semibold tracking-tight">{material.description}</h1>
        <div className="mt-0.5 font-mono text-[12.5px] text-navy-400 dark:text-slate-500">{material.id} · {material.plant_id} · {material.category} · {material.supplier}</div>
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
          <span className="text-[14px] font-semibold">Sage's read on this SKU</span>
          <button onClick={() => loadInsight(serviceLevel)} disabled={insightLoading}
            className="ml-auto inline-flex items-center gap-1 rounded-md border border-navy-200 px-2 py-0.5 text-[12px] font-medium text-navy-500 hover:bg-navy-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-white/5">
            <RefreshCw className={`h-3 w-3 ${insightLoading ? 'animate-spin' : ''}`} /> Re-run at {serviceLevel}%
          </button>
        </div>
        {insightLoading && !insight ? (
          <div className="flex items-center gap-2 text-[13.5px] text-navy-400 dark:text-slate-500"><Spinner /> Analyzing this SKU…</div>
        ) : (
          <>
            <p className="text-[14px] leading-relaxed text-navy-700 dark:text-slate-200">{insight?.insight || detail?.insight || 'Insight unavailable.'}</p>
            {!!insight?.actions?.length && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {insight.actions.map((a, i) => (
                  <span key={i} className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[12px] font-medium text-navy-600 ring-1 ring-navy-100 dark:bg-[#0e1730] dark:text-slate-300 dark:ring-slate-700">
                    <ArrowRight className="h-3 w-3 text-accent-500" />{a}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {loading && !detail ? (
        <div className="flex h-64 items-center justify-center gap-2.5 text-[14.5px] text-navy-400 dark:text-slate-500"><Spinner className="h-5 w-5" /> Running analysis…</div>
      ) : !detail ? (
        <div className="flex h-64 items-center justify-center text-[14.5px] text-navy-400 dark:text-slate-500">Analysis unavailable — the backend is not reachable.</div>
      ) : (
        <div className="space-y-4">
          {/* Policy stat row — the single stocking policy (safety stock / ROL / ROQ) */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            <Stat value={`${rate.toFixed(1)}`} label="Avg demand / mo" sub={`trend ${detail.trend_pct >= 0 ? '+' : ''}${detail.trend_pct}%`} tone={detail.trend_pct >= 0 ? 'mint' : 'rose'} />
            <Stat value={pol ? String(pol.ss) : '—'} label="Safety stock" sub={pol ? money(pol.ssVal) : undefined} tone="violet" />
            <Stat value={pol ? String(pol.rol) : '—'} label="Reorder level (ROL)" sub={pol ? `lead ${pol.lead}d` : undefined} />
            <Stat value={pol ? String(pol.roq) : '—'} label="Reorder qty (ROQ)" sub={pol ? `class ${policy?.abc}` : undefined} />
            <Stat value={`${material.coverage_days}d`} label="Current coverage" sub={pol ? `SL ${pol.sl}%` : undefined} tone={coverBad ? 'amber' : 'mint'} />
            <Stat value={String(material.on_hand_qty)} label="On-hand units" sub={money(material.current_stock_value)} />
          </div>

          {/* Full stocking policy — our standard replenishment method */}
          {policy && (
            <Panel title="Inventory stocking policy" sub="service-level safety stock · class-based reorder qty · 30-day lead">
              {!policy.active ? (
                <div className="text-[13.5px] text-navy-400 dark:text-slate-500">Inactive material — no consumption, receipts or stock on record.</div>
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
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <PolicyStat label="Safety stock" qty={policy.safety_stock} val={policy.ss_value} tone="violet" />
                    <PolicyStat label="Reorder level (ROL)" qty={policy.rol} val={policy.rol_value} />
                    <PolicyStat label="Maximum stock" qty={policy.max_stock} val={policy.max_value} tone="amber" />
                    <PolicyStat label="Average stock" qty={policy.avg_stock} val={policy.avg_value} tone="mint" />
                  </div>
                  <div className="mt-2.5 text-[12px] text-navy-400 dark:text-slate-500">Annual consumption value {typeof policy.annual_consumption_value === 'number' ? money(policy.annual_consumption_value) : policy.annual_consumption_value} · consumption in {String(policy.consumption_months)} months · avg {policy.avg_monthly_consumption}/mo</div>
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
                      <span className="text-[13px] font-semibold">{d.label}</span>
                    </div>
                    <p className="text-[12px] leading-relaxed text-navy-500 dark:text-slate-400">{d.detail}</p>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {/* Recommended action — the single stocking policy → the play that follows */}
          <Panel title="Recommended action" sub="from the stocking policy · save a snapshot to attach as evidence">
              {opp && (
                <div className="flex flex-col">
                  <div className="mb-3 flex items-center gap-2 border-b border-navy-100 pb-3 dark:border-slate-800">
                    <button onClick={takeSnapshot} disabled={!pol} className="inline-flex items-center gap-1.5 rounded-lg border border-accent-500/40 bg-accent-500/10 px-2.5 py-1.5 text-[13px] font-semibold text-accent-600 hover:bg-accent-500/15 disabled:opacity-50 dark:text-accent-400">
                      <Camera className="h-3.5 w-3.5" /> Save policy snapshot
                    </button>
                    <span className="text-[12px] text-navy-400 dark:text-slate-500">Captures the current SS / ROL / ROQ so you can attach it to this action as evidence.</span>
                  </div>
                  {snaps.length > 0 && (
                    <div className="mb-3 space-y-1.5">
                      {snaps.map((s) => {
                        const attached = pendingSnapshot?.savedAt === s.savedAt;
                        return (
                          <div key={s.savedAt} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[12.5px] ${attached ? 'border-accent-500/50 bg-accent-500/[0.06]' : 'border-navy-100 dark:border-slate-800'}`}>
                            <Camera className="h-3.5 w-3.5 text-navy-400 dark:text-slate-500" />
                            <span className="font-medium">{s.scenario}</span>
                            <span className="text-navy-400 dark:text-slate-500">· invest {money(s.investment)}</span>
                            <button onClick={() => saveSnapshot(s)} className={`ml-auto inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11.5px] font-semibold ${attached ? 'bg-accent-500 text-white' : 'border border-navy-200 text-navy-500 hover:bg-navy-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-white/5'}`}>
                              <Paperclip className="h-3 w-3" />{attached ? 'Attached' : 'Attach'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className={`mb-2 inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-[12.5px] font-semibold ${opp.tone === 'rose' ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400' : opp.tone === 'amber' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'}`}>
                    {opp.tone === 'rose' ? <AlertTriangle className="h-3.5 w-3.5" /> : opp.tone === 'mint' ? <PackageCheck className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
                    {KIND_LABEL[opp.kind]}
                  </div>
                  {opp.savings > 0 && <div className="text-[26px] font-semibold tracking-tight text-amber-600 dark:text-amber-400">{money(opp.savings)}</div>}
                  {opp.savings > 0 && <div className="mb-1 text-[11.5px] uppercase tracking-wide text-navy-400 dark:text-slate-500">potential savings</div>}
                  <p className="text-[13px] leading-relaxed text-navy-600 dark:text-slate-400">{opp.why}</p>
                  {opp.kind !== 'keep_unchanged' && (
                    <div className="mt-3">
                      {pendingSnapshot ? (
                        <div className="mb-2 flex items-center gap-1.5 rounded-lg border border-accent-500/40 bg-accent-500/[0.06] px-2.5 py-1.5 text-[12px]">
                          <Paperclip className="h-3 w-3 text-accent-500" />
                          <span className="font-medium text-accent-600 dark:text-accent-400">Scenario attached</span>
                          <span className="truncate text-navy-500 dark:text-slate-400">{pendingSnapshot.scenario}</span>
                          <button onClick={clearSnapshot} className="ml-auto text-navy-400 hover:text-rose-500"><X className="h-3 w-3" /></button>
                        </div>
                      ) : (
                        <div className="mb-2 text-[12px] text-navy-400 dark:text-slate-500">Tip: save a scenario above to attach it as evidence.</div>
                      )}
                      <button onClick={act} className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent-500 px-3 py-2 text-[13.5px] font-semibold text-white hover:bg-accent-600">
                        <Sparkles className="h-3.5 w-3.5" /> Create action → workflow
                      </button>
                    </div>
                  )}
                </div>
              )}
          </Panel>

          {/* Audit trail — every action raised on this material and where it stands */}
          <Panel title="Audit trail" sub={audit.length ? `${audit.length} action${audit.length > 1 ? 's' : ''} on record` : undefined}>
            {audit.length === 0 ? (
              <div className="flex items-center gap-2 py-2 text-[13px] text-navy-400 dark:text-slate-500">
                <History className="h-4 w-4" /> No actions have been raised on this SKU yet.
              </div>
            ) : (
              <div className="space-y-3">
                {audit.map((r) => (
                  <div key={r.id} className="rounded-lg border border-navy-100 p-3 dark:border-slate-800">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[12px] text-navy-400 dark:text-slate-500">{r.id}</span>
                      <span className="text-[13.5px] font-semibold">{KIND_LABEL[r.kind] ?? r.kind}</span>
                      {r.savings > 0 && <span className="text-[13px] font-semibold text-amber-600 dark:text-amber-400">{money(r.savings)}</span>}
                      <span className={`rounded px-1.5 py-0.5 text-[11.5px] font-semibold ${STAGE_TONE[r.stage]}`}>{STAGE_LABEL[r.stage]}</span>
                      {r.snapshot && <span className="inline-flex items-center gap-1 rounded bg-accent-500/10 px-1.5 py-0.5 text-[11.5px] font-medium text-accent-600 dark:text-accent-400"><Paperclip className="h-2.5 w-2.5" />{r.snapshot.scenario}</span>}
                      <span className="ml-auto text-[12px] text-navy-400 dark:text-slate-500">{ago(r.createdAt)}</span>
                    </div>
                    <ol className="mt-2 space-y-1 border-l border-navy-100 pl-3 dark:border-slate-800">
                      {r.history.map((h, i) => (
                        <li key={i} className="flex flex-wrap items-baseline gap-x-1.5 text-[12px] text-navy-500 dark:text-slate-400">
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
