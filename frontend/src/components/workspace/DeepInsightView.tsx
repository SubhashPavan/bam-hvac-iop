import { useMemo, useState, useRef, useEffect } from 'react';
import { Brain, Plus, Sparkles, X, Play } from 'lucide-react';
import { useCanvasStore } from '../../store/canvasStore';
import { useChatStore } from '../../store/chatStore';
import DeepAnalysisBlock from '../canvas/blocks/DeepAnalysisBlock';
import LazyMount from '../canvas/LazyMount';
import type { CanvasBlock, DeepAnalysisBlockData } from '../../types/canvas';

// Stable empty array — using `[]` inline creates a new reference each
// render and forces every Zustand subscriber to re-render unnecessarily.
const EMPTY_BLOCKS: CanvasBlock[] = [];

interface Props {
  workspaceId: string;
  hasConnection: boolean;
  connectionId: string;
  /** Fire a brand-new deep analysis (mode='deep'). */
  onRunDeep: (message: string, mode: 'quick' | 'deep') => void;
  /** Send a follow-up question on an existing thread. */
  onFollowUp: (question: string, deepThreadId: string) => void;
}

/**
 * Full-page Deep Insight view.
 *
 * Layout:
 *   ┌──────────┬──────────────────────────┐
 *   │ Threads  │  Selected analysis       │
 *   │ sidebar  │  (DeepAnalysisBlock)     │
 *   │          │                          │
 *   └──────────┴──────────────────────────┘
 *
 * The "+ New deep insight" button at the top opens a small brief panel
 * that captures the objective and fires a deep run. While running, the
 * thread shows live progress (the same RunningState the canvas uses).
 */
