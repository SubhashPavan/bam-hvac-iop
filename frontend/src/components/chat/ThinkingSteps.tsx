import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Check,
  Loader2,
  AlertCircle,
  Brain,
  Database,
  BarChart3,
  Sparkles,
  Code2,
  MessageSquare,
  Globe,
} from 'lucide-react';
import type { AgentStep } from '../../types/chat';

interface ThinkingStepsProps {
  steps: AgentStep[];
  isStreaming: boolean;
}

function tryParse(s: AgentStep): Record<string, unknown> | null {
  try {
    return JSON.parse(s.content);
  } catch {
    return null;
  }
}

function isReasoning(step: AgentStep): boolean {
  if (step.type !== 'thinking') return false;
  const p = tryParse(step);
  return p?.step === 'reasoning';
}

const STEP_CONFIG: Record<string, { icon: typeof Brain; getLabel: (s: AgentStep) => string }> = {
  thinking: {
    icon: Brain,
    getLabel: (s) => {
      const p = tryParse(s);
      const text = (p?.content as string) || s.content || 'Analyzing…';
      return text.length > 140 ? text.slice(0, 137) + '…' : text;
    },
  },
  plan: {
    icon: Sparkles,
    getLabel: (s) => {
      const p = tryParse(s);
      return p
        ? `Planned ${(p.sub_queries as unknown[])?.length || '?'} sub-queries`
        : 'Created analysis plan';
    },
  },
  sub_query_start: {
    icon: Database,
    getLabel: (s) => {
      const p = tryParse(s);
      const desc = (p?.description as string) || s.content || '';
      return desc || 'Executing query…';
    },
  },
  sub_query_result: {
    icon: Database,
    getLabel: (s) => {
      const p = tryParse(s);
      if (!p) return s.content || 'Results received';
      if (p.error) return String(p.error);
      return `${p.row_count ?? '?'} rows returned (${Math.round(Number(p.duration_ms) || 0)}ms)`;
    },
  },
  api_call_start: {
    icon: Globe,
    getLabel: (s) => {
      const p = tryParse(s);
      return (p?.content as string) || s.content || 'Calling external API…';
    },
  },
  api_call_result: {
    icon: Globe,
    getLabel: (s) => {
      const p = tryParse(s);
      if (!p) return s.content || 'API response received';
      if (p.error) return `API error: ${p.error}`;
      return `API: ${p.api_name || 'External'} — ${p.row_count ?? '?'} records (${Math.round(Number(p.duration_ms) || 0)}ms)`;
    },
  },
  consolidating: {
    icon: Brain,
    getLabel: (s) => s.content || 'Synthesizing insights…',
  },
  chart_selected: {
    icon: BarChart3,
    getLabel: (s) => {
      const p = tryParse(s);
      return p
        ? `${p.chart_type || 'Chart'} visualization selected`
        : s.content || 'Visualization ready';
    },
  },
  clarification: {
    icon: MessageSquare,
    getLabel: (s) => s.content || 'Asking for clarification…',
  },
  error: {
    icon: AlertCircle,
    getLabel: (s) => {
      const p = tryParse(s);
      return (p?.message as string) || s.content || 'Something went wrong';
    },
  },
};

export default function ThinkingSteps({ steps, isStreaming }: ThinkingStepsProps) {
  const [expanded, setExpanded] = useState(true);
  const [expandedDetail, setExpandedDetail] = useState<number | null>(null);

  if (steps.length === 0 && !isStreaming) return null;

  return (
    <div className="mb-2.5 overflow-hidden rounded-xl border border-navy-100 bg-white shadow-sm">
      {/* Toggle */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-navy-50"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-accent-50 text-accent-600">
          {expanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </span>
        <span className="text-[12.5px] font-semibold text-navy-700">Analysis steps</span>
        <span className="text-[11.5px] text-navy-400">· {steps.length} completed</span>
        {isStreaming && <Loader2 className="is-spinner ml-auto h-3.5 w-3.5 text-accent-600" />}
      </button>

      {expanded && (
        <div className="border-t border-navy-100 bg-navy-50/40 px-3 py-2">
          {steps.map((step, i) => {
            const isLast = i === steps.length - 1 && !isStreaming;
            let isError = step.type === 'error';
            if (step.type === 'sub_query_result' && step.content) {
              const p = tryParse(step);
              if (p?.error) isError = true;
            }

            const hasReasoning = isReasoning(step) && step.content.length > 140;
            const hasSql = !!step.sql;
            const parsed = tryParse(step);
            const errorDetail = (parsed?.error_detail as string) || '';
            const hasExpandable = hasReasoning || hasSql || (isError && errorDetail);

            const cfg = STEP_CONFIG[step.type] || STEP_CONFIG.thinking;

            return (
              <div key={i} className="relative flex gap-2.5 py-1.5">
                {/* Connector line */}
                {!isLast && (
                  <div className="absolute left-[10px] top-[22px] bottom-[-6px] w-px bg-navy-200" />
                )}

                {/* Status dot */}
                <div
                  className={`z-10 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ring-2 ring-navy-50/40 ${
                    isError
                      ? 'bg-danger-50 ring-1 ring-inset ring-danger-500/30'
                      : step.completed
                      ? 'bg-success-50'
                      : 'bg-accent-50'
                  }`}
                >
                  {!step.completed ? (
                    <Loader2 className="is-spinner h-2.5 w-2.5 text-accent-600" />
                  ) : isError ? (
                    <AlertCircle className="h-3 w-3 text-danger-600" />
                  ) : (
                    <Check className="h-3 w-3 text-success-600" strokeWidth={3} />
                  )}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-[12.5px] leading-snug ${
                      isError
                        ? 'text-danger-700'
                        : isReasoning(step)
                        ? 'italic text-navy-600'
                        : 'text-navy-700'
                    }`}
                  >
                    {cfg.getLabel(step)}
                  </p>

                  {/* Expandable section */}
                  {hasExpandable && (
                    <div className="mt-1.5">
                      <button
                        type="button"
                        onClick={() => setExpandedDetail(expandedDetail === i ? null : i)}
                        className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-[11px] font-semibold text-accent-700 ring-1 ring-inset ring-accent-200 transition-colors hover:bg-accent-50"
                      >
                        <Code2 className="h-2.5 w-2.5" />
                        {expandedDetail === i
                          ? 'Hide details'
                          : hasSql
                          ? 'View SQL'
                          : hasReasoning
                          ? 'Full reasoning'
                          : 'Technical detail'}
                      </button>
                      {expandedDetail === i && (
                        <div className="mt-1.5 space-y-1.5">
                          {hasReasoning && (
                            <div className="whitespace-pre-wrap rounded-md bg-white px-3 py-2 text-[12px] leading-relaxed text-navy-700 ring-1 ring-inset ring-navy-100">
                              {(tryParse(step)?.content as string) || step.content}
                            </div>
                          )}
                          {hasSql && (
                            <pre className="overflow-x-auto rounded-md bg-navy-900 p-3 font-mono text-[11.5px] leading-relaxed text-accent-200">
                              {step.sql}
                            </pre>
                          )}
                          {isError && errorDetail && (
                            <pre className="overflow-x-auto rounded-md bg-danger-50 p-3 font-mono text-[11.5px] leading-relaxed text-danger-700 ring-1 ring-inset ring-danger-500/20">
                              {errorDetail}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isStreaming && (
            <div className="relative flex gap-2.5 py-1.5">
              <div className="z-10 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-50">
                <Loader2 className="is-spinner h-2.5 w-2.5 text-accent-600" />
              </div>
              <p className="text-[12.5px] italic leading-snug text-navy-400">Processing…</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
