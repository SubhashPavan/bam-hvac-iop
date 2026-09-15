/**
 * Analytics API client. Five endpoints, all admin-or-manager gated.
 *
 *   getOverview()        — KPI strip (counters, mode mix, cost, tokens)
 *   getTimeseries()      — daily series for the area / line chart
 *   getBreakdowns()      — top-N tables (by user / workspace / event_type / model)
 *   getUserDetail(id)    — per-day series + recent events for a single user
 *   getWorkspaceDetail() — per-day series + member rollup for a single workspace
 *
 * The backend scopes results automatically: admin sees everything,
 * manager sees only their workspaces. Pass `workspaceId` to scope down
 * further.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export type AnalyticsPeriod = '7d' | '30d' | '90d' | 'all';

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  try {
    const stored = localStorage.getItem('insightsmart-auth');
    if (stored) {
      const token = JSON.parse(stored)?.state?.token;
      if (token) headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    /* ignore */
  }
  return headers;
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.detail) detail = String(body.detail);
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

// ── Types ────────────────────────────────────────────────────────────

export interface AnalyticsOverview {
  period: AnalyticsPeriod;
  scope: 'platform' | 'workspace' | 'manager';
  workspace_filter: string | null;
  events: { total: number; success: number; failed: number };
  questions: { quick: number; deep: number; total: number };
  tokens: { input: number; output: number; total: number };
  cost_usd: number;
  avg_cost_per_event: number;
  avg_duration_ms: number;
  active_users: number;
  models_used: string[];
  breakdown_by_event_type: Array<{
    event_type: string;
    count: number;
    cost_usd: number;
    tokens: number;
  }>;
}

export interface TimeseriesPoint {
  date: string;
  events: number;
  quick_questions: number;
  deep_questions: number;
  tokens: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  active_users: number;
}

export interface AnalyticsTimeseries {
  period: AnalyticsPeriod;
  workspace_filter: string | null;
  series: TimeseriesPoint[];
}

export interface BreakdownByUser {
  user_id: string;
  user_email: string;
  user_name: string;
  events: number;
  tokens: number;
  cost_usd: number;
}
export interface BreakdownByWorkspace {
  workspace_id: string;
  workspace_name: string;
  events: number;
  tokens: number;
  cost_usd: number;
}
export interface BreakdownByEvent {
  event_type: string;
  events: number;
  tokens: number;
  cost_usd: number;
}
export interface BreakdownByModel {
  model: string;
  events: number;
  tokens: number;
  cost_usd: number;
}

export interface AnalyticsBreakdowns {
  period: AnalyticsPeriod;
  workspace_filter: string | null;
  by_user: BreakdownByUser[];
  by_workspace: BreakdownByWorkspace[];
  by_event_type: BreakdownByEvent[];
  by_model: BreakdownByModel[];
}

export interface UserUsageDetail {
  period: AnalyticsPeriod;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    status: string;
    total_questions: number;
    total_tokens: number;
    total_cost_usd: number;
    today_questions: number;
    today_tokens: number;
    today_cost_usd: number;
    month_cost_usd: number;
    max_questions_per_day: number;
    max_tokens_per_day: number;
    max_cost_usd_per_month: number;
    expiry_date: string;
  };
  series: Array<{ date: string; events: number; tokens: number; cost_usd: number }>;
  recent_events: Array<{
    id: string;
    timestamp: string;
    event_type: string;
    model: string;
    tokens: number;
    cost_usd: number;
    duration_ms: number;
    success: boolean;
    error_class: string;
    workspace_id: string;
    query_text: string;
  }>;
  totals: { events: number; tokens: number; cost_usd: number };
}

export interface WorkspaceUsageDetail {
  period: AnalyticsPeriod;
  workspace: {
    id: string;
    name: string;
    description: string;
    owner_id: string;
    member_count: number;
  };
  series: Array<{
    date: string;
    events: number;
    tokens: number;
    cost_usd: number;
    active_users: number;
  }>;
  members: Array<{
    user_email: string;
    user_name: string;
    user_role: string;
    events: number;
    tokens: number;
    cost_usd: number;
  }>;
  totals: { events: number; tokens: number; cost_usd: number; active_users: number };
}

// ── Calls ──────────────────────────────────────────────────────────

function withQuery(path: string, params: Record<string, string | number>): string {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return qs ? `${path}?${qs}` : path;
}

export async function getOverview(
  period: AnalyticsPeriod = '30d',
  workspaceId = '',
): Promise<AnalyticsOverview> {
  const url = withQuery(`${API_BASE}/api/analytics/overview`, { period, workspace_id: workspaceId });
  const res = await fetch(url, { headers: authHeaders() });
  return jsonOrThrow<AnalyticsOverview>(res);
}

export async function getTimeseries(
  period: AnalyticsPeriod = '30d',
  workspaceId = '',
): Promise<AnalyticsTimeseries> {
  const url = withQuery(`${API_BASE}/api/analytics/timeseries`, { period, workspace_id: workspaceId });
  const res = await fetch(url, { headers: authHeaders() });
  return jsonOrThrow<AnalyticsTimeseries>(res);
}

export async function getBreakdowns(
  period: AnalyticsPeriod = '30d',
  workspaceId = '',
  limit = 10,
): Promise<AnalyticsBreakdowns> {
  const url = withQuery(`${API_BASE}/api/analytics/breakdowns`, {
    period,
    workspace_id: workspaceId,
    limit,
  });
  const res = await fetch(url, { headers: authHeaders() });
  return jsonOrThrow<AnalyticsBreakdowns>(res);
}

export async function getUserDetail(
  userId: string,
  period: AnalyticsPeriod = '30d',
): Promise<UserUsageDetail> {
  const url = withQuery(`${API_BASE}/api/analytics/users/${userId}`, { period });
  const res = await fetch(url, { headers: authHeaders() });
  return jsonOrThrow<UserUsageDetail>(res);
}

export async function getWorkspaceDetail(
  workspaceId: string,
  period: AnalyticsPeriod = '30d',
): Promise<WorkspaceUsageDetail> {
  const url = withQuery(`${API_BASE}/api/analytics/workspaces/${workspaceId}`, { period });
  const res = await fetch(url, { headers: authHeaders() });
  return jsonOrThrow<WorkspaceUsageDetail>(res);
}
