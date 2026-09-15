import type { ChartRecommendation } from './chat';

export type DashboardBlockType = 'kpi' | 'chart' | 'table' | 'narrative';

export type DashboardStatus =
  | 'draft'
  | 'building'
  | 'ready'
  | 'failed'
  | 'published';

export interface BlockLayout {
  x: number;  // 0..11 col
  y: number;  // grid rows (~60px each)
  w: number;  // 1..12
  h: number;  // 1..24
}

export interface DashboardBlock {
  id: string;
  type: DashboardBlockType;
  title: string;
  sql: string;
  connection_id: string;
  intent: string;
  span: number;                          // 1..12 (legacy, kept for back-compat)
  /** Drag-and-resize position. Backfilled by the backend on read for
   *  dashboards that pre-date this field, so this is always present
   *  on the wire. */
  layout?: BlockLayout | null;
  chart_type?: string | null;
  value_format?: 'currency' | 'percent' | 'number' | 'decimal' | string | null;
  last_data: Record<string, unknown>[];
  last_columns: string[];
  last_row_count: number;
  last_chart?: ChartRecommendation | null;
  last_error?: string | null;
  last_refreshed_at?: string | null;
  last_duration_ms?: number | null;
}

export interface DashboardRow {
  id: string;
  label: string;
  blocks: DashboardBlock[];
}

export interface DashboardTab {
  id: string;
  title: string;
  description: string;
  rows: DashboardRow[];
}

export interface RefreshSchedule {
  enabled: boolean;
  interval_minutes: number;
  last_run_at?: string | null;
  next_run_at?: string | null;
  last_run_duration_ms?: number | null;
  last_run_status?: 'ok' | 'partial' | 'failed' | null;
}

export interface Dashboard {
  id: string;
  workspace_id: string;
  connection_id: string;
  owner_id: string;
  owner_name: string;
  title: string;
  persona: string;
  objective: string;
  scope_notes: string;
  tabs: DashboardTab[];
  status: DashboardStatus;
  created_at: string;
  updated_at: string;
  published_at?: string | null;
  published_by?: string | null;
  refresh: RefreshSchedule;
  last_build_error?: string | null;
  last_build_duration_ms?: number | null;
  plan_model: string;
  layout_version?: number;
}

export interface DashboardSummary {
  id: string;
  workspace_id: string;
  title: string;
  persona: string;
  objective: string;
  status: DashboardStatus;
  owner_id: string;
  owner_name: string;
  created_at: string;
  updated_at: string;
  published_at?: string | null;
  last_refreshed_at?: string | null;
  tab_count: number;
  block_count: number;
}

export interface ClarificationAnswer {
  id: string;
  question: string;
  answer: string;
}

export interface DashboardCreateRequest {
  persona: string;
  objective: string;
  scope_notes?: string;
  title?: string;
  connection_id?: string;
  refresh_interval_minutes?: number;
  clarifications?: ClarificationAnswer[];
}

export interface RefineBriefQuestion {
  id: string;
  question: string;
  why_we_ask?: string;
  suggested_answer?: string;
}

export interface RefineBriefResult {
  understanding: string;
  questions: RefineBriefQuestion[];
}
