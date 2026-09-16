import { useEffect, useState } from 'react';
import { Brain, X, CheckCircle2, Loader2, ArrowRight, Sparkles } from 'lucide-react';
import type { DeepInsight } from '../../services/inventoryApi';
import { Spinner } from './LoadingBar';

const money = (n: number) => (Math.abs(n) >= 1e6 ? `€${(n / 1e6).toFixed(1)}M` : Math.abs(n) >= 1e3 ? `€${(n / 1e3).toFixed(0)}K` : `€${Math.round(n)}`);

/** Compact metric strip derived from a section's data block. */
function blockChips(block: { type: string; data: any } | null): { label: string; value: string; tone?: string }[] {
  if (!block?.data) return [];
  const d = block.data;
  switch (block.type) {
    case 'kpis':
      return [
        { label: 'Inventory', value: money(d.total_inventory_value || 0) },
        { label: 'Opportunity', value: money(d.savings_potential || 0), tone: 'amber' },
        { label: 'Service', value: `${d.service_level ?? '—'}%` },
        { label: 'Stockouts', value: String(d.stockouts ?? 0), tone: 'rose' },
      ];
    case 'savings_matrix': {
      const k = d.kpis || {};
      return [
        { label: 'Opportunity', value: money(k.total_opportunity || 0), tone: 'amber' },
        { label: 'Working capital', value: money(k.working_capital_release || 0), tone: 'mint' },
        { label: 'Surplus', value: money(k.surplus_stock || 0) },
        { label: 'Obsolete', value: money(k.obsolete_stock || 0), tone: 'rose' },
      ];
    }
    case 'demand_outlook':
      return [
        { label: 'Forecast qty', value: Math.round(d.total_forecast_qty || 0).toLocaleString() },
        { label: 'Rising', value: String(d.growth_count ?? 0), tone: 'mint' },
        { label: 'Falling', value: String(d.decline_count ?? 0), tone: 'rose' },
        { label: 'Accuracy', value: `${d.model_accuracy ?? '—'}%` },
      ];
    case 'tradeoff':
      return [
        { label: 'Current service', value: `${d.current_service ?? '—'}%` },
        { label: 'Current investment', value: money(d.current_investment || 0) },
      ];
    case 'vendors': {
      const s = d.summary || {};
      return [
        { label: 'SS driven', value: money(s.safety_stock_value || 0), tone: 'violet' },
        { label: 'Avg lead', value: `${Math.round(s.avg_lead_days || 0)}d` },
        { label: 'High-impact', value: String(s.high_impact_count ?? 0), tone: 'amber' },
        { label: 'Worst', value: s.worst_lead_supplier || '—' },
      ];
    }
    case 'network_pooling': {
      const s = d.summary || {};
      return [
        { label: 'Avoided', value: money(s.capital_freed || 0), tone: 'mint' },
        { label: 'Moves', value: String(s.move_count ?? 0) },
        { label: 'Shortages covered', value: String(s.at_risk_covered ?? 0), tone: 'rose' },
      ];
    }
    case 'opportunities':
      return [
        { label: 'Savings', value: money(d.total_savings || 0), tone: 'amber' },
        { label: 'Opportunities', value: String(d.opportunity_count ?? 0) },
      ];
    default:
      return [];
  }
}
const TT: Record<string, string> = { amber: 'text-amber-600 dark:text-amber-400', rose: 'text-rose-600 dark:text-rose-400', mint: 'text-emerald-600 dark:text-emerald-400', violet: 'text-violet-600 dark:text-violet-400' };

