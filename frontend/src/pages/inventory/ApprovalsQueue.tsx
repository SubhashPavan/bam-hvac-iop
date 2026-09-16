import { useMemo, useState } from 'react';
import { Check, X, MessageSquare, CheckCheck, CheckCircle2, Lock } from 'lucide-react';
import { RECOMMENDATIONS } from '../../data/inventoryMock';
import { REC_TYPE_LABEL, type Recommendation, type WorkflowStatus, type RecommendationType } from '../../types/inventory';
import { useInvAccess } from '../../data/inventoryAccess';

const money = (n: number) => (Math.abs(n) >= 1_000_000 ? `€${(n / 1_000_000).toFixed(2)}M` : Math.abs(n) >= 1_000 ? `€${(n / 1_000).toFixed(1)}K` : `€${n.toFixed(0)}`);

const STAGES: { key: string; role: string; awaiting: WorkflowStatus }[] = [
  { key: 'pending', role: 'Plant Engineer', awaiting: 'pending' },
  { key: 'eng', role: 'Maintenance Leader', awaiting: 'eng_approved' },
  { key: 'fin', role: 'Finance Controller', awaiting: 'maint_approved' },
  { key: 'reg', role: 'Regional Approval', awaiting: 'finance_approved' },
  { key: 'glob', role: 'Global Approval', awaiting: 'implemented' },
];

const TYPE_TONE: Record<RecommendationType, string> = {
  reduce_stock: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  dispose: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  increase_stock: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  keep_unchanged: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300',
  emergency_action: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
};
const RISK_TONE: Record<string, string> = { low: 'bg-emerald-500', medium: 'bg-amber-500', high: 'bg-rose-500' };