export default function DeepInsightView({
  workspaceId,
  hasConnection,
  connectionId,
  onRunDeep,
  onFollowUp,
}: Props) {
  const allBlocks = useCanvasStore((s) => s.blocks[workspaceId] || EMPTY_BLOCKS);
  const activeSessionId = useChatStore((s) => s.activeSessionId);

  // Filter to deep blocks for the active chat session.
  const deepBlocks = useMemo(() => {
    return allBlocks.filter(
      (b): b is CanvasBlock =>
        b.type === 'deep_analysis' &&
        b.analysisMode === 'deep' &&
        (b.sessionId === activeSessionId || !b.sessionId),
    );
  }, [allBlocks, activeSessionId]);

  // Group by deepThreadId so follow-ups stack inside one thread.
  const threads = useMemo(() => {
    const map = new Map<string, CanvasBlock[]>();
    for (const b of deepBlocks) {
      const tid = b.deepThreadId || b.sourceMessageId;
      const arr = map.get(tid) || [];
      arr.push(b);
      map.set(tid, arr);
    }
    return Array.from(map.entries()).map(([id, blocks]) => ({
      id,
      title:
        blocks[0]?.sourceQuery ||
        (blocks[0]?.data as DeepAnalysisBlockData | undefined)?.title ||
        'Deep Analysis',
      latestAt: Math.max(...blocks.map((b) => b.createdAt)),
      blocks: blocks.sort((a, b) => a.createdAt - b.createdAt),
    })).sort((a, b) => b.latestAt - a.latestAt);
  }, [deepBlocks]);

  // Lazy initial state: seed with the most recent thread on first render
  // so we don't go null → first thread (which causes a double render and
  // a flash of empty state on tab-switch).
  const [activeThreadId, setActiveThreadId] = useState<string | null>(
    () => threads[0]?.id ?? null,
  );
  const [showBrief, setShowBrief] = useState(false);

  // If a brand-new thread appears (e.g. user just kicked off a deep run),
  // jump to it. Skips work if the user already has one active.
  useEffect(() => {
    if (!activeThreadId && threads.length > 0) {
      setActiveThreadId(threads[0].id);
    }
  }, [threads, activeThreadId]);

  const activeThread = threads.find((t) => t.id === activeThreadId) || threads[0] || null;

  return (
    <div className="flex h-full min-w-0 flex-1">
      {/* ── Threads sidebar ── */}
      <aside className="flex w-[260px] shrink-0 flex-col border-r border-navy-100 bg-white">
        <div className="flex items-center justify-between gap-2 border-b border-navy-100 p-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-navy-500">
            Deep analyses
          </span>
          <button
            type="button"
            onClick={() => setShowBrief(true)}
            disabled={!hasConnection}
            className="inline-flex items-center gap-1 rounded-md bg-accent-500 px-2 py-1 text-[11.5px] font-semibold text-white shadow-sm transition-colors hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-60"
            title={hasConnection ? 'Start a new deep analysis' : 'Connect a data source first'}
          >
            <Plus className="h-3 w-3" />
            New
          </button>
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto p-2">
          {threads.length === 0 ? (
            <div className="px-3 py-12 text-center">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-accent-50 text-accent-600 ring-1 ring-inset ring-accent-200">
                <Brain className="h-5 w-5" />
              </div>
              <p className="text-[12.5px] leading-relaxed text-navy-500">
                No deep analyses yet.
                <br />
                Click <span className="font-semibold text-accent-700">+ New</span> to start one.
              </p>
            </div>
          ) : (
            <ul className="space-y-1">
              {threads.map((t) => {
                const active = activeThreadId === t.id;
                const lastBlock = t.blocks[t.blocks.length - 1];
                const status =
                  (lastBlock?.data as DeepAnalysisBlockData | undefined)?.status || 'ready';
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setActiveThreadId(t.id)}
                      className={`group flex w-full flex-col rounded-lg px-3 py-2 text-left transition-colors ${
                        active
                          ? 'bg-accent-50 ring-1 ring-inset ring-accent-200'
                          : 'hover:bg-navy-50'
                      }`}
                    >
                      <p className={`line-clamp-2 text-[12.5px] leading-snug ${active ? 'text-accent-800 font-medium' : 'text-navy-800'}`}>
                        {t.title}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-[10.5px] uppercase tracking-wider text-navy-400">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            status === 'running'
                              ? 'bg-accent-500'
                              : status === 'failed'
                                ? 'bg-danger-500'
                                : 'bg-emerald-500'
                          }`}
                        />
                        {status}
                        {t.blocks.length > 1 && (
                          <span className="text-navy-400">· {t.blocks.length} parts</span>
                        )}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* ── Active thread renderer ──
          One scroll container = the <main>. h-full guarantees a bounded
          height so overflow-y-auto actually engages. Each analysis flows
          naturally inside (embedded=true on DeepAnalysisBlock), so the
          page scrolls top→bottom through every part of the thread. */}
      <main
        className="custom-scrollbar h-full min-w-0 flex-1 overflow-y-auto bg-navy-50/40"
      >
        {!activeThread ? (
          <div className="flex h-full items-center justify-center">
            <EmptyState onStart={() => setShowBrief(true)} disabled={!hasConnection} />
          </div>
        ) : (
          activeThread.blocks.map((block, idx) => (
            <div
              key={block.id}
              className={idx > 0 ? 'border-t border-navy-100' : ''}
            >
              {/* The first block always renders. Subsequent blocks lazy-
                  mount when scrolled to within 600px — that way mounting
                  the deep tab paints fast even when a thread has many
                  parts, and follow-ups hydrate as the user scrolls. */}
              {idx === 0 ? (
                <DeepAnalysisBlock
                  data={block.data as DeepAnalysisBlockData}
                  embedded
                  onFollowUp={
                    hasConnection && idx === activeThread.blocks.length - 1
                      ? (q) => onFollowUp(q, activeThread.id)
                      : undefined
                  }
                />
              ) : (
                <LazyMount placeholderHeight={500} rootMargin="600px">
                  <DeepAnalysisBlock
                    data={block.data as DeepAnalysisBlockData}
                    embedded
                    onFollowUp={
                      hasConnection && idx === activeThread.blocks.length - 1
                        ? (q) => onFollowUp(q, activeThread.id)
                        : undefined
                    }
                  />
                </LazyMount>
              )}
            </div>
          ))
        )}
      </main>

      {showBrief && (
        <DeepBriefModal
          onClose={() => setShowBrief(false)}
          onSubmit={(text) => {
            setShowBrief(false);
            onRunDeep(text, 'deep');
          }}
          disabled={!hasConnection}
          connectionId={connectionId}
        />
      )}
    </div>
  );
}

/* ─── Empty state ─── */
function EmptyState({ onStart, disabled }: { onStart: () => void; disabled: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-50 to-accent-100 text-accent-600 ring-1 ring-inset ring-accent-200">
        <Brain className="h-6 w-6" />
      </div>
      <h3 className="text-[16px] font-semibold tracking-tight text-navy-900">Deep Insight mode</h3>
      <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-navy-500">
        Pose a strategic question — the agent runs multiple sub-queries with Sonnet/Opus and returns
        an executive summary, evidence-backed sections, and concrete recommendations.
      </p>
      <button
        type="button"
        onClick={onStart}
        disabled={disabled}
        className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-accent-500 px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Sparkles className="h-4 w-4" />
        Start a deep analysis
      </button>
    </div>
  );
}

/* ─── New-deep brief modal ─── */
function DeepBriefModal({
  onClose,
  onSubmit,
  disabled,
}: {
  onClose: () => void;
  onSubmit: (text: string) => void;
  disabled: boolean;
  connectionId: string;
}) {
  const [objective, setObjective] = useState('');
  const [scope, setScope] = useState('');
  const [metrics, setMetrics] = useState('');
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setTimeout(() => taRef.current?.focus(), 30);
  }, []);

  const compose = () => {
    const o = objective.trim();
    if (!o) return;
    let msg = o;
    const s = scope.trim();
    const m = metrics.trim();
    if (s || m) {
      msg += '\n\n';
      if (s) msg += `Scope: ${s}\n`;
      if (m) msg += `Key Metrics: ${m}`;
    }
    onSubmit(msg.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/50 px-4 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl animate-fade-slide-in">
        <div className="flex items-center justify-between gap-3 border-b border-navy-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500 text-white shadow-sm">
              <Sparkles className="h-4 w-4" />
            </span>
            <h2 className="text-[16px] font-semibold tracking-tight text-navy-900">
              New Deep Analysis
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-navy-400 hover:bg-navy-50 hover:text-navy-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wider text-navy-500">
              What do you want to analyze?
            </label>
            <textarea
              ref={taRef}
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              rows={3}
              placeholder="e.g. Identify the top revenue drivers for Q4 and explain why each is growing or declining."
              className="w-full resize-none rounded-lg border border-navy-200 bg-white px-3 py-2 text-[13.5px] text-navy-800 placeholder:text-navy-400 focus:border-accent-400 focus:ring-2 focus:ring-accent-100 focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wider text-navy-500">
                Scope <span className="font-normal lowercase text-navy-400">optional</span>
              </label>
              <input
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                placeholder="e.g. Q1-Q4 2024, North America"
                className="w-full rounded-lg border border-navy-200 bg-white px-3 py-1.5 text-[13.5px] text-navy-800 placeholder:text-navy-400 focus:border-accent-400 focus:ring-2 focus:ring-accent-100 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wider text-navy-500">
                Key metrics <span className="font-normal lowercase text-navy-400">optional</span>
              </label>
              <input
                value={metrics}
                onChange={(e) => setMetrics(e.target.value)}
                placeholder="e.g. Revenue, AOV, Churn"
                className="w-full rounded-lg border border-navy-200 bg-white px-3 py-1.5 text-[13.5px] text-navy-800 placeholder:text-navy-400 focus:border-accent-400 focus:ring-2 focus:ring-accent-100 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-navy-100 bg-navy-50/50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-navy-200 bg-white px-4 py-2 text-[13.5px] font-semibold text-navy-700 hover:bg-navy-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={compose}
            disabled={disabled || !objective.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-2 text-[13.5px] font-semibold text-white shadow-sm hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Play className="h-3.5 w-3.5" />
            Run deep analysis
          </button>
        </div>
      </div>
    </div>
  );
}
