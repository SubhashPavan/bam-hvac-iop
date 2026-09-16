import { useMemo, useState } from 'react';
import {
  ComposedChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import { Search, ChevronDown, ArrowRight, FlaskConical, ArrowLeftRight, Copy, Check } from 'lucide-react';
import { makeForecast, materialInsights } from '../../data/inventoryMock';
import type { Material, Recommendation } from '../../types/inventory';
import { useRequestStore, type ActionKind } from '../../store/requestStore';

const money = (n: number) => (Math.abs(n) >= 1_000_000 ? `€${(n / 1_000_000).toFixed(2)}M` : Math.abs(n) >= 1_000 ? `€${(n / 1_000).toFixed(1)}K` : `€${Math.round(n)}`);
const C = { indigo: '#6366f1', amber: '#f59e0b', mint: '#22c55e', rose: '#f43f5e' };
const AXIS = 'text-navy-400 dark:text-slate-500';
const GRID = 'text-navy-100 dark:text-slate-800';
const tip = { fontSize: 11, borderRadius: 8, border: '1px solid rgba(120,120,140,0.2)' };
const VED_TONE: Record<string, string> = { Vital: 'bg-rose-500/15 text-rose-600 dark:text-rose-400', Essential: 'bg-amber-500/15 text-amber-600 dark:text-amber-400', Desirable: 'bg-navy-100 text-navy-500 dark:bg-slate-800 dark:text-slate-400' };

type FilterKey = 'all' | 'review' | 'vital' | 'excess' | 'obsolete' | 'risk';
const FILTERS: { k: FilterKey; label: string }[] = [
  { k: 'all', label: 'All' }, { k: 'review', label: 'Needs review' }, { k: 'vital', label: 'Vital' },
  { k: 'excess', label: 'Excess' }, { k: 'obsolete', label: 'Obsolete' }, { k: 'risk', label: 'At risk' },
];

export default function MaterialsView({ mats, recs }: { mats: Material[]; recs: Recommendation[]; onSubmit?: (id: string, label: string) => void }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const recIds = useMemo(() => new Set(recs.map((r) => r.material_id)), [recs]);

  const filtered = useMemo(() => mats.filter((m) => {
    if (filter === 'review' && !(recIds.has(m.id) || m.fsn === 'Non-moving' || (m.ved === 'Vital' && m.coverage_days < 20) || m.coverage_days > 200)) return false;
    if (filter === 'vital' && m.ved !== 'Vital') return false;
    if (filter === 'excess' && !(m.coverage_days > 180)) return false;
    if (filter === 'obsolete' && m.fsn !== 'Non-moving') return false;
    if (filter === 'risk' && !((m.ved === 'Vital' || m.ved === 'Essential') && m.coverage_days < 20)) return false;
    if (q) { const s = q.toLowerCase(); return m.description.toLowerCase().includes(s) || m.id.includes(s) || m.supplier.toLowerCase().includes(s) || m.category.toLowerCase().includes(s); }
    return true;
  }), [mats, filter, q, recIds]);

  return (
    <div className="px-6 py-5">
      <div className="mb-4">
        <h1 className="text-[20px] font-semibold tracking-tight">Materials</h1>
        <p className="text-[14px] text-navy-500 dark:text-slate-500">Every SKU across your plants · open a row for its 360° — demand, cross-plant usage, opportunities, duplicates</p>
      </div>

      {/* Search + filters */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-lg border border-navy-200 bg-white px-3 py-1.5 dark:border-slate-700 dark:bg-slate-900">
          <Search className="h-3.5 w-3.5 text-navy-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search material, id, supplier, category…" className="w-56 border-none bg-transparent text-[14px] outline-none placeholder:text-navy-400 dark:text-slate-200" />
        </div>
        {FILTERS.map((f) => (
          <button key={f.k} onClick={() => setFilter(f.k)} className={`rounded-lg px-2.5 py-1.5 text-[13.5px] font-semibold ${filter === f.k ? 'bg-accent-500 text-white' : 'bg-navy-100 text-navy-600 hover:bg-navy-200 dark:bg-slate-800 dark:text-slate-300'}`}>{f.label}</button>
        ))}
        <span className="ml-auto rounded-full bg-accent-500/10 px-3 py-1 text-[13px] font-medium text-accent-700 dark:text-accent-300">{filtered.length} of {mats.length}</span>
      </div>

      <div className="overflow-hidden rounded-xl border border-navy-100 dark:border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-[13.5px]">
            <thead>
              <tr className="border-b border-navy-100 bg-navy-50/60 text-left text-[11.5px] uppercase tracking-wide text-navy-400 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-500">
                <th className="px-4 py-2.5 font-semibold">Material</th>
                <th className="px-3 py-2.5 font-semibold">Plant</th>
                <th className="px-3 py-2.5 font-semibold">Class</th>
                <th className="px-3 py-2.5 text-right font-semibold">Cover</th>
                <th className="px-3 py-2.5 text-right font-semibold">Stock value</th>
                <th className="px-3 py-2.5 font-semibold">Opportunity</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 60).map((m) => <MaterialRow key={m.id} m={m} open={openId === m.id} onToggle={() => setOpenId(openId === m.id ? null : m.id)} />)}
              {filtered.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-[14.5px] text-navy-500 dark:text-slate-400">No materials match.</td></tr>}
            </tbody>
          </table>
        </div>
        {filtered.length > 60 && <div className="border-t border-navy-100 px-4 py-2 text-center text-[12.5px] text-navy-400 dark:border-slate-800 dark:text-slate-500">Showing 60 of {filtered.length} — refine your search.</div>}
      </div>
    </div>
  );
}

function MaterialRow({ m, open, onToggle }: { m: Material; open: boolean; onToggle: () => void }) {
  const openAction = useRequestStore((s) => s.openAction);
  const requests = useRequestStore((s) => s.requests).filter((r) => r.materialId === m.id);
  const ins = useMemo(() => materialInsights(m), [m]);
  const fc = useMemo(() => makeForecast(m, 12), [m]);
  const safety = Math.round(m.avg_monthly_demand * 1.5);

  const act = () => {
    const o = ins.opportunity; if (!o) return;
    openAction({
      materialId: m.id, materialDesc: m.description, plantId: m.plant_id, kind: o.kind as ActionKind,
      currentValue: m.current_stock_value,
      proposedValue: o.kind === 'dispose' ? 0 : o.kind === 'reduce_stock' ? Math.round(m.current_stock_value * 0.6) : (o.kind === 'increase_stock' || o.kind === 'expedite') ? Math.round(m.current_stock_value * 1.3) : Math.round(m.current_stock_value * 0.85),
      savings: o.savings, cashRelease: o.kind === 'dispose' ? Math.round(m.current_stock_value * 0.5) : o.savings, justification: `${o.label}: ${o.note}.`,
    });
  };

  return (
    <>
      <tr className={`border-b border-navy-50 hover:bg-navy-50/50 dark:border-slate-800/60 dark:bg-[#211c33] dark:hover:bg-slate-800/30 ${open ? 'bg-navy-50/50 dark:bg-slate-800/30' : ''}`}>
        <td className="px-4 py-2.5"><div className="font-medium">{m.description}</div><div className="font-mono text-[11.5px] text-navy-400 dark:text-slate-500">{m.id} · {m.supplier}</div></td>
        <td className="px-3 py-2.5 text-navy-500 dark:text-slate-400">{m.plant_id}</td>
        <td className="px-3 py-2.5"><span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${VED_TONE[m.ved]}`}>{m.ved}</span> <span className="text-[11.5px] text-navy-400 dark:text-slate-500">{m.xyz}·{m.fsn[0]}</span></td>
        <td className={`px-3 py-2.5 text-right font-medium ${m.coverage_days < 15 ? 'text-rose-600 dark:text-rose-400' : ''}`}>{m.coverage_days}d</td>
        <td className="px-3 py-2.5 text-right tabular-nums">{money(m.current_stock_value)}</td>
        <td className="px-3 py-2.5">{ins.opportunity ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/12 px-2 py-0.5 text-[11.5px] font-semibold text-amber-600 dark:text-amber-400">{ins.opportunity.label} · {money(ins.opportunity.savings)}</span> : <span className="text-[12.5px] text-navy-300 dark:text-slate-600">—</span>}</td>
        <td className="px-3 py-2.5 text-right"><button onClick={onToggle} className="rounded-lg p-1 text-navy-400 hover:bg-navy-100 dark:text-slate-500 dark:hover:bg-slate-800"><ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} /></button></td>
      </tr>
      {open && (
        <tr className="border-b border-navy-100 bg-navy-50/40 dark:border-slate-800 dark:bg-slate-900/30">
          <td colSpan={7} className="px-6 py-4">
            {/* KPI strip */}
            <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              <Mini label="Stock value" value={money(m.current_stock_value)} />
              <Mini label="On hand" value={`${m.on_hand_qty}`} sub="units" />
              <Mini label="Avg demand" value={`${m.avg_monthly_demand}`} sub="/mo" />
              <Mini label="Coverage" value={`${m.coverage_days}d`} tone={m.coverage_days < 15 ? 'rose' : undefined} />
              <Mini label="Criticality" value={`${m.criticality_score}`} sub="/100" />
              <Mini label="Unit cost" value={money(m.unit_cost)} />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Demand + forecast */}
              <Panel title="Demand & forecast" sub="6 mo actual · 12 mo forecast">
                <div className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={fc.points} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className={GRID} />
                      <XAxis dataKey="label" tick={{ fontSize: 9 }} stroke="currentColor" className={AXIS} />
                      <YAxis tick={{ fontSize: 10 }} stroke="currentColor" className={AXIS} />
                      <Tooltip contentStyle={tip} />
                      <Line type="monotone" dataKey="upper" name="Upper" stroke={C.amber} strokeDasharray="4 3" strokeWidth={1} dot={false} />
                      <Line type="monotone" dataKey="lower" name="Lower" stroke={C.amber} strokeDasharray="4 3" strokeWidth={1} dot={false} />
                      <Line type="monotone" dataKey="forecast" name="Forecast" stroke={C.indigo} strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="actual" name="Actual" stroke={C.mint} strokeWidth={2} dot={false} connectNulls={false} />
                      <ReferenceLine y={safety} stroke={C.rose} strokeDasharray="5 4" strokeOpacity={0.6} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-1 text-[12px] text-navy-500 dark:text-slate-400">{fc.demand_pattern} demand ({m.xyz}-class) · {fc.forecast_confidence}% accuracy · safety stock ≈ {safety}</div>
              </Panel>

              {/* Usage history */}
              <Panel title="Usage history" sub="monthly consumption, trailing 12 mo">
                <div className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ins.usageTrend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className={GRID} />
                      <XAxis dataKey="month" tick={{ fontSize: 9 }} stroke="currentColor" className={AXIS} />
                      <YAxis tick={{ fontSize: 10 }} stroke="currentColor" className={AXIS} />
                      <Tooltip formatter={(v) => `${v} units`} contentStyle={tip} />
                      <Bar dataKey="used" radius={[3, 3, 0, 0]}>{ins.usageTrend.map((_, i) => <Cell key={i} fill={C.indigo} />)}</Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
              {/* Cross-plant */}
              <Panel title="Same item across plants" sub={`${ins.crossPlant.length} plants stock this`}>
                {ins.crossPlant.length === 0 ? <div className="py-3 text-center text-[13px] text-navy-500 dark:text-slate-400">Unique to this plant.</div> : (
                  <div className="flex flex-col gap-1">
                    {ins.crossPlant.map((c, i) => (
                      <div key={i} className="flex items-center gap-2 text-[13px]">
                        <span className="w-20 truncate">{c.plantName}</span>
                        <span className={`${c.coverage < 15 ? 'text-rose-600 dark:text-rose-400' : c.coverage > 120 ? 'text-emerald-600 dark:text-emerald-400' : 'text-navy-500 dark:text-slate-400'}`}>{c.coverage}d</span>
                        <span className="ml-auto tabular-nums text-navy-500 dark:text-slate-400">{money(c.stockValue)}</span>
                        {c.coverage > 120 && <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10.5px] font-semibold text-emerald-600 dark:text-emerald-400">excess</span>}
                      </div>
                    ))}
                  </div>
                )}
                {ins.transferSavings > 0 && <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-accent-500/5 px-2.5 py-1.5 text-[12.5px] text-accent-700 dark:bg-accent-500/10 dark:text-accent-300"><ArrowLeftRight className="h-3.5 w-3.5" /> Transfer could save {money(ins.transferSavings)}.</div>}
              </Panel>

              {/* Opportunity + act */}
              <Panel title="Opportunity">
                {ins.opportunity ? (
                  <div>
                    <div className="text-[14.5px] font-semibold text-amber-600 dark:text-amber-400">{money(ins.opportunity.savings)}</div>
                    <div className="text-[13px] font-medium">{ins.opportunity.label}</div>
                    <p className="mt-0.5 text-[12.5px] text-navy-500 dark:text-slate-400">{ins.opportunity.note}</p>
                    <button onClick={act} className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-accent-500 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-accent-600">Submit as action <ArrowRight className="h-3.5 w-3.5" /></button>
                  </div>
                ) : <div className="py-3 text-[13px] text-navy-500 dark:text-slate-400">No optimization opportunity — well-balanced.</div>}
              </Panel>

              {/* Duplicates + history */}
              <Panel title="Duplicates & history">
                {ins.duplicates.length > 0 && (
                  <div className="mb-2">
                    <div className="mb-1 flex items-center gap-1 text-[11.5px] font-semibold uppercase tracking-wide text-navy-400 dark:text-slate-500"><Copy className="h-3 w-3" /> {ins.duplicates.length} potential duplicates</div>
                    {ins.duplicates.slice(0, 3).map((d) => <div key={d.id} className="truncate text-[12.5px] text-navy-600 dark:text-slate-300">{d.id} · {d.plant_id} · {money(d.current_stock_value)}</div>)}
                  </div>
                )}
                <div className="text-[11.5px] font-semibold uppercase tracking-wide text-navy-400 dark:text-slate-500">Action history</div>
                {requests.length === 0 ? <div className="text-[12.5px] text-navy-500 dark:text-slate-400">No actions raised yet.</div> : requests.map((r) => (
                  <div key={r.id} className="flex items-center gap-1.5 text-[12.5px]"><Check className="h-3 w-3 text-emerald-500" /> {r.id} · <span className="text-navy-500 dark:text-slate-400">{r.stage}</span></div>
                ))}
                {ins.opportunity && <div className="mt-1.5 inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[11.5px] font-medium text-amber-600 dark:text-amber-400"><FlaskConical className="h-3 w-3" /> potential {money(ins.opportunity.savings)}</div>}
              </Panel>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function Mini({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'rose' }) {
  return (
    <div className="rounded-lg border border-navy-100 bg-white px-2.5 py-1.5 dark:border-slate-800 dark:bg-[#211c33]">
      <div className="text-[10.5px] uppercase tracking-wide text-navy-400 dark:text-slate-500">{label}</div>
      <div className={`text-[15.5px] font-semibold ${tone === 'rose' ? 'text-rose-600 dark:text-rose-400' : ''}`}>{value}{sub && <span className="ml-0.5 text-[10.5px] font-normal text-navy-400 dark:text-slate-500">{sub}</span>}</div>
    </div>
  );
}
function Panel({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-navy-100 bg-white p-3 dark:border-slate-800 dark:bg-[#211c33]">
      <div className="mb-2 flex flex-wrap items-baseline gap-x-2"><span className="text-[13.5px] font-semibold">{title}</span>{sub && <span className="text-[12px] text-navy-400 dark:text-slate-500">{sub}</span>}</div>
      {children}
    </div>
  );
}
