import { useMemo, useState } from 'react';
import { Check, X, ChevronDown, FlaskConical, CheckCircle2, XCircle, MessageSquare, Inbox, CornerUpLeft } from 'lucide-react';
import { useRequestStore, STAGE_FLOW, STAGE_LABEL, ACTION_LABEL, type Stage, type ActionRequest } from '../../store/requestStore';

const money = (n: number) => (Math.abs(n) >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : Math.abs(n) >= 1_000 ? `$${(n / 1_000).toFixed(0)}K` : `$${Math.round(n)}`);
const CHAIN: Stage[] = ['plant_mgr', 'maintenance', 'finance', 'regional', 'global'];
const PRIO_TONE: Record<string, string> = { urgent: 'bg-rose-500/15 text-rose-600 dark:text-rose-400', high: 'bg-amber-500/15 text-amber-600 dark:text-amber-400', medium: 'bg-accent-500/15 text-accent-600 dark:text-accent-400', low: 'bg-navy-100 text-navy-500 dark:bg-slate-800 dark:text-slate-400' };
const STAGE_PILL = (stage: Stage) => stage === 'done' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : stage === 'rejected' ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400' : stage === 'executing' ? 'bg-violet-500/15 text-violet-600 dark:text-violet-400' : 'bg-accent-500/15 text-accent-600 dark:text-accent-400';

type Filter = 'all' | 'awaiting' | 'inflight' | 'closed';

