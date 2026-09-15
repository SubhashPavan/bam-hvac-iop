import { useMemo, useState } from 'react';
import {
  Brain, TrendingDown, XCircle, AlertTriangle, TrendingUp, ChevronDown,
  Check, Clock, Ban, Sparkles, Search,
} from 'lucide-react';
import { recSummary } from '../../data/inventoryMock';
import {
  REC_TYPE_LABEL, WORKFLOW_LABEL,
  type Recommendation, type RecommendationType, type WorkflowStatus,
} from '../../types/inventory';

const money = (n: number) => (Math.abs(n) >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : Math.abs(n) >= 1_000 ? `$${(n / 1_000).toFixed(1)}K` : `$${n.toFixed(0)}`);

const TYPE_TONE: Record<RecommendationType, string> = {
  reduce_stock: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  dispose: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  increase_stock: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  keep_unchanged: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300',
  emergency_action: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
};
const TYPE_ICON: Record<RecommendationType, typeof TrendingDown> = {
  reduce_stock: TrendingDown, dispose: XCircle, increase_stock: TrendingUp, keep_unchanged: TrendingDown, emergency_action: AlertTriangle,
};
const WF_TONE: Record<WorkflowStatus, string> = {
  pending: 'text-amber-600 dark:text-amber-400',
  eng_approved: 'text-sky-600 dark:text-sky-400',
  maint_approved: 'text-violet-600 dark:text-violet-400',
  finance_approved: 'text-emerald-600 dark:text-emerald-400',
  implemented: 'text-emerald-600 dark:text-emerald-400',
  rejected: 'text-rose-600 dark:text-rose-400',
};

export default function RecommendationsFull({ recs, onSubmit }: { recs: Recommendation[]; onSubmit: (id: string, label: string) => void }) {
  const [typeFilter, setTypeFilter] = useState<RecommendationType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<WorkflowStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [decided, setDecided] = useState<Record<string, 'accept' | 'partial' | 'reject'>>({});

  const summary = useMemo(() => recSummary(recs), [recs]);
  const filtered = useMemo(() => recs.filter((r) => {
    if (typeFilter !== 'all' && r.type !== typeFilter) return false;
    if (statusFilter !== 'all' && r.workflow_status !== statusFilter) return false;
    if (search) { const s = search.toLowerCase(); return r.material_desc.toLowerCase().includes(s) || r.material_id.includes(s) || r.plant_id.toLowerCase().includes(s); }
    return true;
  }), [recs, typeFilter, statusFilter, search]);

  const decide = (r: Recommendation, d: 'accept' | 'partial' | 'reject') => {
    setDecided((p) => ({ ...p, [r.id]: d }));
    if (d !== 'reject') onSubmit(r.id, r.material_desc);
  };

  return (
    <div className="px-6 py-5">
      <div className="mb-4">
        <h1 className="text-[20px] font-semibold tracking-tight">AI Recommendations</h1>
        <p className="text-[14px] text-navy-500 dark:text-slate-500">Explainable AI · Every recommendation with reasoning &amp; confidence · your plants</p>
      </div>

      {/* Top KPI cards */}
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={Brain} accent="sky" value={summary.total.toLocaleString()} label="Total Recommendations" sub="Non-trivial actions" />
        <Kpi icon={TrendingDown} accent="amber" value={money(summary.totalSavings)} label="Savings Identified" sub="All recommendations" />
        <Kpi icon={AlertTriangle} accent="red" value={String(summary.emergency)} label="Emergency Actions" sub="Immediate required" />
        <Kpi icon={XCircle} accent="rose" value={String(summary.disposal)} label="Disposal Candidates" sub="Obsolete write-offs" />
      </div>

      {/* Typed cards */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TypeCard type="reduce_stock" count={summary.types.reduce_stock.count} potential={summary.types.reduce_stock.potential} active={typeFilter === 'reduce_stock'} onClick={() => setTypeFilter(typeFilter === 'reduce_stock' ? 'all' : 'reduce_stock')} />
        <TypeCard type="dispose" count={summary.types.dispose.count} potential={summary.types.dispose.potential} active={typeFilter === 'dispose'} onClick={() => setTypeFilter(typeFilter === 'dispose' ? 'all' : 'dispose')} />
        <TypeCard type="increase_stock" count={summary.types.increase_stock.count} potential={summary.types.increase_stock.potential} active={typeFilter === 'increase_stock'} onClick={() => setTypeFilter(typeFilter === 'increase_stock' ? 'all' : 'increase_stock')} />
        <TypeCard type="emergency_action" count={summary.types.emergency_action.count} potential={summary.types.emergency_action.potential} active={typeFilter === 'emergency_action'} onClick={() => setTypeFilter(typeFilter === 'emergency_action' ? 'all' : 'emergency_action')} />
      </div>

      {/* Filters */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as RecommendationType | 'all')} className="rounded-lg border border-navy-200 bg-white px-3 py-1.5 text-[14px] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
          <option value="all">All Types</option>
          {(Object.keys(REC_TYPE_LABEL) as RecommendationType[]).map((t) => <option key={t} value={t}>{REC_TYPE_LABEL[t]}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as WorkflowStatus | 'all')} className="rounded-lg border border-navy-200 bg-white px-3 py-1.5 text-[14px] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
          <option value="all">All Status</option>
          {(Object.keys(WORKFLOW_LABEL) as WorkflowStatus[]).map((s) => <option key={s} value={s}>{WORKFLOW_LABEL[s]}</option>)}
        </select>
        <div className="flex items-center gap-2 rounded-lg border border-navy-200 bg-white px-3 py-1.5 dark:border-slate-700 dark:bg-slate-900">
          <Search className="h-3.5 w-3.5 text-navy-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search material, plant…" className="w-40 border-none bg-transparent text-[14px] outline-none placeholder:text-navy-400 dark:text-slate-200" />
        </div>
        <span className="rounded-full bg-accent-500/10 px-3 py-1 text-[13px] font-medium text-accent-700 dark:text-accent-300">{filtered.length} recommendations · {money(filtered.reduce((n, r) => n + r.savings_potential, 0))} savings</span>
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.map((r) => (
          <Row key={r.id} rec={r} open={openId === r.id} onToggle={() => setOpenId(openId === r.id ? null : r.id)} decision={decided[r.id]} onDecide={(d) => decide(r, d)} />
        ))}
        {filtered.length === 0 && <div className="rounded-xl border border-dashed border-navy-200 bg-white/50 px-6 py-14 text-center text-[14.5px] text-navy-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">No recommendations match these filters.</div>}
      </div>
    </div>
  );
}

