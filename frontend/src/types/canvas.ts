import type { ChartRecommendation, TableData, InsightSummary, KeyFinding } from './chat';

export type CanvasBlockType = 'chart' | 'table' | 'kpi' | 'narrative' | 'deep_analysis';

export interface CanvasBlockLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BlockInsightMeta {
  narrative: string;
  keyFindings: KeyFinding[];
}

export interface ChartBlockData {
  chart: ChartRecommendation;
}

export interface TableBlockData {
  table: TableData;
}

export interface KpiBlockData {
  metrics: Array<{
    label: string;
    value: number | string;
    /** Optional secondary line (e.g. the count/metric behind the categorical answer) */
    secondary?: string;
  }>;
}

export interface NarrativeBlockData {
  summary: InsightSummary;
}

export interface DeepAnalysisSection {
  heading: string;
  content: string;
  /** Inline supporting charts pulled out of InsightResult.charts via the
      chart_indices from the LLM. */
  charts?: ChartRecommendation[];
  significance: 'high' | 'medium' | 'low';
  /** Short bullet pointers (2–4) shown beside the chart. */
  observations?: string[];
}

export interface DeepRecommendation {
  action: string;
  rationale?: string;
  /** Single-chart evidence for the action (often empty). */
  charts?: ChartRecommendation[];
  observations?: string[];
}

export type DeepProgressKind =
  | 'plan'
  | 'query'
  | 'query_result'
  | 'api'
  | 'api_result'
  | 'synthesis'
  | 'chart'
  | 'thinking'
  | 'info'
  | 'error';

export interface DeepProgressStep {
  id: string;
  kind: DeepProgressKind;
  label: string;
  detail?: string;
  status: 'active' | 'done' | 'error';
  startedAt: number;
  completedAt?: number;
  rowCount?: number;
  durationMs?: number;
  sql?: string;
}

export interface DeepAnalysisBlockData {
  title: string;
  executiveSummary: string;
  sections: DeepAnalysisSection[];
  recommendations: DeepRecommendation[];
  methodology: string;
  /** Lifecycle of the background Deep Analysis task. */
  status?: 'running' | 'ready' | 'failed';
  /** Short single-line "what I'm doing right now" shown prominently. */
  currentStep?: string;
  /** Ordered timeline of steps, rendered as a progress log. */
  progressSteps?: DeepProgressStep[];
  /** If status==='failed', human-readable error. */
  error?: string;
  /** Timestamps for elapsed-time display. */
  startedAt?: number;
  completedAt?: number;
}

export interface CanvasBlock {
  id: string;
  type: CanvasBlockType;
  title: string;
  sourceMessageId: string;
  sessionId?: string;                 // chat session that produced this block
  createdAt: number;
  layout: CanvasBlockLayout;
  data: ChartBlockData | TableBlockData | KpiBlockData | NarrativeBlockData | DeepAnalysisBlockData;
  insightMeta?: BlockInsightMeta;
  analysisMode?: 'quick' | 'deep';   // undefined treated as 'quick' for backward compat
  sourceQuery?: string;               // user's original question (for deep tab label)
  /** For deep blocks: the root assistant message ID of the thread.
      Follow-ups inside the same deep tab share this ID. */
  deepThreadId?: string;
}

/** Tab identifier: 'quick' for the Quick Insights tab, or a sourceMessageId for a deep tab */
export type CanvasTabId = 'quick' | string;
