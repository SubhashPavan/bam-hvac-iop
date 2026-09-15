import { useMemo, useCallback, useRef, useState, useEffect } from 'react';
import { ResponsiveGridLayout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import { Trash2, RefreshCw, X, LayoutGrid, Pencil, Check } from 'lucide-react';
import { useCanvasStore } from '../../store/canvasStore';
import CanvasBlockComponent from './CanvasBlock';
import ChartBlock from './blocks/ChartBlock';
import TableBlock from './blocks/TableBlock';
import KpiBlock from './blocks/KpiBlock';
import NarrativeBlock from './blocks/NarrativeBlock';
import DeepAnalysisBlock from './blocks/DeepAnalysisBlock';
import EmptyCanvas from './EmptyCanvas';
import LazyMount from './LazyMount';
import type { CanvasBlock } from '../../types/canvas';
import type {
  ChartBlockData,
  TableBlockData,
  KpiBlockData,
  NarrativeBlockData,
  DeepAnalysisBlockData,
} from '../../types/canvas';

const EMPTY_BLOCKS: CanvasBlock[] = [];

interface CanvasTab {
  id: string;
  label: string;
  blockCount: number;
  isDeep: boolean;
}

interface CanvasPanelProps {
  workspaceId: string;
  activeSessionId?: string | null;
  onFollowUp?: (question: string) => void;
  /** Submit a follow-up question inside an existing Deep Analysis thread. */
  onDeepFollowUp?: (question: string, deepThreadId: string) => void;
  canvasTitle?: string;
  /** Rename the canvas (typically renames the active chat session). */
  onRenameCanvas?: (title: string) => void;
  onRefreshCanvas?: () => void;
  isRefreshing?: boolean;
}

function renderBlockContent(
  block: CanvasBlock,
  onFollowUp?: (question: string) => void,
  onDeepFollowUp?: (question: string, deepThreadId: string) => void,
) {
  switch (block.type) {
    case 'chart':
      return <ChartBlock data={block.data as ChartBlockData} />;
    case 'table':
      return <TableBlock data={block.data as TableBlockData} />;
    case 'kpi':
      return <KpiBlock data={block.data as KpiBlockData} />;
    case 'narrative':
      return <NarrativeBlock data={block.data as NarrativeBlockData} onFollowUp={onFollowUp} />;
    case 'deep_analysis':
      return (
        <DeepAnalysisBlock
          data={block.data as DeepAnalysisBlockData}
          onFollowUp={
            onDeepFollowUp
              ? (q) => onDeepFollowUp(q, block.deepThreadId || block.sourceMessageId)
              : undefined
          }
        />
      );
    default:
      return null;
  }
}

export default function CanvasPanel({
  workspaceId,
  activeSessionId,
  onFollowUp,
  onDeepFollowUp,
  canvasTitle,
  onRenameCanvas,
  onRefreshCanvas,
  isRefreshing,
}: CanvasPanelProps) {
  const allBlocks = useCanvasStore((s) => s.blocks[workspaceId] || EMPTY_BLOCKS);

  // Filter blocks to only show ones belonging to the active session.
  // Deep-analysis blocks are excluded entirely — they live in the
  // dedicated Deep Insight view (selected via the workspace mode tabs),
  // so the canvas is now Quick-only and never shows a deep-analysis tab.
  const blocks = useMemo(() => {
    if (!activeSessionId) return EMPTY_BLOCKS;
    return allBlocks.filter(
      (b) =>
        b.analysisMode !== 'deep' &&
        (b.sessionId === activeSessionId || !b.sessionId),
    );
  }, [allBlocks, activeSessionId]);
  const highlightedBlockId = useCanvasStore((s) => s.highlightedBlockId);
  const removeBlock = useCanvasStore((s) => s.removeBlock);
  const clearCanvas = useCanvasStore((s) => s.clearCanvas);
  const updateAllLayouts = useCanvasStore((s) => s.updateAllLayouts);
  const updateBlockLayout = useCanvasStore((s) => s.updateBlockLayout);
  const activeTabId = useCanvasStore((s) => s.activeTab[workspaceId] || 'quick');
  const setActiveTab = useCanvasStore((s) => s.setActiveTab);
  const removeDeepTab = useCanvasStore((s) => s.removeDeepTab);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Must match px-6 wrapper (24px each side = 48px total)
        setContainerWidth(entry.contentRect.width - 48);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const tabs = useMemo((): CanvasTab[] => {
    const result: CanvasTab[] = [];
    const quickBlocks = blocks.filter((b) => b.analysisMode !== 'deep');
    result.push({
      id: 'quick',
      label: 'Quick Insights',
      blockCount: quickBlocks.length,
      isDeep: false,
    });

    // One deep tab per deepThreadId (root messageId); follow-ups in the
    // same thread share the tab. Fallback to sourceMessageId for legacy
    // blocks that pre-date deepThreadId.
    const deepGroups = new Map<string, { query: string; count: number }>();
    for (const block of blocks) {
      if (block.analysisMode !== 'deep') continue;
      const threadId = block.deepThreadId || block.sourceMessageId;
      const existing = deepGroups.get(threadId);
      if (existing) {
        existing.count++;
      } else {
        deepGroups.set(threadId, {
          query: block.sourceQuery || 'Deep Analysis',
          count: 1,
        });
      }
    }

    for (const [threadId, info] of deepGroups) {
      result.push({
        id: threadId,
        label: info.query.length > 40 ? info.query.slice(0, 40) + '…' : info.query,
        blockCount: info.count,
        isDeep: true,
      });
    }

    return result;
  }, [blocks]);

  const isViewingDeepTab = activeTabId !== 'quick';

  const filteredBlocks = useMemo(() => {
    if (activeTabId === 'quick') {
      return blocks.filter((b) => b.analysisMode !== 'deep');
    }
    // Deep tab: include any block whose deepThreadId matches (or, for
    // legacy blocks, whose sourceMessageId matches).
    return blocks.filter(
      (b) =>
        b.analysisMode === 'deep' &&
        ((b.deepThreadId || b.sourceMessageId) === activeTabId)
    );
  }, [blocks, activeTabId]);

  const layouts = useMemo(() => {
    return {
      lg: filteredBlocks.map((b) => ({
        i: b.id,
        x: b.layout.x,
        y: b.layout.y,
        w: b.layout.w,
        h: b.layout.h,
        // 12-col grid — minW=2 lets users go narrow (KPI-strip width),
        // maxW=12 explicitly allows pulling a block all the way across
        // the canvas. No maxH so users can grow tall as they want.
        minW: 2,
        maxW: 12,
        minH: 2,
        // In this fork of react-grid-layout, `resizeHandles` is a
        // per-item prop (the top-level one is silently ignored) — so
        // expose all 8 edges/corners on every block.
        resizeHandles: ['se', 's', 'e', 'sw', 'w', 'ne', 'n', 'nw'],
      })),
    };
  }, [filteredBlocks]);

  const handleLayoutChange = useCallback(
    (
      layout: ReadonlyArray<{
        readonly i: string;
        readonly x: number;
        readonly y: number;
        readonly w: number;
        readonly h: number;
      }>,
      _layouts: unknown
    ) => {
      updateAllLayouts(
        workspaceId,
        layout.map((l) => ({ i: l.i, x: l.x, y: l.y, w: l.w, h: l.h }))
      );
    },
    [workspaceId, updateAllLayouts]
  );

  // Toggle a block between "full canvas width" (w=12, x=0) and the size
  // it had before maximizing. We stash the prior size in a ref so the
  // restore is faithful even after a remount.
  const priorSizeRef = useRef<Record<string, { x: number; w: number }>>({});
  const handleToggleFullWidth = useCallback(
    (blockId: string) => {
      const block = filteredBlocks.find((b) => b.id === blockId);
      if (!block) return;
      const isFullWidth = block.layout.w >= 12;
      if (isFullWidth) {
        // Restore — fall back to a sensible default if we never saw the
        // pre-maximize size (e.g. block was already 12-wide on load).
        const prev = priorSizeRef.current[blockId] || { x: 0, w: 6 };
        updateBlockLayout(workspaceId, blockId, {
          x: prev.x,
          y: block.layout.y,
          w: prev.w,
          h: block.layout.h,
        });
      } else {
        priorSizeRef.current[blockId] = { x: block.layout.x, w: block.layout.w };
        updateBlockLayout(workspaceId, blockId, {
          x: 0,
          y: block.layout.y,
          w: 12,
          h: block.layout.h,
        });
      }
    },
    [filteredBlocks, workspaceId, updateBlockLayout]
  );

  useEffect(() => {
    if (activeTabId !== 'quick' && !tabs.some((t) => t.id === activeTabId)) {
      setActiveTab(workspaceId, 'quick');
    }
  }, [activeTabId, tabs, workspaceId, setActiveTab]);

  if (blocks.length === 0) {
    return (
      <div className="flex h-full flex-1 flex-col overflow-y-auto bg-navy-50">
        <EmptyCanvas />
      </div>
    );
  }

  const hasDeepTabs = tabs.some((t) => t.isDeep);

  return (
    <div
      ref={containerRef}
      className="custom-scrollbar flex min-w-0 flex-1 flex-col overflow-y-auto bg-navy-50"
    >
      {/* Canvas header */}
      <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-3 border-b border-navy-100 bg-white/95 px-5 py-3 backdrop-blur">
        <div className="group flex min-w-0 flex-1 items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-50 text-accent-600">
            <LayoutGrid className="h-3.5 w-3.5" />
          </div>
          <CanvasTitleEditor
            title={canvasTitle || 'Canvas'}
            onRename={onRenameCanvas}
          />
          <span className="shrink-0 rounded-full bg-navy-100 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-navy-600">
            {filteredBlocks.length} block{filteredBlocks.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onRefreshCanvas && (
            <button
              type="button"
              onClick={onRefreshCanvas}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-navy-200 bg-white px-2.5 py-1 text-[12.5px] font-semibold text-navy-700 transition-colors hover:bg-navy-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          )}
          <button
            type="button"
            onClick={() => clearCanvas(workspaceId)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-navy-200 bg-white px-2.5 py-1 text-[12.5px] font-semibold text-navy-700 transition-colors hover:border-danger-200 hover:bg-danger-50 hover:text-danger-700"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </button>
        </div>
      </div>

      {/* Tab bar — only renders when there's a real choice (i.e. at least
          one deep analysis tab). With just the lone Quick Insights tab,
          the canvas heading already conveys "this is your quick view"
          so the redundant pill is hidden. */}
      {hasDeepTabs && (
        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-navy-100 bg-white px-3 py-1.5">
          {tabs.map((tab) => {
            const active = activeTabId === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(workspaceId, tab.id)}
                className={`group inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                  active
                    ? 'bg-accent-50 text-accent-700 ring-1 ring-inset ring-accent-200'
                    : 'text-navy-600 hover:bg-navy-50 hover:text-navy-900'
                }`}
              >
                {tab.isDeep && (
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-accent-500' : 'bg-violet-500'}`}
                  />
                )}
                <span className="max-w-[180px] truncate">{tab.label}</span>
                <span
                  className={`rounded-full px-1.5 text-[10px] font-bold ${
                    active ? 'bg-accent-100 text-accent-700' : 'bg-navy-100 text-navy-600'
                  }`}
                >
                  {tab.blockCount}
                </span>
                {tab.isDeep && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeDeepTab(workspaceId, tab.id);
                    }}
                    className="flex h-4 w-4 items-center justify-center rounded opacity-0 transition-opacity hover:bg-danger-100 hover:text-danger-600 group-hover:opacity-100"
                    title="Remove this deep analysis"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Content */}
      {filteredBlocks.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6 py-12 text-center">
          <p className="max-w-sm text-[13px] leading-relaxed text-navy-500">
            {activeTabId === 'quick'
              ? 'No quick insights yet. Ask a question in Quick mode and push results to canvas.'
              : 'This deep analysis tab is empty.'}
          </p>
        </div>
      ) : isViewingDeepTab ? (
        // ── Deep tab: chrome-less, full-height stacked layout. ──
        // Each Deep Analysis block IS the tab content; no draggable grid
        // and no CanvasBlock frame around it. A small floating × in the
        // corner of each one handles deletion.
        <div className="custom-scrollbar flex flex-1 flex-col overflow-y-auto">
          {filteredBlocks.map((block, idx) => (
            <div
              key={block.id}
              className={`group relative flex flex-col ${idx > 0 ? 'border-t border-navy-100' : ''}`}
              style={{ minHeight: 'calc(100vh - 200px)' }}
            >
              <button
                type="button"
                onClick={() => removeBlock(workspaceId, block.id)}
                className="absolute right-4 top-4 z-30 flex h-7 w-7 items-center justify-center rounded-md bg-white/90 text-navy-400 opacity-0 shadow-sm ring-1 ring-navy-100 backdrop-blur transition-all hover:bg-danger-50 hover:text-danger-600 hover:ring-danger-200 group-hover:opacity-100"
                title="Remove this analysis"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <LazyMount placeholderHeight={400} fillParent>
                {renderBlockContent(block, onFollowUp, onDeepFollowUp)}
              </LazyMount>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-6 py-5">
          <ResponsiveGridLayout
            className="layout"
            layouts={layouts}
            breakpoints={{ lg: 0 }}
            cols={{ lg: 12 }}
            rowHeight={60}
            width={containerWidth}
            // Persist only on drag/resize STOP — not on every pixel during
            // motion. react-grid-layout still updates positions visually
            // via CSS transforms during the drag, so the UX is identical
            // but we avoid 30+ store updates per second when blocks move.
            onDragStop={handleLayoutChange}
            onResizeStop={handleLayoutChange}
            margin={[16, 16] as [number, number]}
            // `compactType={null}` = free placement: blocks stay exactly
            // where you drop them and nothing auto-shifts. With the
            // default 'vertical' compaction, shrinking chart A would
            // pull chart B up underneath at x=0 instead of letting you
            // place it next to A — which is the "can't put 2-3 charts
            // in a row" behaviour the user hit. `preventCollision={false}`
            // means resizing or dragging into a neighbor pushes that
            // neighbor out of the way rather than blocking the action.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            {...({
              compactType: null,
              preventCollision: false,
            } as any)}
          >
            {filteredBlocks.map((block) => (
              <div key={block.id}>
                <CanvasBlockComponent
                  block={block}
                  workspaceId={workspaceId}
                  isHighlighted={highlightedBlockId === block.id}
                  onRemove={() => removeBlock(workspaceId, block.id)}
                  onToggleFullWidth={() => handleToggleFullWidth(block.id)}
                >
                  <LazyMount placeholderHeight={Math.max(80, block.layout.h * 60 - 40)} fillParent>
                    {renderBlockContent(block, onFollowUp, onDeepFollowUp)}
                  </LazyMount>
                </CanvasBlockComponent>
              </div>
            ))}
          </ResponsiveGridLayout>
        </div>
      )}
    </div>
  );
}

/* ─── Inline-editable canvas title ─── */
function CanvasTitleEditor({
  title,
  onRename,
}: {
  title: string;
  onRename?: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);

  // Keep the draft in sync if the parent's title changes while we're not
  // editing (e.g. switching sessions).
  useEffect(() => {
    if (!editing) setDraft(title);
  }, [title, editing]);

  const commit = () => {
    const next = draft.trim();
    if (next && next !== title && onRename) onRename(next);
    setEditing(false);
  };

  // No rename callback wired → render plain text, no pencil affordance.
  if (!onRename) {
    return (
      <h2 className="truncate text-[15px] font-semibold text-navy-900">
        {title}
      </h2>
    );
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') {
            setDraft(title);
            setEditing(false);
          }
        }}
        onBlur={commit}
        className="min-w-0 flex-1 rounded-md border border-accent-300 bg-white px-2 py-0.5 text-[15px] font-semibold text-navy-900 outline-none ring-2 ring-accent-100 focus:border-accent-500"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="group/title flex min-w-0 items-center gap-1.5 truncate rounded px-1 py-0.5 text-left text-[15px] font-semibold text-navy-900 transition-colors hover:bg-navy-50"
      title="Click to rename"
    >
      <span className="truncate">{title}</span>
      <Pencil className="h-3 w-3 shrink-0 text-navy-300 opacity-0 transition-opacity group-hover/title:opacity-100" />
      <Check className="hidden" />
    </button>
  );
}