const ACCENT: Record<string, string> = {
  sky: 'bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400',
  amber: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
  red: 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400',
  rose: 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400',
};
function Kpi({ icon: Icon, accent, value, label, sub }: { icon: typeof Brain; accent: string; value: string; label: string; sub: string }) {
  return (
    <div className="rounded-xl border border-navy-100 bg-white p-4 dark:border-slate-800 dark:bg-[#211c33]">
      <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${ACCENT[accent]}`}><Icon className="h-4 w-4" /></span>
      <div className="mt-3 text-[26px] font-semibold leading-none tracking-tight">{value}</div>
      <div className="mt-1.5 text-[13.5px] font-medium">{label}</div>
      <div className="text-[12px] text-navy-400 dark:text-slate-500">{sub}</div>
    </div>
  );
}

function TypeCard({ type, count, potential, active, onClick }: { type: RecommendationType; count: number; potential: number; active: boolean; onClick: () => void }) {
  const Icon = TYPE_ICON[type];
  return (
    <button onClick={onClick} className={`rounded-xl border bg-white p-4 text-left transition-all hover:shadow-md dark:bg-[#211c33] ${active ? 'border-accent-400 ring-2 ring-accent-500/20 dark:border-accent-500' : 'border-navy-100 dark:border-slate-800'}`}>
      <div className="flex items-center gap-1.5"><Icon className="h-3.5 w-3.5 text-navy-400 dark:text-slate-500" /><span className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${TYPE_TONE[type]}`}>{REC_TYPE_LABEL[type]}</span></div>
      <div className="mt-2 text-[26px] font-semibold leading-none">{count}</div>
      <div className="mt-1 text-[13px] font-medium text-amber-600 dark:text-amber-400">{money(potential)} potential</div>
    </button>
  );
}

function Row({ rec, open, onToggle, decision, onDecide }: { rec: Recommendation; open: boolean; onToggle: () => void; decision?: 'accept' | 'partial' | 'reject'; onDecide: (d: 'accept' | 'partial' | 'reject') => void }) {
  const Icon = TYPE_ICON[rec.type];
  return (
    <div className={`overflow-hidden rounded-xl border bg-white transition-colors dark:bg-[#211c33] ${open ? 'border-accent-300 dark:border-accent-500/50' : 'border-navy-100 dark:border-slate-800'}`}>
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TYPE_TONE[rec.type]}`}><Icon className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-mono text-[12.5px] text-navy-400 dark:text-slate-500">{rec.material_id}</span>
            <span className="text-[14.5px] font-medium">{rec.material_desc}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${TYPE_TONE[rec.type]}`}>{REC_TYPE_LABEL[rec.type]}</span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12.5px] text-navy-500 dark:text-slate-500">
            <span>{rec.plant_id}</span><span>·</span><span>{rec.country}</span><span>·</span>
            <span>Confidence: <span className="font-semibold text-navy-700 dark:text-slate-300">{rec.confidence}%</span></span><span>·</span>
            <span className={`font-medium ${WF_TONE[rec.workflow_status]}`}>● {WORKFLOW_LABEL[rec.workflow_status]}</span>
          </div>
        </div>
        <div className="shrink-0 text-right"><div className="text-[11.5px] text-navy-400 dark:text-slate-500">Savings</div><div className="text-[14.5px] font-semibold text-amber-600 dark:text-amber-400">{money(rec.savings_potential)}</div></div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-navy-400 transition-transform dark:text-slate-500 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-navy-100 px-4 py-3 dark:border-slate-800">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <MiniStat label="Current Stock Value" value={money(rec.current_stock_value)} />
            <MiniStat label="Recommended Value" value={money(rec.recommended_value)} tone="emerald" />
            <MiniStat label="Savings Potential" value={money(rec.savings_potential)} tone="amber" />
          </div>
          <div className="mt-3 rounded-xl bg-accent-500/5 p-3 dark:bg-accent-500/10">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[13.5px] font-semibold text-accent-700 dark:text-accent-300"><Sparkles className="h-3.5 w-3.5" /> AI Reasoning</span>
              <span className="flex items-center gap-2 text-[12.5px] text-navy-500 dark:text-slate-400">Confidence
                <span className="h-1.5 w-24 overflow-hidden rounded-full bg-navy-200 dark:bg-slate-700"><span className="block h-full rounded-full bg-accent-500" style={{ width: `${rec.confidence}%` }} /></span>
                <span className="font-semibold">{rec.confidence}%</span></span>
            </div>
            <p className="text-[14px] leading-relaxed text-navy-700 dark:text-slate-300">{rec.ai_reasoning}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Chip>Coverage: {rec.coverage_days}d</Chip><Chip>FSN: {rec.fsn}</Chip><Chip>VED: {rec.ved}</Chip><Chip>Criticality: {rec.criticality_score}/100</Chip>
            </div>
          </div>
          {decision ? (
            <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-[13.5px] font-medium text-emerald-600 dark:text-emerald-400">
              <Check className="h-3.5 w-3.5" /> {decision === 'accept' ? 'Accepted' : decision === 'partial' ? 'Partially accepted' : 'Rejected'}{decision !== 'reject' ? ' — routed to Maintenance Planner' : ''}
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => onDecide('accept')} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-[13.5px] font-semibold text-emerald-600 hover:bg-emerald-500/25 dark:text-emerald-400"><Check className="h-3.5 w-3.5" /> Accept</button>
              <button onClick={() => onDecide('partial')} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/15 px-3 py-1.5 text-[13.5px] font-semibold text-amber-600 hover:bg-amber-500/25 dark:text-amber-400"><Clock className="h-3.5 w-3.5" /> Partial Accept</button>
              <button onClick={() => onDecide('reject')} className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/15 px-3 py-1.5 text-[13.5px] font-semibold text-rose-600 hover:bg-rose-500/25 dark:text-rose-400"><Ban className="h-3.5 w-3.5" /> Reject</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: 'emerald' | 'amber' }) {
  const c = tone === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' : tone === 'amber' ? 'text-amber-600 dark:text-amber-400' : '';
  return (
    <div className="rounded-lg border border-navy-100 bg-navy-50/50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/40">
      <div className="text-[11.5px] uppercase tracking-wide text-navy-400 dark:text-slate-500">{label}</div>
      <div className={`text-[16.5px] font-semibold ${c}`}>{value}</div>
    </div>
  );
}
function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md bg-accent-500/10 px-1.5 py-0.5 text-[11.5px] font-medium text-accent-700 dark:bg-accent-500/15 dark:text-accent-300">{children}</span>;
}
