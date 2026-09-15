import { useMemo, useState } from 'react';
import { AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Target, Coins, CheckCircle2, TrendingUp, Layers, Gauge, Search } from 'lucide-react';
import { PLANTS, savingsFunnel } from '../../data/inventoryMock';
import { REC_TYPE_LABEL, type Recommendation, type RecommendationType } from '../../types/inventory';
import { useRequestStore, ACTION_LABEL, STAGE_LABEL } from '../../store/requestStore';
import { useLiveOrMock } from './useLiveData';
import { getSavingsMatrix } from '../../services/inventoryApi';

const money = (n: number) => (Math.abs(n) >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : Math.abs(n) >= 1_000 ? `$${(n / 1_000).toFixed(0)}K` : `$${Math.round(n)}`);
const plantName = (id: string) => PLANTS.find((p) => p.id === id)?.name || id;
const C = { indigo: '#6366f1', amber: '#f59e0b', mint: '#22c55e', rose: '#f43f5e', violet: '#8b5cf6', cyan: '#0891b2' };
const AXIS = 'text-navy-400 dark:text-slate-500';
const GRID = 'text-navy-100 dark:text-slate-800';
const tip = { fontSize: 11, borderRadius: 8, border: '1px solid rgba(120,120,140,0.2)' };
const STAGE_TONE: Record<string, string> = { done: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', rejected: 'bg-rose-500/15 text-rose-600 dark:text-rose-400', executing: 'bg-violet-500/15 text-violet-600 dark:text-violet-400' };

export default function SavingsTracker({ recs, selected }: { recs: Recommendation[]; selected: string[] }) {
  const f = useMemo(() => savingsFunnel(recs), [recs]);
  const requests = useRequestStore((s) => s.requests).filter((r) => selected.includes(r.plantId));
  const [q, setQ] = useState('');
  const shownReqs = requests.filter((r) => { if (!q) return true; const s = q.toLowerCase(); return r.materialDesc.toLowerCase().includes(s) || r.id.toLowerCase().includes(s) || STAGE_LABEL[r.stage].toLowerCase().includes(s) || ACTION_LABEL[r.kind].toLowerCase().includes(s); });

  // "Identified" reconciles with the Savings Wizard — the same savings-matrix opportunity
  // (fall back to the mock funnel when the backend is unreachable). The funnel: identified
  // (matrix) → in pipeline (raised requests) → realized (completed requests).
  const wiz = useLiveOrMock<any>(() => getSavingsMatrix(selected), null, [selected.join(',')]);
  const identified = wiz?.kpis?.total_opportunity ?? f.identified;

  const doneReq = requests.filter((r) => r.stage === 'done');
  const activeReq = requests.filter((r) => !['done', 'rejected'].includes(r.stage));
  const realized = f.implemented + doneReq.reduce((n, r) => n + r.savings, 0);
  const cashReleased = f.cashReleased + doneReq.reduce((n, r) => n + r.cashRelease, 0);
  const inPipeline = activeReq.reduce((n, r) => n + r.savings, 0);
  const utilization = identified ? Math.round((realized / identified) * 100) : 0;

  const byPlant = useMemo(() => {
    const m = new Map<string, number>();
    recs.forEach((r) => m.set(r.plant_id, (m.get(r.plant_id) || 0) + r.savings_potential));
    return Array.from(m, ([plant, value]) => ({ plant: plantName(plant), value })).sort((a, b) => b.value - a.value);
  }, [recs]);
  const byType = f.byType.map((t: { type: RecommendationType; identified: number; utilized: number }) => ({ ...t, label: REC_TYPE_LABEL[t.type] }));

  return (
    <div className="px-6 py-5">
      <div className="mb-4">
        <h1 className="text-[20px] font-semibold tracking-tight">Savings Tracker</h1>
        <p className="text-[14px] text-navy-500 dark:text-slate-500">Actions taken · realized savings · financial impact · by opportunity & geography</p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Kpi icon={Target} tone="indigo" value={money(identified)} label="Identified" sub="portfolio opportunity" />
        <Kpi icon={Gauge} tone="amber" value={money(inPipeline)} label="In pipeline" sub={`${activeReq.length} in flight`} />
        <Kpi icon={CheckCircle2} tone="mint" value={money(realized)} label="Realized" sub={`${utilization}% utilization`} />
        <Kpi icon={Coins} tone="mint" value={money(cashReleased)} label="Cash released" sub="working capital" />
        <Kpi icon={TrendingUp} tone="violet" value={`${utilization}%`} label="Capture rate" sub="realized / identified" />
        <Kpi icon={Layers} tone="indigo" value={String(requests.length)} label="Actions taken" sub={`${doneReq.length} completed`} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Savings realization" sub="cumulative · identified vs realized">
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={f.realization} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="stId" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.indigo} stopOpacity={0.25} /><stop offset="100%" stopColor={C.indigo} stopOpacity={0.02} /></linearGradient>
                  <linearGradient id="stRe" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.mint} stopOpacity={0.3} /><stop offset="100%" stopColor={C.mint} stopOpacity={0.02} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className={GRID} />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="currentColor" className={AXIS} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={money} stroke="currentColor" className={AXIS} />
                <Tooltip formatter={(v) => money(Number(v))} contentStyle={tip} />
                <Area type="monotone" dataKey="identified" name="Identified" stroke={C.indigo} strokeWidth={2} fill="url(#stId)" />
                <Area type="monotone" dataKey="realized" name="Realized" stroke={C.mint} strokeWidth={2} fill="url(#stRe)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Savings by opportunity type" sub="identified vs realized">
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byType} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className={GRID} />
                <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={0} stroke="currentColor" className={AXIS} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={money} stroke="currentColor" className={AXIS} />
                <Tooltip formatter={(v) => money(Number(v))} contentStyle={tip} />
                <Bar dataKey="identified" name="Identified" fill={C.indigo} radius={[3, 3, 0, 0]} />
                <Bar dataKey="utilized" name="Realized" fill={C.mint} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Savings by plant" sub="geography of impact">
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byPlant} layout="vertical" margin={{ left: 12, right: 12, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="currentColor" className={GRID} />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={money} stroke="currentColor" className={AXIS} />
                <YAxis type="category" dataKey="plant" tick={{ fontSize: 10 }} width={64} stroke="currentColor" className={AXIS} />
                <Tooltip formatter={(v) => money(Number(v))} contentStyle={tip} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>{byPlant.map((_, i) => <Cell key={i} fill={[C.indigo, C.cyan, C.violet, C.amber][i % 4]} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Actions taken" sub={`${requests.length} requests from this workspace`}>
          {requests.length === 0 ? (
            <div className="py-10 text-center text-[14px] text-navy-500 dark:text-slate-400">No actions yet — act on a recommendation or opportunity to start tracking realized savings here.</div>
          ) : (
            <>
            <div className="mb-2 flex items-center gap-2 rounded-lg border border-navy-200 bg-white px-2.5 py-1 dark:border-slate-700 dark:bg-slate-900 sm:w-64">
              <Search className="h-3.5 w-3.5 text-navy-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search actions…" className="w-full border-none bg-transparent text-[13.5px] outline-none placeholder:text-navy-400 dark:text-slate-200" />
            </div>
            <div className="custom-scrollbar flex max-h-[240px] flex-col gap-1.5 overflow-y-auto pr-1">
              {shownReqs.map((r) => (
                <div key={r.id} className="flex items-center gap-3 rounded-lg border border-navy-100 px-3 py-2 dark:border-slate-800">
                  <span className="rounded-full bg-accent-500/10 px-2 py-0.5 text-[11px] font-semibold text-accent-700 dark:text-accent-300">{ACTION_LABEL[r.kind]}</span>
                  <div className="min-w-0 flex-1"><div className="truncate text-[13.5px] font-medium">{r.materialDesc}</div><div className="text-[11.5px] text-navy-400 dark:text-slate-500">{r.plantId} · {money(r.savings)}</div></div>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STAGE_TONE[r.stage] || 'bg-accent-500/15 text-accent-600 dark:text-accent-400'}`}>{STAGE_LABEL[r.stage]}</span>
                </div>
              ))}
              {shownReqs.length === 0 && <div className="py-4 text-center text-[13px] text-navy-500 dark:text-slate-400">No matching actions.</div>}
            </div>
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-navy-100 bg-white p-4 dark:border-slate-800 dark:bg-[#211c33]">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-2"><span className="text-[14px] font-semibold">{title}</span>{sub && <span className="text-[12.5px] text-navy-400 dark:text-slate-500">{sub}</span>}</div>
      {children}
    </div>
  );
}
const TONE: Record<string, string> = { indigo: 'bg-accent-500/12 text-accent-600 dark:text-accent-400', amber: 'bg-amber-500/12 text-amber-600 dark:text-amber-400', mint: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400', violet: 'bg-violet-500/12 text-violet-600 dark:text-violet-400' };
function Kpi({ icon: Icon, tone, value, label, sub }: { icon: typeof Target; tone: string; value: string; label: string; sub: string }) {
  return (
    <div className="rounded-xl border border-navy-100 bg-white p-3.5 dark:border-slate-800 dark:bg-[#211c33]">
      <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${TONE[tone]}`}><Icon className="h-4 w-4" /></span>
      <div className="mt-2.5 text-[21px] font-semibold leading-none tracking-tight">{value}</div>
      <div className="mt-1.5 text-[12.5px] font-medium">{label}</div>
      <div className="text-[11.5px] text-navy-400 dark:text-slate-500">{sub}</div>
    </div>
  );
}