export default function WorkflowView() {
  const requests = useRequestStore((s) => s.requests);
  const decide = useRequestStore((s) => s.decide);
  const sendBack = useRequestStore((s) => s.sendBack);
  const clearAll = useRequestStore((s) => s.clearAll);
  const [filter, setFilter] = useState<Filter>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const stats = useMemo(() => ({
    total: requests.length,
    inflight: requests.filter((r) => !['done', 'rejected'].includes(r.stage)).length,
    savings: requests.filter((r) => r.stage !== 'rejected').reduce((n, r) => n + r.savings, 0),
    done: requests.filter((r) => r.stage === 'done').length,
    rejected: requests.filter((r) => r.stage === 'rejected').length,
  }), [requests]);

  const shown = requests.filter((r) => {
    if (filter === 'awaiting') return CHAIN.includes(r.stage) && r.stage !== 'plant_mgr';
    if (filter === 'inflight') return !['done', 'rejected'].includes(r.stage);
    if (filter === 'closed') return ['done', 'rejected'].includes(r.stage);
    return true;
  });

  if (requests.length === 0) {
    return (
      <div className="px-6 py-16 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-accent-500/10 text-accent-600 dark:text-accent-400"><Inbox className="h-6 w-6" /></span>
        <div className="mt-3 text-[16.5px] font-semibold">No actions in the workflow yet</div>
        <div className="mt-1 text-[14px] text-navy-500 dark:text-slate-400">Act on a recommendation, opportunity, or exception — it lands here as a request for approval.</div>
      </div>
    );
  }

  return (
    <div className="px-6 py-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight">Approval workflow</h1>
          <p className="text-[14px] text-navy-500 dark:text-slate-500">Plant Manager → Maintenance Planner → Finance Controller → Regional → Global · approve, send back, or reject at your stage</p>
        </div>
        <button onClick={() => { if (confirm('Clear all workflow requests? This cannot be undone.')) clearAll(); }}
          className="shrink-0 rounded-lg border border-navy-200 px-3 py-1.5 text-[12.5px] font-medium text-navy-600 hover:border-rose-300 hover:text-rose-600 dark:border-slate-700 dark:text-slate-300 dark:hover:text-rose-400">
          Clear all
        </button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi value={String(stats.total)} label="Total requests" />
        <Kpi value={String(stats.inflight)} label="In flight" tone="accent" />
        <Kpi value={money(stats.savings)} label="Savings in pipeline" tone="amber" />
        <Kpi value={`${stats.done} / ${stats.rejected}`} label="Done / rejected" tone="mint" />
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {(['all', 'awaiting', 'inflight', 'closed'] as Filter[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-3 py-1.5 text-[13.5px] font-semibold capitalize ${filter === f ? 'bg-accent-500 text-white' : 'bg-navy-100 text-navy-600 hover:bg-navy-200 dark:bg-slate-800 dark:text-slate-300'}`}>{f === 'awaiting' ? 'Awaiting approval' : f === 'inflight' ? 'In flight' : f}</button>
        ))}
      </div>

      {/* Grid */}
      <div className="overflow-hidden rounded-xl border border-navy-100 dark:border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-[13.5px]">
            <thead>
              <tr className="border-b border-navy-100 bg-navy-50/60 text-left text-[11.5px] uppercase tracking-wide text-navy-400 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-500">
                <th className="px-4 py-2.5 font-semibold">Request</th>
                <th className="px-3 py-2.5 font-semibold">Action</th>
                <th className="px-3 py-2.5 text-right font-semibold">Change</th>
                <th className="px-3 py-2.5 text-right font-semibold">Savings</th>
                <th className="px-3 py-2.5 font-semibold">Scenario</th>
                <th className="px-3 py-2.5 font-semibold">Stage</th>
                <th className="px-4 py-2.5 text-right font-semibold">Decision</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const open = openId === r.id;
                const closed = r.stage === 'done' || r.stage === 'rejected';
                const actor = STAGE_LABEL[r.stage];
                return (
                  <Row key={r.id} r={r} open={open} closed={closed} actor={actor}
                    onToggle={() => setOpenId(open ? null : r.id)}
                    onApprove={() => decide(r.id, 'approved', actor)}
                    onReject={() => decide(r.id, 'rejected', actor)}
                    onSendBack={() => sendBack(r.id, actor)}
                  />
                );
              })}
              {shown.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-[14.5px] text-navy-500 dark:text-slate-400">Nothing in this view.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Row({ r, open, closed, actor, onToggle, onApprove, onReject, onSendBack }: {
  r: ActionRequest; open: boolean; closed: boolean; actor: string;
  onToggle: () => void; onApprove: () => void; onReject: () => void; onSendBack: () => void;
}) {
  const idx = STAGE_FLOW.indexOf(r.stage);
  return (
    <>
      <tr className="border-b border-navy-50 hover:bg-navy-50/50 dark:border-slate-800/60 dark:bg-[#211c33] dark:hover:bg-slate-800/30">
        <td className="px-4 py-2.5">
          <button onClick={onToggle} className="flex items-start gap-1.5 text-left">
            <ChevronDown className={`mt-0.5 h-3.5 w-3.5 shrink-0 text-navy-400 transition-transform ${open ? 'rotate-180' : ''}`} />
            <span><span className="font-medium">{r.materialDesc}</span><span className="block font-mono text-[11.5px] text-navy-400 dark:text-slate-500">{r.id} · {r.plantId}</span></span>
          </button>
        </td>
        <td className="px-3 py-2.5"><span className="rounded-full bg-accent-500/10 px-2 py-0.5 text-[11.5px] font-semibold text-accent-700 dark:text-accent-300">{ACTION_LABEL[r.kind]}</span><span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold capitalize ${PRIO_TONE[r.priority]}`}>{r.priority}</span></td>
        <td className="px-3 py-2.5 text-right tabular-nums text-navy-500 dark:text-slate-400">{money(r.currentValue)} → <span className="font-medium text-navy-800 dark:text-slate-200">{money(r.proposedValue)}</span></td>
        <td className="px-3 py-2.5 text-right font-semibold text-amber-600 dark:text-amber-400">{money(r.savings)}</td>
        <td className="px-3 py-2.5">{r.snapshot ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11.5px] font-semibold text-amber-600 dark:text-amber-400"><FlaskConical className="h-3 w-3" /> {r.snapshot.service}% svc</span> : <span className="text-[12.5px] text-navy-300 dark:text-slate-600">—</span>}</td>
        <td className="px-3 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${STAGE_PILL(r.stage)}`}>{STAGE_LABEL[r.stage]}</span></td>
        <td className="px-4 py-2.5">
          {closed ? (
            <span className={`inline-flex items-center gap-1 text-[12.5px] font-semibold ${r.stage === 'done' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{r.stage === 'done' ? <><CheckCircle2 className="h-3.5 w-3.5" /> Done</> : <><XCircle className="h-3.5 w-3.5" /> Rejected</>}</span>
          ) : r.stage === 'executing' ? (
            <button onClick={onApprove} className="rounded-md bg-emerald-500/15 px-2.5 py-1.5 text-[12.5px] font-semibold text-emerald-600 hover:bg-emerald-500/25 dark:text-emerald-400">Mark done</button>
          ) : (
            <div className="flex items-center justify-end gap-1">
              <button onClick={onApprove} title={`Approve as ${actor}`} className="inline-flex items-center gap-1 rounded-md bg-emerald-500 px-2.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-emerald-600"><Check className="h-3.5 w-3.5" /> Approve</button>
              <button onClick={onSendBack} title="Send back for revision" className="rounded-md bg-amber-500/15 p-1.5 text-amber-600 hover:bg-amber-500/25 dark:text-amber-400" aria-label="Send back"><CornerUpLeft className="h-3.5 w-3.5" /></button>
              <button onClick={onReject} title="Reject" className="rounded-md bg-rose-500/15 p-1.5 text-rose-600 hover:bg-rose-500/25 dark:text-rose-400" aria-label="Reject"><X className="h-3.5 w-3.5" /></button>
            </div>
          )}
        </td>
      </tr>
      {open && (
        <tr className="border-b border-navy-100 bg-navy-50/40 dark:border-slate-800 dark:bg-slate-900/30">
          <td colSpan={7} className="px-6 py-3.5">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div>
                {/* stepper */}
                <div className="mb-2 flex items-center gap-1">
                  {CHAIN.map((st, i) => {
                    const done = r.stage === 'rejected' ? i < idx : STAGE_FLOW.indexOf(st) < idx || r.stage === 'done' || r.stage === 'executing';
                    const current = st === r.stage;
                    return (
                      <div key={st} className="flex flex-1 items-center gap-1">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10.5px] font-bold ${done ? 'bg-emerald-500 text-white' : current ? 'bg-accent-500 text-white' : 'bg-navy-100 text-navy-400 dark:bg-slate-800 dark:text-slate-500'}`}>{done ? <Check className="h-3 w-3" /> : i + 1}</span>
                          <span className={`whitespace-nowrap text-[9.5px] ${current ? 'font-semibold text-accent-600 dark:text-accent-400' : 'text-navy-400 dark:text-slate-500'}`}>{STAGE_LABEL[st].split(' ')[0]}</span>
                        </div>
                        {i < CHAIN.length - 1 && <span className={`h-0.5 flex-1 ${done ? 'bg-emerald-400' : 'bg-navy-100 dark:bg-slate-800'}`} />}
                      </div>
                    );
                  })}
                </div>
                <div className="text-[11.5px] font-semibold uppercase tracking-wide text-navy-400 dark:text-slate-500">AI justification</div>
                <p className="text-[13px] leading-relaxed text-navy-600 dark:text-slate-300">{r.justification}</p>
                {r.note && <><div className="mt-2 text-[11.5px] font-semibold uppercase tracking-wide text-navy-400 dark:text-slate-500">Note</div><p className="text-[13px] text-navy-600 dark:text-slate-300">{r.note}</p></>}
              </div>

              <div>
                <div className="text-[11.5px] font-semibold uppercase tracking-wide text-navy-400 dark:text-slate-500">Scenario evidence</div>
                {r.snapshot ? (
                  <div className="mt-1 rounded-lg border border-amber-300/40 bg-amber-50/50 p-2.5 dark:border-amber-500/25 dark:bg-amber-500/5">
                    <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-amber-700 dark:text-amber-300"><FlaskConical className="h-3 w-3" /> {r.snapshot.scenario}</div>
                    <div className="mt-1 grid grid-cols-3 gap-2 text-[12.5px]">
                      <div><div className="text-[10.5px] uppercase text-navy-400 dark:text-slate-500">Service</div><b>{r.snapshot.service}%</b></div>
                      <div><div className="text-[10.5px] uppercase text-navy-400 dark:text-slate-500">Investment</div><b>{money(r.snapshot.investment)}</b></div>
                      <div><div className="text-[10.5px] uppercase text-navy-400 dark:text-slate-500">Stockout</div><b>{r.snapshot.stockoutRisk}%</b></div>
                    </div>
                  </div>
                ) : <div className="mt-1 rounded-lg border border-dashed border-navy-200 px-2.5 py-2 text-[12.5px] text-navy-400 dark:border-slate-700 dark:text-slate-500">No simulation attached.</div>}
                <div className="mt-2 text-[12.5px] text-navy-500 dark:text-slate-400">Cash release: <b className="text-emerald-600 dark:text-emerald-400">{money(r.cashRelease)}</b></div>
              </div>

              <div>
                <div className="mb-1 text-[11.5px] font-semibold uppercase tracking-wide text-navy-400 dark:text-slate-500">Audit trail</div>
                <div className="flex flex-col gap-1.5">
                  {r.history.map((h, i) => (
                    <div key={i} className="flex gap-2">
                      <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${h.decision === 'rejected' ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400' : h.decision === 'sent_back' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : h.decision === 'commented' ? 'bg-navy-100 text-navy-500 dark:bg-slate-800 dark:text-slate-400' : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'}`}>{h.decision === 'rejected' ? <X className="h-2.5 w-2.5" /> : h.decision === 'sent_back' ? <CornerUpLeft className="h-2.5 w-2.5" /> : h.decision === 'commented' ? <MessageSquare className="h-2.5 w-2.5" /> : <Check className="h-2.5 w-2.5" />}</span>
                      <div className="text-[12.5px]"><span className="font-medium">{h.actor}</span> <span className="text-navy-400 dark:text-slate-500">{h.decision === 'created' ? 'created & approved' : h.decision === 'sent_back' ? 'sent back' : h.decision} · {STAGE_LABEL[h.stage]}</span>{h.comment && <div className="text-navy-500 dark:text-slate-400">“{h.comment}”</div>}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function Kpi({ value, label, tone }: { value: string; label: string; tone?: 'accent' | 'amber' | 'mint' }) {
  const c = tone === 'accent' ? 'text-accent-600 dark:text-accent-400' : tone === 'amber' ? 'text-amber-600 dark:text-amber-400' : tone === 'mint' ? 'text-emerald-600 dark:text-emerald-400' : '';
  return (
    <div className="rounded-xl border border-navy-100 bg-white p-3.5 dark:border-slate-800 dark:bg-[#211c33]">
      <div className={`text-[22px] font-semibold leading-none tracking-tight ${c}`}>{value}</div>
      <div className="mt-1.5 text-[13px] font-medium">{label}</div>
    </div>
  );
}