export default function DeepInsightPanel({ running, steps, report, onClose }: {
  running: boolean; steps: string[]; report: DeepInsight | null; onClose: () => void;
}) {
  // While running, tick through the planned steps for a staged feel.
  const [done, setDone] = useState(0);
  useEffect(() => {
    if (!running) return;
    setDone(0);
    const t = setInterval(() => setDone((n) => Math.min(steps.length - 1, n + 1)), 1400);
    return () => clearInterval(t);
  }, [running, steps.length]);

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="custom-scrollbar h-full w-full max-w-[720px] overflow-y-auto border-l border-navy-100 bg-navy-50 shadow-2xl dark:border-slate-800 dark:bg-[#14111f]">
        {/* header */}
        <div className="sticky top-0 z-10 flex items-center gap-2.5 border-b border-navy-100 bg-white/90 px-5 py-3.5 backdrop-blur dark:border-slate-800 dark:bg-[#1b1730]/90">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent-400 to-accent-600 text-white"><Brain className="h-4 w-4" /></span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15.5px] font-semibold">{report?.title || 'Deep insight'}</div>
            <div className="truncate text-[12.5px] text-navy-400 dark:text-slate-500">{report?.objective || 'Multi-step analysis'}</div>
          </div>
          {report && <span className="rounded-full bg-accent-500/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent-600 dark:text-accent-400">{report.engine === 'llm' ? 'AI report' : 'report'}</span>}
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-navy-400 hover:bg-navy-100 dark:text-slate-400 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>

        <div className="px-5 py-4">
          {/* running timeline */}
          {running && (
            <div className="mb-4 rounded-xl border border-navy-100 bg-white p-4 dark:border-slate-800 dark:bg-[#211c33]">
              <div className="mb-2.5 flex items-center gap-2 text-[14px] font-semibold"><Spinner /> Running the analysis…</div>
              <div className="space-y-1.5">
                {steps.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-[13px]">
                    {i < done ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : i === done ? <Loader2 className="h-3.5 w-3.5 animate-spin text-accent-500" /> : <span className="h-3.5 w-3.5 rounded-full border border-navy-200 dark:border-slate-700" />}
                    <span className={i <= done ? 'text-navy-700 dark:text-slate-200' : 'text-navy-400 dark:text-slate-500'}>{s}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2 text-[13px]">
                  <span className="h-3.5 w-3.5 rounded-full border border-navy-200 dark:border-slate-700" />
                  <span className="text-navy-400 dark:text-slate-500">Consolidating the brief…</span>
                </div>
              </div>
            </div>
          )}

          {report && (
            <>
              {/* executive narrative */}
              <div className="mb-4 rounded-xl border border-accent-500/25 bg-gradient-to-br from-accent-500/[0.07] to-transparent p-4">
                <div className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-semibold uppercase tracking-wide text-accent-600 dark:text-accent-400"><Sparkles className="h-3.5 w-3.5" /> Executive summary</div>
                <p className="text-[14.5px] leading-relaxed text-navy-700 dark:text-slate-200">{report.narrative}</p>
              </div>

              {/* sections */}
              <div className="mb-2 text-[12.5px] font-semibold uppercase tracking-wide text-navy-400 dark:text-slate-500">Analysis</div>
              <div className="space-y-2.5">
                {report.sections.map((s, i) => {
                  const chips = blockChips(s.block);
                  return (
                    <div key={s.id} className="rounded-xl border border-navy-100 bg-white p-3.5 dark:border-slate-800 dark:bg-[#211c33]">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-navy-100 text-[11.5px] font-bold text-navy-500 dark:bg-slate-700 dark:text-slate-300">{i + 1}</span>
                        <span className="text-[14px] font-semibold">{s.title}</span>
                      </div>
                      <p className="text-[13px] leading-relaxed text-navy-600 dark:text-slate-400">{s.finding}</p>
                      {chips.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {chips.map((c, j) => (
                            <span key={j} className="inline-flex items-baseline gap-1 rounded-md border border-navy-100 bg-navy-50/60 px-2 py-1 text-[12px] dark:border-slate-700 dark:bg-slate-900/40">
                              <span className="text-navy-400 dark:text-slate-500">{c.label}</span>
                              <b className={c.tone ? TT[c.tone] : ''}>{c.value}</b>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* prioritized actions */}
              {report.actions.length > 0 && (
                <>
                  <div className="mb-2 mt-4 text-[12.5px] font-semibold uppercase tracking-wide text-navy-400 dark:text-slate-500">Prioritized actions</div>
                  <div className="space-y-2">
                    {report.actions.map((a, i) => (
                      <div key={i} className="flex items-start gap-2.5 rounded-xl border border-navy-100 bg-white p-3 dark:border-slate-800 dark:bg-[#211c33]">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-500 text-[11.5px] font-bold text-white">{i + 1}</span>
                        <div className="min-w-0">
                          <div className="text-[13.5px] font-semibold">{a.title}</div>
                          <div className="text-[12.5px] leading-relaxed text-navy-500 dark:text-slate-400">{a.detail}</div>
                        </div>
                        <ArrowRight className="ml-auto mt-1 h-3.5 w-3.5 shrink-0 text-navy-300 dark:text-slate-600" />
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div className="mt-4 text-center text-[11.5px] text-navy-400 dark:text-slate-600">Generated {new Date(report.generated_at).toLocaleString()}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
