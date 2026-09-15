import { useMemo } from 'react';
import { Activity, Brain, Coins, Zap, Clock, DatabaseZap } from 'lucide-react';
import type { ChatSession } from '../../types/chat';

interface MetricsBarProps {
  sessions: ChatSession[];
}

export default function MetricsBar({ sessions }: MetricsBarProps) {
  const metrics = useMemo(() => {
    // Per-mode counters. Each user-message's `analysisMode` decides
    // which bucket it (and its assistant reply's tokens / cost) goes
    // into.  Quick = lightweight chat-driven SQL (Haiku); Deep =
    // multi-step strategic analysis (Sonnet/Opus).
    let quickQuestions = 0;
    let deepQuestions = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCost = 0;
    let totalDuration = 0;
    // Track every model the agent has dispatched to so the badge can
    // show the full routing picture ("haiku · sonnet"), not just the
    // first one seen.
    const modelSet = new Set<string>();
    let cacheHits = 0;

    for (const session of sessions) {
      for (const msg of session.messages) {
        if (msg.role === 'user') {
          if (msg.analysisMode === 'deep') deepQuestions++;
          else quickQuestions++;
        }
        if (msg.insightResult?.execution_metadata) {
          const meta = msg.insightResult.execution_metadata;
          totalInputTokens += meta.input_tokens || 0;
          totalOutputTokens += meta.output_tokens || 0;
          totalCost += meta.estimated_cost_usd || 0;
          totalDuration += meta.total_duration_ms || 0;
          if (meta.model_name) modelSet.add(prettifyModel(meta.model_name));
          if (meta.cached) cacheHits++;
        }
      }
    }

    const totalQuestions = quickQuestions + deepQuestions;
    return {
      quickQuestions,
      deepQuestions,
      totalQuestions,
      totalInputTokens,
      totalOutputTokens,
      totalTokens: totalInputTokens + totalOutputTokens,
      totalCost,
      avgDuration: totalQuestions > 0 ? totalDuration / totalQuestions : 0,
      modelLabel: Array.from(modelSet).join(' · '),
      cacheHits,
    };
  }, [sessions]);

  const formatTokens = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toString();
  };

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-navy-100 bg-white px-5 py-2 text-[11.5px] text-navy-600">
      {/* Questions split by mode — Quick uses the accent zap, Deep uses
          the violet brain so the routing story is visible at a glance. */}
      <Metric
        icon={Zap}
        iconClass="text-accent-600"
        value={metrics.quickQuestions.toString()}
        label="quick"
        title="Questions answered in Quick Insight mode (Haiku)"
      />
      <Metric
        icon={Brain}
        iconClass="text-violet-600"
        value={metrics.deepQuestions.toString()}
        label="deep"
        title="Questions answered in Deep Insight mode (Sonnet / Opus)"
      />
      <Divider />
      <Metric icon={Zap} value={formatTokens(metrics.totalTokens)} label="tokens" />
      <Divider />
      <Metric icon={Coins} value={`$${metrics.totalCost.toFixed(4)}`} label="cost" />
      <Divider />
      <Metric icon={DatabaseZap} value={metrics.cacheHits.toString()} label="cached" />
      <Divider />
      <Metric icon={Clock} value={`${(metrics.avgDuration / 1000).toFixed(1)}s`} label="avg time" />
      {metrics.modelLabel && (
        <>
          <Divider />
          <span
            className="inline-flex items-center gap-1.5 rounded-full bg-accent-50 px-2 py-0.5 text-[11px] font-semibold text-accent-700 ring-1 ring-inset ring-accent-200"
            title="Models routed to during this session"
          >
            <Activity className="h-3 w-3" />
            {metrics.modelLabel}
          </span>
        </>
      )}
    </div>
  );
}

/** Turn a Claude model id like 'claude-sonnet-4-5' into a clean badge
 *  label like 'Sonnet'. Falls back to the raw string if it's an
 *  unrecognized shape (so OpenAI / Gemini IDs still show through).  */
function prettifyModel(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes('haiku')) return 'Haiku';
  if (s.includes('sonnet')) return 'Sonnet';
  if (s.includes('opus')) return 'Opus';
  if (s.includes('gpt-4o')) return 'GPT-4o';
  if (s.includes('gemini')) return 'Gemini';
  return raw;
}

function Metric({
  icon: Icon,
  iconClass,
  value,
  label,
  title,
}: {
  icon: typeof Zap;
  iconClass?: string;
  value: string;
  label: string;
  title?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5" title={title}>
      <Icon className={`h-3.5 w-3.5 ${iconClass || 'text-navy-400'}`} />
      <span className="font-semibold tabular-nums text-navy-800">{value}</span>
      <span className="text-navy-500">{label}</span>
    </span>
  );
}

function Divider() {
  return <span className="h-3.5 w-px bg-navy-200" />;
}
