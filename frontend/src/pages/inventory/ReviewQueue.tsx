import { useMemo, useState } from 'react';
import {
  TrendingDown, XCircle, TrendingUp, AlertTriangle, Minus, Check, Pencil, Ban,
  Sparkles, ArrowRight, CheckCircle2,
} from 'lucide-react';
import { RECOMMENDATIONS } from '../../data/inventoryMock';
import { type Recommendation, type RecommendationType } from '../../types/inventory';

const money = (n: number) => (Math.abs(n) >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : Math.abs(n) >= 1_000 ? `$${(n / 1_000).toFixed(1)}K` : `$${n.toFixed(0)}`);

const TYPE_META: Record<RecommendationType, { icon: typeof Check; verb: string; tone: string; dot: string }> = {
  reduce_stock: { icon: TrendingDown, verb: 'Reduce stock', tone: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
  dispose: { icon: XCircle, verb: 'Dispose', tone: 'text-rose-600 dark:text-rose-400', dot: 'bg-rose-500' },
  increase_stock: { icon: TrendingUp, verb: 'Increase stock', tone: 'text-sky-600 dark:text-sky-400', dot: 'bg-sky-500' },
  keep_unchanged: { icon: Minus, verb: 'Keep unchanged', tone: 'text-cyan-600 dark:text-cyan-400', dot: 'bg-cyan-500' },
  emergency_action: { icon: AlertTriangle, verb: 'Emergency action', tone: 'text-red-600 dark:text-red-400', dot: 'bg-red-500' },
};

const URGENCY: Record<RecommendationType, number> = { emergency_action: 1, increase_stock: 0.7, dispose: 0.5, reduce_stock: 0.4, keep_unchanged: 0.1 };

function priorityScore(r: Recommendation, maxSaving: number): number {
  const s = maxSaving ? r.savings_potential / maxSaving : 0;
  return s * 0.5 + (r.confidence / 100) * 0.2 + URGENCY[r.type] * 0.3;
}
function band(score: number): { label: string; tone: string } {
  if (score > 0.55) return { label: 'High', tone: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300' };
  if (score > 0.38) return { label: 'Medium', tone: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' };
  return { label: 'Low', tone: 'bg-navy-100 text-navy-500 dark:bg-slate-800 dark:text-slate-400' };
}

type Decision = 'accept' | 'modify' | 'reject';

export default function ReviewQueue() {
  const queue = useMemo(() => {
    const maxSaving = Math.max(...RECOMMENDATIONS.map((r) => r.savings_potential), 1);
    return [...RECOMMENDATIONS]
      .map((r) => ({ r, score: priorityScore(r, maxSaving) }))
      .sort((a, b) => b.score - a.score);
  }, []);

  const [decided, setDecided] = useState<Record<string, Decision>>({});
  const [selId, setSelId] = useState<string>(queue[0]?.r.id ?? '');

  const remaining = queue.filter((q) => !decided[q.r.id]);
  const sel = queue.find((q) => q.r.id === selId) ?? remaining[0];
  const actionedCount = Object.keys(decided).length;
  const queuedValue = queue.filter((q) => decided[q.r.id] === 'accept' || decided[q.r.id] === 'modify').reduce((n, q) => n + q.r.savings_potential, 0);
  const potentialLeft = remaining.reduce((n, q) => n + q.r.savings_potential, 0);

  const decide = (id: string, d: Decision) => {
    setDecided((p) => ({ ...p, [id]: d }));
    const idx = remaining.findIndex((q) => q.r.id === id);
    const next = remaining[idx + 1] ?? remaining[idx - 1];
    if (next) setSelId(next.r.id);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Slim task strip */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-navy-100 px-6 py-3 dark:border-slate-800">
        <div>
          <h1 className="text-[17px] font-semibold tracking-tight">Review</h1>
          <p className="text-[13px] text-navy-500 dark:text-slate-500">Highest-impact recommendations first — decide, and they route to approval.</p>
        </div>
        <div className="ml-auto flex items-center gap-5 text-[13.5px]">
          <Metric value={String(remaining.length)} label="to review" />
          <Metric value={money(potentialLeft)} label="potential left" />
          <Metric value={String(actionedCount)} label="actioned" tone="emerald" />
          <Metric value={money(queuedValue)} label="queued for approval" tone="amber" />
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)]">
        {/* Queue list */}
        <div className="custom-scrollbar overflow-y-auto border-r border-navy-100 dark:border-slate-800">
          {remaining.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-navy-500 dark:text-slate-400">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              <p className="text-[14.5px] font-medium">Queue cleared</p>
              <p className="text-[13px]">You've reviewed everything. {money(queuedValue)} routed to approval.</p>
            </div>
          ) : remaining.map(({ r, score }) => {
            const meta = TYPE_META[r.type];
            const b = band(score);
            const active = sel?.r.id === r.id;
            return (
              <button key={r.id} onClick={() => setSelId(r.id)}
                className={`flex w-full items-start gap-3 border-b border-navy-50 px-4 py-3 text-left transition-colors dark:border-slate-800/60 ${active ? 'bg-accent-500/5 dark:bg-accent-500/10' : 'hover:bg-navy-50/60 dark:hover:bg-slate-800/30'}`}>
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${meta.dot}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[14px] font-medium ${meta.tone}`}>{meta.verb}</span>
                    <span className={`rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold ${b.tone}`}>{b.label}</span>
                  </div>
                  <div className="truncate text-[13.5px] text-navy-700 dark:text-slate-300">{r.material_desc}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-[12px] text-navy-400 dark:text-slate-500">
                    <span>{r.plant_id}</span><span>·</span><span>{r.confidence}% conf.</span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[14px] font-semibold text-amber-600 dark:text-amber-400">{money(r.savings_potential)}</div>
                  <div className="text-[11px] text-navy-400 dark:text-slate-500">savings</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Decision panel */}
        <div className="custom-scrollbar overflow-y-auto p-6">
          {sel ? <DecisionPanel rec={sel.r} onDecide={(d) => decide(sel.r.id, d)} /> : (
            <div className="flex h-full items-center justify-center text-[14.5px] text-navy-500 dark:text-slate-400">Select a recommendation to review.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function DecisionPanel({ rec, onDecide }: { rec: Recommendation; onDecide: (d: Decision) => void }) {
  const meta = TYPE_META[rec.type];
  const Icon = meta.icon;
  const nextStage = rec.type === 'emergency_action' ? 'Maintenance Leader (expedited)' : 'Plant Engineer → Finance Controller';

  return (
    <div className="mx-auto max-w-2xl">
      {/* Material */}
      <div className="mb-1 font-mono text-[12.5px] text-navy-400 dark:text-slate-500">{rec.material_id} · {rec.plant_id} · {rec.country}</div>
      <h2 className="text-[21px] font-semibold tracking-tight">{rec.material_desc}</h2>

      {/* The recommendation, plainly */}
      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-navy-100 bg-white p-4 dark:border-slate-800 dark:bg-[#211c33]">
        <span className={`flex h-11 w-11 items-center justify-center rounded-xl bg-navy-50 ${meta.tone} dark:bg-slate-800`}><Icon className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <div className={`text-[16.5px] font-semibold ${meta.tone}`}>{meta.verb}</div>
          <div className="text-[14px] text-navy-500 dark:text-slate-400">
            {rec.type === 'dispose' ? `Write off ${money(rec.current_stock_value)} of obsolete stock` : rec.type === 'increase_stock' || rec.type === 'emergency_action' ? `Raise cover to avoid stockout` : `Release ${money(rec.savings_potential)} of tied-up capital`}
          </div>
        </div>
        <span className="rounded-lg bg-accent-500/10 px-2.5 py-1 text-[12.5px] font-semibold text-accent-700 dark:text-accent-300">{rec.confidence}% confident</span>
      </div>

      {/* Impact — 3 clean figures */}
      <div className="mt-3 grid grid-cols-3 gap-3">
        <Figure label="Current value" value={money(rec.current_stock_value)} />
        <Figure label="Recommended" value={money(rec.recommended_value)} tone="emerald" />
        <Figure label="Cash release" value={money(rec.cash_release)} tone="amber" />
      </div>

      {/* Why */}
      <div className="mt-3 rounded-2xl bg-accent-500/5 p-4 dark:bg-accent-500/10">
        <div className="mb-1 flex items-center gap-1.5 text-[13.5px] font-semibold text-accent-700 dark:text-accent-300"><Sparkles className="h-3.5 w-3.5" /> Why the AI suggests this</div>
        <p className="text-[14.5px] leading-relaxed text-navy-700 dark:text-slate-300">{rec.ai_reasoning}</p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <Chip>Coverage {rec.coverage_days}d</Chip>
          <Chip>{rec.fsn}-moving</Chip>
          <Chip>{rec.ved}</Chip>
          <Chip>Criticality {rec.criticality_score}/100</Chip>
        </div>
      </div>

      {/* Decision */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button onClick={() => onDecide('accept')} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2.5 text-[14.5px] font-semibold text-white hover:bg-emerald-600"><Check className="h-4 w-4" /> Accept</button>
        <button onClick={() => onDecide('modify')} className="inline-flex items-center gap-1.5 rounded-xl border border-navy-200 px-4 py-2.5 text-[14.5px] font-semibold text-navy-700 hover:bg-navy-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><Pencil className="h-4 w-4" /> Modify</button>
        <button onClick={() => onDecide('reject')} className="inline-flex items-center gap-1.5 rounded-xl border border-navy-200 px-4 py-2.5 text-[14.5px] font-semibold text-rose-600 hover:bg-rose-50 dark:border-slate-700 dark:hover:bg-rose-500/10"><Ban className="h-4 w-4" /> Reject</button>
      </div>
      <div className="mt-2.5 flex items-center gap-1.5 text-[13px] text-navy-400 dark:text-slate-500"><ArrowRight className="h-3.5 w-3.5" /> On accept, routes to: <span className="font-medium text-navy-600 dark:text-slate-400">{nextStage}</span></div>
    </div>
  );
}

function Metric({ value, label, tone }: { value: string; label: string; tone?: 'emerald' | 'amber' }) {
  const c = tone === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' : tone === 'amber' ? 'text-amber-600 dark:text-amber-400' : '';
  return <div className="text-right"><span className={`text-[16.5px] font-semibold ${c}`}>{value}</span> <span className="text-[12.5px] text-navy-400 dark:text-slate-500">{label}</span></div>;
}
function Figure({ label, value, tone }: { label: string; value: string; tone?: 'emerald' | 'amber' }) {
  const c = tone === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' : tone === 'amber' ? 'text-amber-600 dark:text-amber-400' : '';
  return (
    <div className="rounded-xl border border-navy-100 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-[#211c33]">
      <div className="text-[11.5px] uppercase tracking-wide text-navy-400 dark:text-slate-500">{label}</div>
      <div className={`text-[18px] font-semibold ${c}`}>{value}</div>
    </div>
  );
}
function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md bg-white/70 px-1.5 py-0.5 text-[12px] font-medium text-navy-600 dark:bg-slate-800 dark:text-slate-300">{children}</span>;
}
