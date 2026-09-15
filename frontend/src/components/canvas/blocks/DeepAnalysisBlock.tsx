import { useState, useEffect, useRef, memo } from 'react';
import {
  Lightbulb,
  Target,
  Brain,
  Check,
  Loader2,
  AlertCircle,
  Database,
  Sparkles,
  Globe,
  BarChart3,
  Activity,
  ArrowUp,
  MessageSquare,
  Dot,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import Markdown from 'react-markdown';
import type {
  DeepAnalysisBlockData,
  DeepAnalysisSection,
  DeepRecommendation,
  DeepProgressStep,
} from '../../../types/canvas';
import ChartRenderer from '../../insights/ChartRenderer';
import ChartToolbar from '../../insights/ChartToolbar';
import LazyMount from '../LazyMount';
import type { ChartRecommendation } from '../../../types/chat';

interface DeepAnalysisBlockProps {
  data: DeepAnalysisBlockData;
  /** When provided, renders a follow-up input at the bottom of the block.
      The question is sent as another deep analysis on the same thread. */
  onFollowUp?: (question: string) => void;
  /** When true, the block renders in natural document flow (no internal
      scroll, no fixed height). Use this when the block is hosted inside
      a page-level scroll container (e.g. DeepInsightView), so multiple
      analyses can stack and the page-level scroller handles everything.
      When false (default), the block fits a fixed-height parent (canvas
      grid cell) and scrolls its content internally. */
  embedded?: boolean;
}

type Significance = 'high' | 'medium' | 'low';

const SIG_DOT: Record<Significance, string> = {
  high: 'bg-accent-500',
  medium: 'bg-amber-500',
  low: 'bg-navy-300',
};

const SIG_BADGE: Record<Significance, string> = {
  high: 'bg-accent-50 text-accent-700 ring-accent-200',
  medium: 'bg-amber-50 text-amber-700 ring-amber-200',
  low: 'bg-navy-100 text-navy-600 ring-navy-200',
};

/* ─── Icon + color per progress-step kind ─── */
const STEP_ICONS: Record<string, { icon: typeof Database; tone: string }> = {
  plan: { icon: Sparkles, tone: 'text-accent-600' },
  query: { icon: Database, tone: 'text-accent-600' },
  query_result: { icon: Database, tone: 'text-emerald-600' },
  api: { icon: Globe, tone: 'text-violet-600' },
  api_result: { icon: Globe, tone: 'text-emerald-600' },
  synthesis: { icon: Brain, tone: 'text-accent-600' },
  chart: { icon: BarChart3, tone: 'text-cyan-600' },
  thinking: { icon: Brain, tone: 'text-navy-500' },
  info: { icon: Activity, tone: 'text-navy-500' },
  error: { icon: AlertCircle, tone: 'text-danger-600' },
};

function formatElapsed(startMs: number, endMs?: number): string {
  const ms = (endMs ?? Date.now()) - startMs;
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

/* ─── Running state — rich live progress UI ─── */
function RunningState({
  data,
  embedded = false,
}: {
  data: DeepAnalysisBlockData;
  embedded?: boolean;
}) {
  const steps = data.progressSteps || [];
  const startedAt = data.startedAt || Date.now();
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // In embedded mode (DeepInsightView), no fixed-height/overflow chain —
  // the page scroller handles everything, the timeline grows naturally.
  const rootCls = embedded
    ? 'flex flex-col'
    : 'flex h-full flex-col overflow-hidden';
  const timelineCls = embedded
    ? 'px-6 py-4'
    : 'custom-scrollbar flex-1 overflow-y-auto px-6 py-4';

  return (
    <div className={rootCls}>
      {/* Hero */}
      <div className="shrink-0 border-b border-accent-100 bg-gradient-to-br from-accent-50 via-white to-white px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-500 text-white shadow-sm">
              <Brain className="h-5 w-5" />
            </div>
            <span className="absolute -right-1 -top-1 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-400 opacity-60" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-accent-500" />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <h3 className="truncate text-[15px] font-semibold text-navy-900">
                {data.title || 'Deep Analysis'}
              </h3>
              <span className="text-[11.5px] font-medium text-navy-400">
                · {formatElapsed(startedAt)} elapsed
              </span>
            </div>
            <p className="mt-0.5 truncate text-[12.5px] text-navy-600">
              <Loader2 className="inline h-3 w-3 animate-spin align-[-1px] text-accent-600" />{' '}
              <span className="font-medium">{data.currentStep || 'Working…'}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Progress timeline */}
      <div className={timelineCls}>
        <p className="mb-3 text-[10.5px] font-semibold uppercase tracking-wider text-navy-500">
          Analysis timeline · {steps.length} step{steps.length !== 1 ? 's' : ''}
        </p>
        {steps.length === 0 ? (
          <p className="text-[12.5px] italic text-navy-400">Preparing the analysis plan…</p>
        ) : (
          <ol className="space-y-1">
            {steps.map((step, i) => (
              <TimelineRow key={step.id} step={step} isLast={i === steps.length - 1} />
            ))}
          </ol>
        )}
      </div>

      {/* Footer hint */}
      <div className="shrink-0 border-t border-navy-100 bg-navy-50/60 px-6 py-2.5 text-[11.5px] text-navy-500">
        <Sparkles className="mr-1.5 inline h-3 w-3 align-[-2px] text-accent-500" />
        You can keep chatting — this analysis runs in the background.
      </div>
    </div>
  );
}

function TimelineRow({ step, isLast }: { step: DeepProgressStep; isLast: boolean }) {
  const cfg = STEP_ICONS[step.kind] || STEP_ICONS.info;
  const Icon = cfg.icon;
  const isActive = step.status === 'active';
  const isDone = step.status === 'done';
  const isError = step.status === 'error';

  return (
    <li className="relative flex gap-3 py-1.5">
      {!isLast && (
        <span className="absolute left-[11px] top-7 bottom-[-6px] w-px bg-navy-200" />
      )}
      <div
        className={`z-10 mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full ring-2 ring-white ${
          isError
            ? 'bg-danger-50 ring-1 ring-inset ring-danger-500/30'
            : isDone
              ? 'bg-emerald-50'
              : 'bg-accent-50'
        }`}
      >
        {isActive ? (
          <Loader2 className={`h-3 w-3 animate-spin ${cfg.tone}`} />
        ) : isDone ? (
          <Check className="h-3 w-3 text-emerald-600" strokeWidth={3} />
        ) : isError ? (
          <AlertCircle className="h-3 w-3 text-danger-600" />
        ) : (
          <Icon className={`h-3 w-3 ${cfg.tone}`} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={`text-[12.5px] leading-snug ${
            isError ? 'text-danger-700' : isActive ? 'font-medium text-navy-800' : 'text-navy-700'
          }`}
        >
          {step.label}
        </p>
        {(step.rowCount != null || step.durationMs != null) && (
          <p className="mt-0.5 text-[11px] text-navy-400">
            {step.rowCount != null && <span>{step.rowCount.toLocaleString()} rows</span>}
            {step.rowCount != null && step.durationMs != null && <span> · </span>}
            {step.durationMs != null && <span>{Math.round(step.durationMs)}ms</span>}
          </p>
        )}
        {step.detail && !step.sql && (
          <p className="mt-0.5 line-clamp-2 text-[11.5px] italic text-danger-600">{step.detail}</p>
        )}
      </div>
    </li>
  );
}

/* ─── Failed state ─── */
function FailedState({ data }: { data: DeepAnalysisBlockData }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-8 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-danger-50 text-danger-600 ring-1 ring-inset ring-danger-500/20">
        <AlertCircle className="h-6 w-6" />
      </div>
      <h3 className="text-[15px] font-semibold text-navy-900">Deep analysis failed</h3>
      <p className="mt-1 max-w-md text-[13px] leading-relaxed text-navy-500">
        {data.error || 'Something went wrong during analysis.'}
      </p>
    </div>
  );
}

/* ─── Observation bullet list ─── */
function ObservationList({ items }: { items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <ul className="mt-3 space-y-1.5">
      {items.map((obs, i) => (
        <li key={i} className="flex items-start gap-2">
          <Dot className="mt-0.5 h-4 w-4 shrink-0 text-accent-500" />
          <span className="text-[13px] leading-relaxed text-navy-700">{obs}</span>
        </li>
      ))}
    </ul>
  );
}

/* ─── Inline charts row (full width within section) ─── */
function InlineCharts({ charts }: { charts?: DeepAnalysisSection['charts'] }) {
  if (!charts || charts.length === 0) return null;
  return (
    <div className="mt-4 space-y-3">
      {charts.map((chart, i) => (
        <DeepInlineChart key={i} chart={chart as unknown as ChartRecommendation} />
      ))}
    </div>
  );
}

/* Each Deep Insight chart gets its own ChartToolbar — chart-type
 * conversion, hide / show series, and the data-table toggle. Edits
 * are kept in component-local state because Deep Insight responses
 * are part of immutable chat history; refreshing reverts to the
 * planner's original chart spec. */
function DeepInlineChart({ chart }: { chart: ChartRecommendation }) {
  const [override, setOverride] = useState<ChartRecommendation>(chart);
  const [showData, setShowData] = useState(false);
  // Re-sync if the parent passes a new chart object (e.g. follow-up
  // re-renders the section with fresh data).
  useEffect(() => {
    setOverride(chart);
  }, [chart]);
  return (
    <div
      className="overflow-hidden rounded-xl border border-navy-100 bg-white shadow-sm"
      style={{ minHeight: 320 }}
    >
      <div className="flex items-center justify-between gap-2 border-b border-navy-100 px-3 py-1.5">
        <span className="truncate text-[12.5px] font-semibold text-navy-800">
          {override.title || 'Chart'}
        </span>
        <ChartToolbar
          chart={override}
          showData={showData}
          onShowDataToggle={() => setShowData((v) => !v)}
          onChartChange={(next) => setOverride(next)}
        />
      </div>
      <div className="p-2">
        <ChartRenderer chart={override} compact showData={showData} />
      </div>
    </div>
  );
}

/* ─── Single section card — heading + significance + body + obs + charts ─── */
function SectionCard({ section, index }: { section: DeepAnalysisSection; index: number }) {
  const sig = (section.significance as Significance) || 'low';

  return (
    <section className="rounded-2xl border border-navy-100 bg-white p-6 shadow-sm">
      <header className="mb-3 flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-[12px] font-bold text-navy-500">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-[16px] font-semibold tracking-tight text-navy-900">
              {section.heading}
            </h3>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider ring-1 ring-inset ${SIG_BADGE[sig]}`}
            >
              <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle ${SIG_DOT[sig]}`} />
              {section.significance}
            </span>
          </div>
        </div>
      </header>

      {section.content && (
        <div className="is-prose">
          <Markdown>{section.content}</Markdown>
        </div>
      )}

      <ObservationList items={section.observations} />
      <InlineCharts charts={section.charts} />
    </section>
  );
}

/* ─── Single recommendation card ─── */
function RecommendationCard({ rec, index }: { rec: DeepRecommendation; index: number }) {
  return (
    <section className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/60 to-white p-6 shadow-sm">
      <header className="mb-3 flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200">
          <Lightbulb className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
            Recommendation #{index + 1}
          </p>
          <h3 className="mt-0.5 text-[16px] font-semibold leading-snug text-navy-900">
            {rec.action}
          </h3>
        </div>
      </header>

      {rec.rationale && (
        <p className="text-[13.5px] leading-relaxed text-navy-700">{rec.rationale}</p>
      )}

      <ObservationList items={rec.observations} />
      <InlineCharts charts={rec.charts} />
    </section>
  );
}

/* ─── Follow-up input ─── */
function FollowUpInput({ onSubmit }: { onSubmit: (q: string) => void }) {
  const [value, setValue] = useState('');
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!taRef.current) return;
    taRef.current.style.height = 'auto';
    taRef.current.style.height = Math.min(taRef.current.scrollHeight, 140) + 'px';
  }, [value]);

  const submit = () => {
    const q = value.trim();
    if (!q) return;
    onSubmit(q);
    setValue('');
  };

  return (
    <div className="shrink-0 border-t border-navy-100 bg-navy-50/60 px-6 py-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent-500 text-white">
          <MessageSquare className="h-3.5 w-3.5" />
        </span>
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-navy-600">
          Continue this analysis
        </p>
      </div>
      <div className="flex items-end gap-2 rounded-xl border border-navy-200 bg-white px-3 py-2 shadow-sm transition-colors focus-within:border-accent-400 focus-within:ring-2 focus-within:ring-accent-100">
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Drill deeper — ask a follow-up about this analysis…"
          rows={1}
          className="flex-1 resize-none border-0 bg-transparent px-1 py-1 text-[14px] text-navy-800 placeholder:text-navy-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!value.trim()}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all ${
            value.trim()
              ? 'bg-accent-500 text-white shadow-sm hover:bg-accent-600'
              : 'bg-navy-100 text-navy-400'
          }`}
          title="Send follow-up (Enter)"
        >
          <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
        </button>
      </div>
      <p className="mt-1.5 text-center text-[10.5px] text-navy-400">
        Follow-ups run as Deep Analysis · evidence + recommendations are appended below
      </p>
    </div>
  );
}

/* ─── Main component ─── */
function DeepAnalysisBlockImpl({ data, onFollowUp, embedded = false }: DeepAnalysisBlockProps) {
  const [showTimeline, setShowTimeline] = useState(false);

  if (data.status === 'running') return <RunningState data={data} embedded={embedded} />;
  if (data.status === 'failed') return <FailedState data={data} />;

  const hasTimeline = (data.progressSteps || []).length > 0;
  const elapsed =
    data.startedAt && data.completedAt
      ? formatElapsed(data.startedAt, data.completedAt)
      : null;

  // ── Container shape depends on context ──
  // embedded (DeepInsightView): no internal scroll, no fixed height —
  //   the page-level scroller handles paging through multiple analyses.
  // default (canvas): h-full + overflow-hidden + internal scroll for the
  //   fixed-size grid cell.
  const rootClass = embedded
    ? 'flex flex-col bg-navy-50/40'
    : 'flex h-full flex-col overflow-hidden bg-navy-50/40';
  const innerClass = embedded
    ? 'px-6 py-6'
    : 'custom-scrollbar flex-1 overflow-y-auto px-6 py-6';

  return (
    <div className={rootClass}>
      <div className={innerClass}>
        <div className="mx-auto max-w-5xl space-y-5">
          {/* ── Executive Summary (top) ── */}
          <section className="rounded-2xl border border-accent-200 bg-gradient-to-br from-accent-50 via-white to-white p-6 shadow-sm">
            <header className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent-500 text-white shadow-sm">
                  <Brain className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-accent-700">
                    Executive summary
                  </p>
                  {data.title && (
                    <h2 className="text-[17px] font-bold leading-tight text-navy-900">
                      {data.title}
                    </h2>
                  )}
                </div>
              </div>
              {elapsed && (
                <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-navy-500 ring-1 ring-navy-100">
                  Analyzed in {elapsed}
                </span>
              )}
            </header>
            <div className="is-prose">
              <Markdown>{data.executiveSummary}</Markdown>
            </div>
          </section>

          {/* ── Sections (each with inline charts + observations) ──
              In embedded mode, lazy-mount sections beyond the first so a
              long analysis with many charts doesn't stall the main thread
              on initial mount. The first section is in viewport already
              and mounts synchronously; the rest hydrate as the user scrolls. */}
          {data.sections.map((section, i) =>
            embedded && i > 0 ? (
              <LazyMount key={i} placeholderHeight={320} rootMargin="500px">
                <SectionCard section={section} index={i} />
              </LazyMount>
            ) : (
              <SectionCard key={i} section={section} index={i} />
            ),
          )}

          {/* ── Recommendations (each is its own evidence-backed card) ── */}
          {data.recommendations.length > 0 && (
            <div className="space-y-3">
              <header className="flex items-center gap-2 px-1">
                <Target className="h-4 w-4 text-emerald-600" />
                <h3 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                  Recommendations
                </h3>
              </header>
              {data.recommendations.map((rec, i) =>
                embedded ? (
                  <LazyMount key={i} placeholderHeight={220} rootMargin="500px">
                    <RecommendationCard rec={rec} index={i} />
                  </LazyMount>
                ) : (
                  <RecommendationCard key={i} rec={rec} index={i} />
                ),
              )}
            </div>
          )}

          {/* ── Methodology footer ── */}
          {data.methodology && (
            <section className="rounded-xl border border-navy-100 bg-white px-4 py-3 text-[12px] italic leading-relaxed text-navy-500">
              <span className="mr-2 font-semibold not-italic uppercase tracking-wider text-navy-700">
                Methodology
              </span>
              {data.methodology}
            </section>
          )}

          {/* ── Optional collapsed timeline ── */}
          {hasTimeline && (
            <section className="rounded-xl border border-navy-100 bg-white">
              <button
                type="button"
                onClick={() => setShowTimeline(!showTimeline)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-navy-50"
              >
                <div className="flex items-center gap-2">
                  {showTimeline ? (
                    <ChevronDown className="h-3.5 w-3.5 text-navy-400" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-navy-400" />
                  )}
                  <span className="text-[12.5px] font-semibold text-navy-700">
                    Analysis timeline
                  </span>
                  <span className="text-[11px] text-navy-400">
                    {(data.progressSteps || []).length} steps
                  </span>
                </div>
              </button>
              {showTimeline && (
                <div className="border-t border-navy-100 px-4 py-3">
                  <ol className="space-y-1">
                    {(data.progressSteps || []).map((step, i) => (
                      <TimelineRow
                        key={step.id}
                        step={step}
                        isLast={i === (data.progressSteps || []).length - 1}
                      />
                    ))}
                  </ol>
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      {/* ── Follow-up chat input at the very bottom ── */}
      {onFollowUp && <FollowUpInput onSubmit={onFollowUp} />}
    </div>
  );
}

/** Memoized: re-renders only when the block's data identity or follow-up
 *  callback identity changes. Cheap during canvas-wide re-layouts. */
const DeepAnalysisBlock = memo(
  DeepAnalysisBlockImpl,
  (prev, next) => prev.data === next.data && prev.onFollowUp === next.onFollowUp,
);
export default DeepAnalysisBlock;