export default function ApprovalsQueue() {
  const access = useInvAccess();
  const canActStages = access.role === 'admin' ? STAGES.map((s) => s.key) : access.approvalStages;
  // Stages this persona may VIEW: admin all; others = their actionable stages.
  const viewStages = access.role === 'admin' ? STAGES : STAGES.filter((s) => access.approvalStages.includes(s.key));
  const [stageKey, setStageKey] = useState(viewStages[0]?.key ?? 'fin');
  const [acted, setActed] = useState<Record<string, 'approved' | 'rejected'>>({});

  const countByStage = useMemo(() => {
    const m: Record<string, Recommendation[]> = {};
    for (const s of STAGES) m[s.key] = RECOMMENDATIONS.filter((r) => r.workflow_status === s.awaiting);
    return m;
  }, []);

  const stage = STAGES.find((s) => s.key === stageKey)!;
  const items = (countByStage[stageKey] || [])
    .filter((r) => !acted[r.id])
    .sort((a, b) => b.savings_potential - a.savings_potential);
  const canAct = canActStages.includes(stageKey);
  const actioned = Object.keys(acted).length;
  const awaitingValue = items.reduce((n, r) => n + r.savings_potential, 0);

  return (
    <div className="flex h-full flex-col">
      {/* Task strip */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-navy-100 px-6 py-3 dark:border-slate-800">
        <div>
          <h1 className="text-[17px] font-semibold tracking-tight">Approvals</h1>
          <p className="text-[13px] text-navy-500 dark:text-slate-500">
            {access.role === 'admin' ? 'Every stage — you can act anywhere.' : `Items awaiting your decision as ${stage.role}.`}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-5 text-[13.5px]">
          <Metric value={String(items.length)} label="awaiting" />
          <Metric value={money(awaitingValue)} label="in this stage" tone="amber" />
          <Metric value={String(actioned)} label="actioned" tone="emerald" />
        </div>
      </div>

      {/* Compact pipeline context */}
      <div className="flex flex-wrap items-center gap-2 border-b border-navy-100 px-6 py-2.5 dark:border-slate-800">
        <span className="text-[11.5px] font-semibold uppercase tracking-wide text-navy-400 dark:text-slate-600">Pipeline</span>
        {STAGES.map((s) => {
          const n = (countByStage[s.key] || []).filter((r) => !acted[r.id]).length;
          const canView = access.role === 'admin' || access.approvalStages.includes(s.key);
          const active = stageKey === s.key;
          return (
            <button key={s.key} disabled={!canView} onClick={() => canView && setStageKey(s.key)}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-medium transition-colors ${
                active ? 'bg-accent-500 text-white'
                : canView ? 'bg-navy-100 text-navy-600 hover:bg-navy-200 dark:bg-slate-800 dark:text-slate-300'
                : 'bg-navy-50 text-navy-300 dark:bg-slate-900 dark:text-slate-600'}`}>
              {!canView && <Lock className="h-2.5 w-2.5" />}{s.role}
              <span className={`rounded-full px-1 text-[11px] ${active ? 'bg-white/25' : 'bg-white/60 text-navy-500 dark:bg-slate-900 dark:text-slate-400'}`}>{n}</span>
            </button>
          );
        })}
      </div>

      {/* Queue */}
      <div className="custom-scrollbar flex-1 overflow-y-auto px-6 py-4">
        <div className="mx-auto max-w-4xl">
          {canAct && items.length > 0 && (
            <div className="mb-3 flex justify-end">
              <button onClick={() => setActed((p) => { const n = { ...p }; items.forEach((r) => (n[r.id] = 'approved')); return n; })}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-[13.5px] font-semibold text-emerald-600 hover:bg-emerald-500/25 dark:text-emerald-400"><CheckCheck className="h-3.5 w-3.5" /> Approve all ({items.length})</button>
            </div>
          )}

          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-20 text-center text-navy-500 dark:text-slate-400">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              <p className="text-[14.5px] font-medium">Nothing awaiting {stage.role}</p>
              <p className="text-[13px]">This stage is clear.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.slice(0, 40).map((r) => (
                <div key={r.id} className="flex items-center gap-3 rounded-xl border border-navy-100 bg-white px-4 py-3 dark:border-slate-800 dark:bg-[#211c33]">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${RISK_TONE[r.risk]}`} title={`${r.risk} risk`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14.5px] font-medium">{r.material_desc}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${TYPE_TONE[r.type]}`}>{REC_TYPE_LABEL[r.type]}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[12px] text-navy-400 dark:text-slate-500">
                      <span className="font-mono">{r.material_id}</span><span>·</span><span>{r.plant_id}</span><span>·</span><span>{r.confidence}% conf.</span>
                    </div>
                  </div>
                  <div className="hidden shrink-0 gap-6 text-right sm:flex">
                    <div><div className="text-[14.5px] font-semibold text-amber-600 dark:text-amber-400">{money(r.savings_potential)}</div><div className="text-[11px] text-navy-400 dark:text-slate-500">savings</div></div>
                    <div><div className="text-[14.5px] font-semibold text-emerald-600 dark:text-emerald-400">{money(r.cash_release)}</div><div className="text-[11px] text-navy-400 dark:text-slate-500">cash</div></div>
                  </div>
                  {canAct ? (
                    <div className="flex shrink-0 items-center gap-1">
                      <button onClick={() => setActed((p) => ({ ...p, [r.id]: 'approved' }))} className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 py-1.5 text-[13px] font-semibold text-emerald-600 hover:bg-emerald-500/25 dark:text-emerald-400"><Check className="h-3.5 w-3.5" /> Approve</button>
                      <button onClick={() => setActed((p) => ({ ...p, [r.id]: 'rejected' }))} className="rounded-lg bg-rose-500/15 p-1.5 text-rose-600 hover:bg-rose-500/25 dark:text-rose-400" aria-label="Reject"><X className="h-3.5 w-3.5" /></button>
                      <button className="rounded-lg bg-navy-100 p-1.5 text-navy-500 hover:bg-navy-200 dark:bg-slate-800 dark:text-slate-400" aria-label="Comment"><MessageSquare className="h-3.5 w-3.5" /></button>
                    </div>
                  ) : (
                    <span className="shrink-0 rounded-lg bg-navy-100 px-2.5 py-1 text-[12px] text-navy-400 dark:bg-slate-800 dark:text-slate-500">View only</span>
                  )}
                </div>
              ))}
              {items.length > 40 && <div className="pt-2 text-center text-[13px] text-navy-400 dark:text-slate-500">+{items.length - 40} more</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ value, label, tone }: { value: string; label: string; tone?: 'emerald' | 'amber' }) {
  const c = tone === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' : tone === 'amber' ? 'text-amber-600 dark:text-amber-400' : '';
  return <div className="text-right"><span className={`text-[16.5px] font-semibold ${c}`}>{value}</span> <span className="text-[12.5px] text-navy-400 dark:text-slate-500">{label}</span></div>;
}
