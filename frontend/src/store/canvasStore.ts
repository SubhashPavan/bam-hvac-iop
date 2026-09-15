import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  CanvasBlock,
  CanvasBlockLayout,
  BlockInsightMeta,
  CanvasTabId,
  DeepAnalysisBlockData,
  DeepProgressStep,
} from '../types/canvas';
import type { InsightResult } from '../types/chat';
import { fetchCanvasState, saveCanvasState } from '../services/api';

const EMPTY_BLOCKS: CanvasBlock[] = [];

function generateId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
}

// ── Debounce helper ─────────────────────────────────────────────────
const _canvasTimers: Record<string, ReturnType<typeof setTimeout>> = {};

function debouncedSaveCanvas(workspaceId: string) {
  if (_canvasTimers[workspaceId]) clearTimeout(_canvasTimers[workspaceId]);
  _canvasTimers[workspaceId] = setTimeout(() => {
    const state = useCanvasStore.getState();
    const blocks = state.blocks[workspaceId] || [];
    saveCanvasState(workspaceId, blocks as unknown as Record<string, unknown>[]).catch(() => {});
    delete _canvasTimers[workspaceId];
  }, 2000);
}

interface CanvasState {
  blocks: Record<string, CanvasBlock[]>;
  highlightedBlockId: string | null;
  activeTab: Record<string, CanvasTabId>;
  _canvasLoaded: Record<string, boolean>;

  addBlocksFromInsight: (workspaceId: string, insight: InsightResult, messageId: string, opts?: { skipNarrative?: boolean; analysisMode?: 'quick' | 'deep'; sourceQuery?: string; sessionId?: string }) => void;
  removeBlock: (workspaceId: string, blockId: string) => void;
  updateBlockLayout: (workspaceId: string, blockId: string, layout: CanvasBlockLayout) => void;
  updateAllLayouts: (workspaceId: string, layouts: Array<{ i: string } & CanvasBlockLayout>) => void;
  /** Replace the data payload of a single block (e.g. after a chart-type
   *  conversion or hiding a series). Triggers the debounced backend save
   *  so user edits survive refresh. */
  updateBlockData: (workspaceId: string, blockId: string, data: CanvasBlock['data']) => void;
  highlightBlock: (blockId: string | null) => void;
  clearCanvas: (workspaceId: string) => void;
  replaceBlocksByMessageId: (workspaceId: string, oldMessageId: string, newBlocks: CanvasBlock[]) => void;
  getBlocks: (workspaceId: string) => CanvasBlock[];
  setActiveTab: (workspaceId: string, tabId: CanvasTabId) => void;
  removeDeepTab: (workspaceId: string, sourceMessageId: string) => void;

  // ── Deep Analysis live task management ──
  /** Create an empty placeholder deep_analysis block when a deep query starts.
      `deepThreadId` is optional; defaults to messageId when starting a new
      thread. Pass an existing thread id to attach a follow-up. */
  startDeepTask: (workspaceId: string, messageId: string, sourceQuery: string, sessionId?: string, deepThreadId?: string) => void;
  /** Set the single-line "what I'm doing now" label on a running deep task. */
  setDeepTaskCurrentStep: (workspaceId: string, messageId: string, label: string) => void;
  /** Append a timeline step to a running deep task. */
  appendDeepTaskStep: (workspaceId: string, messageId: string, step: DeepProgressStep) => void;
  /** Update an existing timeline step (e.g. mark a query as done). */
  updateDeepTaskStep: (workspaceId: string, messageId: string, stepId: string, update: Partial<DeepProgressStep>) => void;
  /** Mark a deep task failed with an error message. */
  failDeepTask: (workspaceId: string, messageId: string, error: string) => void;

  // Persistence sync
  loadCanvasFromBackend: (workspaceId: string) => Promise<void>;
}

