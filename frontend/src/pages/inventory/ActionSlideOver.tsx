import { useState } from 'react';
import { X, ArrowRight, Mail, Send, PlayCircle, FlaskConical, Check, AlertTriangle } from 'lucide-react';
import { useRequestStore, ACTION_LABEL, type Priority, type Routing } from '../../store/requestStore';

const money = (n: number) => (Math.abs(n) >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : Math.abs(n) >= 1_000 ? `$${(n / 1_000).toFixed(1)}K` : `$${Math.round(n)}`);

const PRIORITIES: { k: Priority; label: string; tone: string }[] = [
  { k: 'low', label: 'Low', tone: 'text-navy-500' },
  { k: 'medium', label: 'Medium', tone: 'text-accent-600 dark:text-accent-400' },
  { k: 'high', label: 'High', tone: 'text-amber-600 dark:text-amber-400' },
  { k: 'urgent', label: 'Urgent', tone: 'text-rose-600 dark:text-rose-400' },
];
const ROUTES: { k: Routing; label: string; icon: typeof Send; desc: string }[] = [
  { k: 'maintenance_planner', label: 'Send to Maintenance Planner', icon: Send, desc: 'Routes into the approval workflow (Stage 2)' },
  { k: 'email', label: 'Trigger email', icon: Mail, desc: 'Notify the planner by email with this request' },
  { k: 'save_execute', label: 'Save & execute', icon: PlayCircle, desc: 'Log the action and mark for direct execution' },
];

