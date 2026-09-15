export type MessageRole = 'user' | 'assistant';

export interface AgentStep {
  type: 'thinking' | 'plan' | 'sub_query_start' | 'sub_query_result' | 'api_call_start' | 'api_call_result' | 'consolidating' | 'chart_selected' | 'clarification' | 'error';
  content: string;
  sql?: string;
  data?: Record<string, unknown>;
  timestamp: number;
  completed: boolean;
}

export interface KeyFinding {
  headline: string;
  detail: string;
  significance: 'high' | 'medium' | 'low';
}

export interface InsightSummary {
  title: string;
  narrative: string;
  key_findings: KeyFinding[];
  follow_up_questions: string[];
}

export type ChartType =
  | 'bar' | 'grouped_bar' | 'line' | 'multi_line' | 'pie' | 'scatter'
  | 'stacked_bar' | 'area' | 'kpi' | 'table'
  | 'horizontal_bar' | 'treemap' | 'funnel' | 'radar' | 'radial_bar'
  | 'heatmap' | 'waterfall' | 'gauge';

export interface ChartRecommendation {
  chart_type: ChartType;
  title: string;
  x_axis: string | null;
  y_axis: string | string[] | null;
  color_by: string | null;
  data: Record<string, unknown>[];
  reasoning: string;
  config?: Record<string, unknown>;
  /** Series keys (y-axis column names) the user has hidden via the
   *  block's series-toggle control. Persisted alongside the chart so
   *  the override survives refresh and persona switches. */
  hidden_series?: string[];
}

export interface TableData {
  title: string;
  columns: string[];
  data: Record<string, unknown>[];
}

export interface ExecutionMetadata {
  total_duration_ms: number;
  sub_query_count: number;
  total_rows: number;
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  model_name?: string;
  estimated_cost_usd?: number;
  cached?: boolean;
}

export interface DeepAnalysisSectionPayload {
  heading: string;
  content: string;
  significance: 'high' | 'medium' | 'low';
  /** Indices into the top-level InsightResult.charts list. */
  chart_indices: number[];
  observations: string[];
}

export interface DeepRecommendationPayload {
  action: string;
  rationale: string;
  chart_indices: number[];
  observations: string[];
}

export interface DeepAnalysisPayload {
  title: string;
  executive_summary: string;
  sections: DeepAnalysisSectionPayload[];
  recommendations: DeepRecommendationPayload[];
  methodology: string;
}

export interface InsightResult {
  summary: InsightSummary;
  charts: ChartRecommendation[];
  tables: TableData[];
  execution_metadata: ExecutionMetadata;
  /** Populated only in Deep Analysis mode — rich structured output. */
  deep_analysis?: DeepAnalysisPayload | null;
}

/** Marker fields added to ChatMessage so deep messages can be hidden from
    the main chat panel and rendered only inside their deep tab. */

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  steps: AgentStep[];
  insightResult?: InsightResult;
  isStreaming?: boolean;
  analysisMode?: 'quick' | 'deep';
  feedback?: 'positive' | 'negative' | null;
  /** Root assistant-message-id of the deep thread this message belongs
      to. Set on deep user-questions and deep assistant-responses (and on
      follow-ups inside the same deep tab). When present, the message is
      hidden from the main chat panel and rendered only on the deep tab. */
  deepThreadId?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  workspaceId?: string;
}