export const useCanvasStore = create<CanvasState>()(
  persist(
    (set, get) => ({
      blocks: {},
      highlightedBlockId: null,
      activeTab: {},
      _canvasLoaded: {},

      addBlocksFromInsight: (workspaceId: string, insight: InsightResult, messageId: string, opts?: { skipNarrative?: boolean; analysisMode?: 'quick' | 'deep'; sourceQuery?: string; sessionId?: string }) => {
        const existingBlocks = get().blocks[workspaceId] || [];

        const relevantBlocks = opts?.analysisMode === 'deep'
          ? existingBlocks.filter((b) => b.sourceMessageId === messageId)
          : existingBlocks.filter((b) => b.analysisMode !== 'deep');
        const maxY = relevantBlocks.reduce((max, b) => Math.max(max, b.layout.y + b.layout.h), 0);

        const newBlocks: CanvasBlock[] = [];
        let currentY = maxY;

        const meta: BlockInsightMeta | undefined = insight.summary
          ? { narrative: insight.summary.narrative, keyFindings: insight.summary.key_findings }
          : undefined;

        const modeFields = {
          analysisMode: opts?.analysisMode,
          sourceQuery: opts?.sourceQuery,
          sessionId: opts?.sessionId,
        };

        // ── Deep Analysis block (deep mode only) ──
        // When the backend returned a structured DeepAnalysis, finalize
        // the running placeholder block (created by startDeepTask) in
        // place, or create a fresh one if no placeholder exists.
        const deep = insight.deep_analysis;
        const hasDeep = opts?.analysisMode === 'deep' && deep && deep.sections && deep.sections.length > 0;

        if (hasDeep && deep) {
          const placeholderIdx = existingBlocks.findIndex(
            (b) => b.type === 'deep_analysis' && b.sourceMessageId === messageId
          );
          // Resolve chart_indices into actual ChartRecommendation objects so
          // the deep block can render charts inline beneath each section.
          const allCharts = insight.charts || [];
          const pickCharts = (idxs: number[] | undefined) =>
            (idxs || [])
              .filter((i) => Number.isInteger(i) && i >= 0 && i < allCharts.length)
              .map((i) => allCharts[i]);

          const finalDeepData: DeepAnalysisBlockData = {
            title: deep.title,
            executiveSummary: deep.executive_summary,
            sections: deep.sections.map((s) => ({
              heading: s.heading,
              content: s.content,
              significance: s.significance,
              charts: pickCharts(s.chart_indices),
              observations: s.observations || [],
            })),
            recommendations: (deep.recommendations || []).map((r) => ({
              action: r.action,
              rationale: r.rationale || '',
              charts: pickCharts(r.chart_indices),
              observations: r.observations || [],
            })),
            methodology: deep.methodology || '',
            status: 'ready',
            completedAt: Date.now(),
            // Preserve progress timeline if placeholder existed
            progressSteps:
              placeholderIdx >= 0
                ? (existingBlocks[placeholderIdx].data as DeepAnalysisBlockData).progressSteps || []
                : [],
            startedAt:
              placeholderIdx >= 0
                ? (existingBlocks[placeholderIdx].data as DeepAnalysisBlockData).startedAt
                : Date.now(),
          };

          if (placeholderIdx >= 0) {
            // Patch the placeholder in-place (preserves its layout + id)
            const placeholder = existingBlocks[placeholderIdx];
            existingBlocks[placeholderIdx] = {
              ...placeholder,
              title: deep.title || placeholder.title,
              data: finalDeepData,
              insightMeta: meta,
            };
          } else {
            newBlocks.push({
              id: generateId(),
              type: 'deep_analysis',
              title: deep.title || insight.summary?.title || 'Deep Analysis',
              sourceMessageId: messageId,
              createdAt: Date.now(),
              layout: { x: 0, y: currentY, w: 12, h: 14 },
              data: finalDeepData,
              insightMeta: meta,
              ...modeFields,
            });
            currentY += 14;
          }
        } else if (insight.summary && !opts?.skipNarrative) {
          newBlocks.push({
            id: generateId(),
            type: 'narrative',
            title: insight.summary.title,
            sourceMessageId: messageId,
            createdAt: Date.now(),
            layout: { x: 0, y: currentY, w: 12, h: 4 },
            data: { summary: insight.summary },
            insightMeta: meta,
            ...modeFields,
          });
          currentY += 4;
        }

        // For Deep Analysis, charts (KPIs, regular charts, tables) are
        // rendered INLINE inside the DeepAnalysisBlock — skip creating
        // standalone canvas blocks for them so the deep tab is one
        // cohesive scrollable artifact, not a chart soup.
        if (insight.charts && !hasDeep) {
          // Separate KPIs from real charts
          const kpiCharts = insight.charts.filter((c) => c.chart_type === 'kpi');
          const realCharts = insight.charts.filter((c) => c.chart_type !== 'kpi' && c.chart_type !== 'table');

          // KPIs first — compact tiles, multiple per row when possible
          let kpiColX = 0;
          let kpiRowHeight = 0;
          // Treat a value as numeric if it's a real number OR a numeric string
          // (Postgres NUMERIC columns arrive as strings like "218757205").
          const asNumber = (v: unknown): number | null => {
            if (typeof v === 'number' && Number.isFinite(v)) return v;
            if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) {
              return Number(v);
            }
            return null;
          };
          const isNumericVal = (v: unknown): boolean => asNumber(v) !== null;

          kpiCharts.forEach((chart) => {
            const keys = chart.data.length > 0 ? Object.keys(chart.data[0]) : [];
            // String keys = non-numeric strings (categorical labels)
            const stringKey = keys.find(
              (k) => typeof chart.data[0][k] === 'string' && !isNumericVal(chart.data[0][k])
            );

            // Pick the numeric field that best matches the chart title so a
            // "highest revenue" KPI shows revenue, not a secondary count.
            // Include numeric strings (Postgres NUMERIC → string).
            const numericKeys = keys.filter((k) => isNumericVal(chart.data[0][k]));
            const titleLower = (chart.title || '').toLowerCase();
            const reasoningLower = (chart.reasoning || '').toLowerCase();
            const titleTokens = (titleLower + ' ' + reasoningLower)
              .split(/[^a-z]+/)
              .filter((t) => t.length >= 4);
            const scoreKey = (k: string) => {
              const norm = k.toLowerCase().replace(/[_-]/g, ' ');
              const kTokens = norm.split(/\s+/).filter(Boolean);
              let score = 0;
              for (const kt of kTokens) {
                for (const tt of titleTokens) {
                  if (kt === tt) score += 3;
                  else if (kt.includes(tt) || tt.includes(kt)) score += 1;
                }
              }
              // Mild bias away from ID/count-like defaults when a better match exists
              if (/\b(id|count|num|cnt)\b/.test(norm)) score -= 0.5;
              return score;
            };
            let numberKey: string | undefined = numericKeys[0];
            if (numericKeys.length > 1) {
              const ranked = [...numericKeys].sort((a, b) => scoreKey(b) - scoreKey(a));
              if (scoreKey(ranked[0]) > 0) numberKey = ranked[0];
            }
            const metricCount = chart.data.length;

            // Multi-metric → wider/taller. Single-metric → compact 4-col tile.
            const kpiW = metricCount > 1 ? 6 : 4;
            const kpiH = metricCount > 1 ? 3 : 2;
            // Wrap to next row if it wouldn't fit
            if (kpiColX + kpiW > 12) {
              currentY += kpiRowHeight;
              kpiColX = 0;
              kpiRowHeight = 0;
            }

            // Build metrics with meaningful label/value pairing.
            // For "find the top X with highest Y" queries, the answer is the
            // categorical string (column value) and the chart.title describes
            // the question — show the string prominently, number as secondary.
            const fmtNum = (n: number): string => {
              if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
              if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
              if (Number.isInteger(n)) return n.toLocaleString();
              return n.toFixed(2);
            };
            const humanizeKey = (k: string): string =>
              k.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

            const metrics = chart.data.map((item) => {
              const strVal = stringKey ? item[stringKey] : null;
              // Coerce numeric strings ("218757205") to real numbers
              const numVal = numberKey ? asNumber(item[numberKey]) : null;
              // If both string + number present → string is the answer, number is context
              if (strVal != null && numVal != null) {
                return {
                  label: chart.title || (stringKey ? humanizeKey(stringKey) : ''),
                  value: String(strVal),
                  secondary: numberKey
                    ? `${fmtNum(numVal)} ${humanizeKey(numberKey).toLowerCase()}`
                    : fmtNum(numVal),
                };
              }
              // Only number → number is the main value, key becomes the label
              if (numVal != null) {
                return {
                  label: chart.title || (numberKey ? humanizeKey(numberKey) : 'Value'),
                  value: numVal,
                };
              }
              // Only string → string is the main value
              return {
                label: chart.title || (stringKey ? humanizeKey(stringKey) : 'Value'),
                value: String(strVal ?? ''),
              };
            });

            newBlocks.push({
              id: generateId(),
              type: 'kpi',
              title: chart.title,
              sourceMessageId: messageId,
              createdAt: Date.now(),
              layout: { x: kpiColX, y: currentY, w: kpiW, h: kpiH },
              data: { metrics },
              insightMeta: meta,
              ...modeFields,
            });
            kpiColX += kpiW;
            kpiRowHeight = Math.max(kpiRowHeight, kpiH);
          });
          // After placing all KPIs, advance Y past the current row
          if (kpiCharts.length > 0) currentY += kpiRowHeight;

          // Smart chart layout based on count:
          // 1 chart  → full width  (w=12, h=6)
          // 2 charts → side by side (w=6, h=5)
          // 3 charts → 3 per row   (w=4, h=5)
          // 4 charts → 2x2 grid    (w=6, h=5)
          // 5+ charts → 3 per row  (w=4, h=5)
          const chartCount = realCharts.length;
          let colsPerRow: number;
          let chartW: number;
          let chartH: number;

          if (chartCount === 1) {
            colsPerRow = 1; chartW = 12; chartH = 6;
          } else if (chartCount === 2 || chartCount === 4) {
            colsPerRow = 2; chartW = 6; chartH = 5;
          } else {
            colsPerRow = 3; chartW = 4; chartH = 5;
          }

          let chartCol = 0;
          realCharts.forEach((chart) => {
            newBlocks.push({
              id: generateId(),
              type: 'chart',
              title: chart.title,
              sourceMessageId: messageId,
              createdAt: Date.now(),
              layout: { x: (chartCol % colsPerRow) * chartW, y: currentY, w: chartW, h: chartH },
              data: { chart },
              insightMeta: meta,
              ...modeFields,
            });
            chartCol++;
            if (chartCol % colsPerRow === 0) { currentY += chartH; }
          });
          // Flush any remaining partial chart row
          if (chartCol % colsPerRow !== 0) { currentY += chartH; }
        }

        if (insight.tables && !hasDeep) {
          insight.tables.forEach((table) => {
            newBlocks.push({
              id: generateId(),
              type: 'table',
              title: table.title,
              sourceMessageId: messageId,
              createdAt: Date.now(),
              layout: { x: 0, y: currentY, w: 12, h: 5 },
              data: { table },
              insightMeta: meta,
              ...modeFields,
            });
            currentY += 5;
          });
        }

        set((state) => ({
          blocks: {
            ...state.blocks,
            [workspaceId]: [...existingBlocks, ...newBlocks],
          },
          ...(opts?.analysisMode === 'deep' ? {
            activeTab: { ...state.activeTab, [workspaceId]: messageId },
          } : {}),
        }));

        // Debounced save to backend
        if (!workspaceId.startsWith('__refresh_')) {
          debouncedSaveCanvas(workspaceId);
        }
      },

      removeBlock: (workspaceId: string, blockId: string) => {
        set((state) => ({
          blocks: {
            ...state.blocks,
            [workspaceId]: (state.blocks[workspaceId] || []).filter((b) => b.id !== blockId),
          },
        }));
        debouncedSaveCanvas(workspaceId);
      },

      updateBlockLayout: (workspaceId: string, blockId: string, layout: CanvasBlockLayout) => {
        set((state) => ({
          blocks: {
            ...state.blocks,
            [workspaceId]: (state.blocks[workspaceId] || []).map((b) =>
              b.id === blockId ? { ...b, layout } : b
            ),
          },
        }));
        debouncedSaveCanvas(workspaceId);
      },

      updateAllLayouts: (workspaceId: string, layouts: Array<{ i: string } & CanvasBlockLayout>) => {
        set((state) => ({
          blocks: {
            ...state.blocks,
            [workspaceId]: (state.blocks[workspaceId] || []).map((block) => {
              const newLayout = layouts.find((l) => l.i === block.id);
              if (newLayout) {
                return { ...block, layout: { x: newLayout.x, y: newLayout.y, w: newLayout.w, h: newLayout.h } };
              }
              return block;
            }),
          },
        }));
        debouncedSaveCanvas(workspaceId);
      },

      updateBlockData: (workspaceId: string, blockId: string, data: CanvasBlock['data']) => {
        set((state) => ({
          blocks: {
            ...state.blocks,
            [workspaceId]: (state.blocks[workspaceId] || []).map((b) =>
              b.id === blockId ? ({ ...b, data } as CanvasBlock) : b
            ),
          },
        }));
        debouncedSaveCanvas(workspaceId);
      },

      highlightBlock: (blockId: string | null) => {
        set({ highlightedBlockId: blockId });
        if (blockId) {
          setTimeout(() => set({ highlightedBlockId: null }), 2000);
        }
      },

      clearCanvas: (workspaceId: string) => {
        set((state) => ({
          blocks: {
            ...state.blocks,
            [workspaceId]: [],
          },
          activeTab: { ...state.activeTab, [workspaceId]: 'quick' },
        }));
        debouncedSaveCanvas(workspaceId);
      },

      replaceBlocksByMessageId: (workspaceId: string, oldMessageId: string, newBlocks: CanvasBlock[]) => {
        set((state) => {
          const existing = state.blocks[workspaceId] || [];
          const firstOldIndex = existing.findIndex((b) => b.sourceMessageId === oldMessageId);
          const filtered = existing.filter((b) => b.sourceMessageId !== oldMessageId);
          const insertAt = firstOldIndex >= 0 ? Math.min(firstOldIndex, filtered.length) : filtered.length;
          return {
            blocks: {
              ...state.blocks,
              [workspaceId]: [
                ...filtered.slice(0, insertAt),
                ...newBlocks,
                ...filtered.slice(insertAt),
              ],
            },
          };
        });
        debouncedSaveCanvas(workspaceId);
      },

      getBlocks: (workspaceId: string) => {
        return get().blocks[workspaceId] || EMPTY_BLOCKS;
      },

      setActiveTab: (workspaceId: string, tabId: CanvasTabId) => {
        set((state) => ({
          activeTab: { ...state.activeTab, [workspaceId]: tabId },
        }));
      },

      removeDeepTab: (workspaceId: string, sourceMessageId: string) => {
        set((state) => {
          const filtered = (state.blocks[workspaceId] || []).filter(
            (b) => b.sourceMessageId !== sourceMessageId
          );
          const currentTab = state.activeTab[workspaceId];
          return {
            blocks: { ...state.blocks, [workspaceId]: filtered },
            activeTab: {
              ...state.activeTab,
              [workspaceId]: currentTab === sourceMessageId ? 'quick' : currentTab,
            },
          };
        });
        debouncedSaveCanvas(workspaceId);
      },

      // ── Deep Analysis live task lifecycle ──
      startDeepTask: (workspaceId, messageId, sourceQuery, sessionId, deepThreadId) => {
        const threadId = deepThreadId || messageId;
        set((state) => {
          const existing = state.blocks[workspaceId] || [];
          // For follow-ups, place beneath the existing blocks in the same
          // thread. For root queries, place at the bottom of the canvas.
          const sameThread = existing.filter((b) => b.deepThreadId === threadId);
          const baseBlocks = sameThread.length > 0 ? sameThread : existing;
          const maxY = baseBlocks.reduce(
            (m, b) => Math.max(m, b.layout.y + b.layout.h),
            0
          );
          const placeholder: CanvasBlock = {
            id: generateId(),
            type: 'deep_analysis',
            title: sourceQuery.length > 60 ? sourceQuery.slice(0, 57) + '…' : sourceQuery,
            sourceMessageId: messageId,
            createdAt: Date.now(),
            layout: { x: 0, y: maxY, w: 12, h: 14 },
            data: {
              title: sourceQuery,
              executiveSummary: '',
              sections: [],
              recommendations: [],
              methodology: '',
              status: 'running',
              currentStep: 'Kicking off deep analysis…',
              progressSteps: [],
              startedAt: Date.now(),
            } as DeepAnalysisBlockData,
            analysisMode: 'deep',
            sourceQuery,
            sessionId,
            deepThreadId: threadId,
          };
          return {
            blocks: { ...state.blocks, [workspaceId]: [...existing, placeholder] },
            // Switch canvas to this deep tab (root or thread)
            activeTab: { ...state.activeTab, [workspaceId]: threadId },
          };
        });
        debouncedSaveCanvas(workspaceId);
      },

      setDeepTaskCurrentStep: (workspaceId, messageId, label) => {
        set((state) => {
          const blocks = state.blocks[workspaceId] || [];
          const updated = blocks.map((b) => {
            if (b.type !== 'deep_analysis' || b.sourceMessageId !== messageId) return b;
            const d = b.data as DeepAnalysisBlockData;
            if (d.status === 'ready' || d.status === 'failed') return b;
            return { ...b, data: { ...d, currentStep: label } };
          });
          return { blocks: { ...state.blocks, [workspaceId]: updated } };
        });
      },

      appendDeepTaskStep: (workspaceId, messageId, step) => {
        set((state) => {
          const blocks = state.blocks[workspaceId] || [];
          const updated = blocks.map((b) => {
            if (b.type !== 'deep_analysis' || b.sourceMessageId !== messageId) return b;
            const d = b.data as DeepAnalysisBlockData;
            if (d.status === 'ready' || d.status === 'failed') return b;
            const steps = [...(d.progressSteps || []), step];
            return { ...b, data: { ...d, progressSteps: steps, currentStep: step.label } };
          });
          return { blocks: { ...state.blocks, [workspaceId]: updated } };
        });
      },

      updateDeepTaskStep: (workspaceId, messageId, stepId, update) => {
        set((state) => {
          const blocks = state.blocks[workspaceId] || [];
          const updated = blocks.map((b) => {
            if (b.type !== 'deep_analysis' || b.sourceMessageId !== messageId) return b;
            const d = b.data as DeepAnalysisBlockData;
            const steps = (d.progressSteps || []).map((s) =>
              s.id === stepId ? { ...s, ...update } : s
            );
            return { ...b, data: { ...d, progressSteps: steps } };
          });
          return { blocks: { ...state.blocks, [workspaceId]: updated } };
        });
      },

      failDeepTask: (workspaceId, messageId, error) => {
        set((state) => {
          const blocks = state.blocks[workspaceId] || [];
          const updated = blocks.map((b) => {
            if (b.type !== 'deep_analysis' || b.sourceMessageId !== messageId) return b;
            const d = b.data as DeepAnalysisBlockData;
            return {
              ...b,
              data: {
                ...d,
                status: 'failed' as const,
                error,
                completedAt: Date.now(),
                currentStep: 'Analysis failed',
              },
            };
          });
          return { blocks: { ...state.blocks, [workspaceId]: updated } };
        });
        debouncedSaveCanvas(workspaceId);
      },

      // ── Persistence sync ──────────────────────────────────────────

      loadCanvasFromBackend: async (workspaceId: string) => {
        if (get()._canvasLoaded[workspaceId]) return;

        try {
          const data = await fetchCanvasState(workspaceId);
          // Backend is the source of truth — always replace the local
          // cache with what the server returns (which is filtered to
          // the current user). Previously this only replaced when the
          // local cache was empty, which let stale data from a prior
          // user / persona stay visible after a switch.
          const backendBlocks = (data.blocks as unknown as CanvasBlock[]) || [];
          set((state) => ({
            blocks: { ...state.blocks, [workspaceId]: backendBlocks },
            _canvasLoaded: { ...state._canvasLoaded, [workspaceId]: true },
          }));
        } catch {
          // On error, mark as loaded but leave whatever was in state.
          // (If the user has no access, the backend returns empty blocks,
          // not an error — so this branch rarely fires.)
          set((state) => ({
            _canvasLoaded: { ...state._canvasLoaded, [workspaceId]: true },
          }));
        }
      },
    }),
    {
      name: 'insightsmart-canvas',
      // Persist nothing — canvas blocks live on the backend, scoped to
      // (workspace_id, user_id) server-side. localStorage caching was
      // the source of cross-user data leaks. The backend is the single
      // source of truth; we re-fetch on every page load via
      // useWorkspaceSync.loadCanvasFromBackend.
      version: 3,
      partialize: () => ({}),
    }
  )
);