export default function ActionSlideOver({ onDone }: { onDone?: (label: string) => void }) {
  const draft = useRequestStore((s) => s.draft);
  const closeAction = useRequestStore((s) => s.closeAction);
  const create = useRequestStore((s) => s.create);
  const [priority, setPriority] = useState<Priority>('medium');
  const [routing, setRouting] = useState<Routing>('maintenance_planner');
  const [note, setNote] = useState('');

  if (!draft) return null;
  const delta = draft.proposedValue - draft.currentValue;

  const submit = () => {
    create({ seed: draft, note, priority, routing });
    setNote(''); setPriority('medium'); setRouting('maintenance_planner');
    onDone?.(draft.materialDesc);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[1px]" onClick={closeAction} />
      <div className="fixed inset-y-0 right-0 z-50 flex h-full w-[min(560px,95vw)] flex-col border-l border-navy-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-[#14111f]">
        {/* Header */}
        <div className="flex items-center gap-2.5 border-b border-navy-100 px-5 py-3.5 dark:border-slate-800">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-500/15 text-accent-600 dark:text-accent-400"><PlayCircle className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} /></span>
          <div className="min-w-0 flex-1"><div className="text-[15.5px] font-semibold leading-tight">Create action</div><div className="text-[12.5px] text-navy-400 dark:text-slate-500">Structured request · routes to the approval workflow</div></div>
          <button onClick={closeAction} className="rounded-lg p-1.5 text-navy-400 hover:bg-navy-50 dark:text-slate-400 dark:hover:bg-slate-800" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto px-5 py-4">
          {/* What & material */}
          <div className="rounded-xl border border-navy-100 p-3.5 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-accent-500/10 px-2 py-0.5 text-[11.5px] font-semibold text-accent-700 dark:text-accent-300">{ACTION_LABEL[draft.kind]}</span>
              <span className="text-[11.5px] text-navy-400 dark:text-slate-500">{draft.plantId}</span>
            </div>
            <div className="mt-1.5 text-[15px] font-semibold">{draft.materialDesc}</div>
            <div className="font-mono text-[12px] text-navy-400 dark:text-slate-500">{draft.materialId}</div>
            <div className="mt-2.5 grid grid-cols-3 gap-2">
              <Field label="Current value" value={money(draft.currentValue)} />
              <Field label="Proposed value" value={money(draft.proposedValue)} tone={delta < 0 ? 'mint' : 'accent'} />
              <Field label="Savings" value={money(draft.savings)} tone="amber" />
            </div>
          </div>

          {/* AI justification */}
          <div className="mt-3 rounded-xl bg-accent-500/5 p-3 dark:bg-accent-500/10">
            <div className="mb-1 text-[11.5px] font-semibold uppercase tracking-wide text-accent-600 dark:text-accent-400">AI justification</div>
            <p className="text-[13.5px] leading-relaxed text-navy-700 dark:text-slate-300">{draft.justification}</p>
          </div>

          {/* Simulation evidence */}
          {draft.snapshot ? (
            <div className="mt-3 rounded-xl border border-amber-300/50 bg-amber-50/60 p-3 dark:border-amber-500/25 dark:bg-amber-500/5">
              <div className="mb-1.5 flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400"><FlaskConical className="h-3 w-3" /> Simulation attached as evidence</div>
              <div className="text-[13.5px] font-medium">{draft.snapshot.scenario}</div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[12.5px] text-navy-600 dark:text-slate-300">
                <span>Service <b>{draft.snapshot.service}%</b></span>
                <span>Investment <b>{money(draft.snapshot.investment)}</b></span>
                <span>Stockout risk <b>{draft.snapshot.stockoutRisk}%</b></span>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-dashed border-navy-200 px-3 py-2.5 text-[13px] text-navy-500 dark:border-slate-700 dark:text-slate-400"><FlaskConical className="h-3.5 w-3.5" /> No simulation attached. Run one on the Simulation tab to attach it as evidence.</div>
          )}

          {/* Priority */}
          <div className="mt-4">
            <div className="mb-1.5 text-[12.5px] font-semibold uppercase tracking-wide text-navy-400 dark:text-slate-500">Priority</div>
            <div className="flex gap-1.5">
              {PRIORITIES.map((p) => (
                <button key={p.k} onClick={() => setPriority(p.k)} className={`flex-1 rounded-lg border px-2 py-1.5 text-[13px] font-semibold ${priority === p.k ? 'border-accent-400 bg-accent-500/10 dark:border-accent-500' : 'border-navy-200 hover:bg-navy-50 dark:border-slate-700 dark:hover:bg-slate-800'} ${priority === p.k ? p.tone : 'text-navy-500 dark:text-slate-400'}`}>{p.label === 'Urgent' && priority === p.k ? <span className="inline-flex items-center gap-1"><AlertTriangle className="h-3 w-3" />{p.label}</span> : p.label}</button>
              ))}
            </div>
          </div>

          {/* Note */}
          <div className="mt-4">
            <div className="mb-1.5 text-[12.5px] font-semibold uppercase tracking-wide text-navy-400 dark:text-slate-500">Note to planner (optional)</div>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Add context for the reviewer…" className="w-full resize-none rounded-lg border border-navy-200 bg-white px-3 py-2 text-[14px] outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" />
          </div>

          {/* Routing */}
          <div className="mt-4">
            <div className="mb-1.5 text-[12.5px] font-semibold uppercase tracking-wide text-navy-400 dark:text-slate-500">Route</div>
            <div className="flex flex-col gap-1.5">
              {ROUTES.map((r) => (
                <button key={r.k} onClick={() => setRouting(r.k)} className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left ${routing === r.k ? 'border-accent-400 bg-accent-500/10 dark:border-accent-500' : 'border-navy-200 hover:bg-navy-50 dark:border-slate-700 dark:hover:bg-slate-800'}`}>
                  <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${routing === r.k ? 'bg-accent-500 text-white' : 'bg-navy-100 text-navy-500 dark:bg-slate-800 dark:text-slate-400'}`}><r.icon className="h-3.5 w-3.5" /></span>
                  <div className="min-w-0 flex-1"><div className="text-[14px] font-medium">{r.label}</div><div className="text-[12px] text-navy-400 dark:text-slate-500">{r.desc}</div></div>
                  {routing === r.k && <Check className="h-4 w-4 text-accent-500" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 border-t border-navy-100 px-5 py-3.5 dark:border-slate-800">
          <div className="text-[12.5px] text-navy-400 dark:text-slate-500">Stage 1 of 5 · you originate & approve</div>
          <button onClick={closeAction} className="ml-auto rounded-lg border border-navy-200 px-3.5 py-2 text-[13.5px] font-medium text-navy-600 hover:bg-navy-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button>
          <button onClick={submit} className="inline-flex items-center gap-1.5 rounded-lg bg-accent-500 px-4 py-2 text-[14px] font-semibold text-white hover:bg-accent-600">Submit action <ArrowRight className="h-3.5 w-3.5" /></button>
        </div>
      </div>
    </>
  );
}

function Field({ label, value, tone }: { label: string; value: string; tone?: 'mint' | 'amber' | 'accent' }) {
  const c = tone === 'mint' ? 'text-emerald-600 dark:text-emerald-400' : tone === 'amber' ? 'text-amber-600 dark:text-amber-400' : tone === 'accent' ? 'text-accent-600 dark:text-accent-400' : '';
  return (
    <div className="rounded-lg border border-navy-100 bg-navy-50/50 px-2.5 py-1.5 dark:border-slate-800 dark:bg-slate-900/40">
      <div className="text-[10.5px] uppercase tracking-wide text-navy-400 dark:text-slate-500">{label}</div>
      <div className={`text-[14.5px] font-semibold ${c}`}>{value}</div>
    </div>
  );
}
