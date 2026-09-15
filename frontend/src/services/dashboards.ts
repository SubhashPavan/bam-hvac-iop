/**
 * Dashboard API client. All calls require an auth token (read from
 * the same `insightsmart-auth` localStorage key the rest of the app uses).
 */
import type {
  Dashboard,
  DashboardCreateRequest,
  DashboardSummary,
  RefineBriefResult,
  RefreshSchedule,
} from '../types/dashboard';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
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

export async function listDashboards(workspaceId: string): Promise<DashboardSummary[]> {
  const res = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/dashboards`, {
    headers: authHeaders(),
  });
  return jsonOrThrow<DashboardSummary[]>(res);
}

export async function getDashboard(
  dashboardId: string,
  workspaceId: string,
): Promise<Dashboard> {
  const url = `${API_BASE}/api/dashboards/${dashboardId}?workspace_id=${encodeURIComponent(workspaceId)}`;
  const res = await fetch(url, { headers: authHeaders() });
  return jsonOrThrow<Dashboard>(res);
}

export async function createDashboard(
  workspaceId: string,
  body: DashboardCreateRequest,
): Promise<{ dashboard_id: string; run_id: string; title: string; tabs: number; blocks: number }> {
  const res = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/dashboards`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  return jsonOrThrow(res);
}

/** Step 1.5 of the wizard: send the user's short brief to the agent
 *  and get back its read-back + 2–4 clarifying questions. The user
 *  answers these before the dashboard is built, so the planner has
 *  much richer context. */
export async function refineDashboardBrief(
  workspaceId: string,
  body: { persona: string; objective: string; scope_notes?: string; connection_id?: string },
): Promise<RefineBriefResult> {
  const res = await fetch(
    `${API_BASE}/api/workspaces/${workspaceId}/dashboards/refine-brief`,
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    },
  );
  return jsonOrThrow<RefineBriefResult>(res);
}

export async function refreshDashboard(
  dashboardId: string,
  workspaceId: string,
): Promise<{ run_id: string }> {
  const url = `${API_BASE}/api/dashboards/${dashboardId}/refresh?workspace_id=${encodeURIComponent(workspaceId)}`;
  const res = await fetch(url, { method: 'POST', headers: authHeaders() });
  return jsonOrThrow(res);
}

export async function publishDashboard(
  dashboardId: string,
  workspaceId: string,
  publish: boolean,
): Promise<DashboardSummary> {
  const url = `${API_BASE}/api/dashboards/${dashboardId}/publish?workspace_id=${encodeURIComponent(workspaceId)}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ publish }),
  });
  return jsonOrThrow(res);
}

export async function renameDashboard(
  dashboardId: string,
  workspaceId: string,
  title: string,
): Promise<DashboardSummary> {
  const url = `${API_BASE}/api/dashboards/${dashboardId}/title?workspace_id=${encodeURIComponent(workspaceId)}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ title }),
  });
  return jsonOrThrow(res);
}

export async function updateRefreshSchedule(
  dashboardId: string,
  workspaceId: string,
  enabled: boolean,
  intervalMinutes: number,
): Promise<RefreshSchedule> {
  const url = `${API_BASE}/api/dashboards/${dashboardId}/refresh-schedule?workspace_id=${encodeURIComponent(workspaceId)}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ enabled, interval_minutes: intervalMinutes }),
  });
  return jsonOrThrow(res);
}

export async function deleteDashboard(
  dashboardId: string,
  workspaceId: string,
): Promise<void> {
  const url = `${API_BASE}/api/dashboards/${dashboardId}?workspace_id=${encodeURIComponent(workspaceId)}`;
  const res = await fetch(url, { method: 'DELETE', headers: authHeaders() });
  if (!res.ok) {
    let detail = `Delete failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.detail) detail = String(body.detail);
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
}

/** Build the SSE URL for a streaming run. Caller wraps in `new EventSource()`. */
export function dashboardRunStreamUrl(runId: string): string {
  return `${API_BASE}/api/dashboards/runs/${runId}/stream`;
}

// ── Block-level edits ──────────────────────────────────────────────

import type { DashboardBlock } from '../types/dashboard';

export async function deleteBlock(
  dashboardId: string,
  blockId: string,
  workspaceId: string,
): Promise<void> {
  const url = `${API_BASE}/api/dashboards/${dashboardId}/blocks/${blockId}?workspace_id=${encodeURIComponent(workspaceId)}`;
  const res = await fetch(url, { method: 'DELETE', headers: authHeaders() });
  if (!res.ok && res.status !== 204) {
    let detail = `Delete failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.detail) detail = String(body.detail);
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
}

export async function updateBlockChartType(
  dashboardId: string,
  blockId: string,
  workspaceId: string,
  chartType: string,
): Promise<DashboardBlock> {
  const url = `${API_BASE}/api/dashboards/${dashboardId}/blocks/${blockId}/chart-type?workspace_id=${encodeURIComponent(workspaceId)}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ chart_type: chartType }),
  });
  return jsonOrThrow<DashboardBlock>(res);
}

export async function addBlock(
  dashboardId: string,
  workspaceId: string,
  objective: string,
  tabId?: string,
): Promise<DashboardBlock> {
  const url = `${API_BASE}/api/dashboards/${dashboardId}/blocks?workspace_id=${encodeURIComponent(workspaceId)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ objective, tab_id: tabId }),
  });
  return jsonOrThrow<DashboardBlock>(res);
}

export async function updateBlockTitle(
  dashboardId: string,
  blockId: string,
  workspaceId: string,
  title: string,
): Promise<DashboardBlock> {
  const url = `${API_BASE}/api/dashboards/${dashboardId}/blocks/${blockId}/title?workspace_id=${encodeURIComponent(workspaceId)}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ title }),
  });
  return jsonOrThrow<DashboardBlock>(res);
}

export async function moveBlock(
  dashboardId: string,
  blockId: string,
  workspaceId: string,
  direction: 'up' | 'down',
): Promise<Dashboard> {
  const url = `${API_BASE}/api/dashboards/${dashboardId}/blocks/${blockId}/move?workspace_id=${encodeURIComponent(workspaceId)}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ direction }),
  });
  return jsonOrThrow<Dashboard>(res);
}

export interface LayoutItem {
  block_id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Persist drag-and-resize positions for a tab's blocks. Called on
 *  drag-stop / resize-stop, not on every pixel during motion. */
export async function updateLayouts(
  dashboardId: string,
  workspaceId: string,
  items: LayoutItem[],
): Promise<{ updated: number }> {
  const url = `${API_BASE}/api/dashboards/${dashboardId}/layout?workspace_id=${encodeURIComponent(workspaceId)}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ items }),
  });
  return jsonOrThrow(res);
}

/** Reset the dashboard's layout to the clean default (KPIs top, charts
 *  middle, tables bottom). Server-side reshape — no payload needed. */
export async function resetDashboardLayout(
  dashboardId: string,
  workspaceId: string,
): Promise<Dashboard> {
  const url = `${API_BASE}/api/dashboards/${dashboardId}/reset-layout?workspace_id=${encodeURIComponent(workspaceId)}`;
  const res = await fetch(url, { method: 'POST', headers: authHeaders() });
  return jsonOrThrow<Dashboard>(res);
}

/** Rename a tab. */
export async function renameTab(
  dashboardId: string,
  tabId: string,
  workspaceId: string,
  title: string,
): Promise<{ id: string; title: string }> {
  const url = `${API_BASE}/api/dashboards/${dashboardId}/tabs/${tabId}/title?workspace_id=${encodeURIComponent(workspaceId)}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ title }),
  });
  return jsonOrThrow(res);
}

/** Add a new tab to an existing dashboard. The agent plans + executes
 *  the new tab's blocks against the supplied objective. */
export async function addDashboardTab(
  dashboardId: string,
  workspaceId: string,
  body: { title: string; objective: string; description?: string },
): Promise<{ id: string; title: string }> {
  const url = `${API_BASE}/api/dashboards/${dashboardId}/tabs?workspace_id=${encodeURIComponent(workspaceId)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  return jsonOrThrow(res);
}

/** Update chart presentation options on a dashboard block — chart type
 *  and / or the hidden-series list. Sends only the fields you pass.
 *  Pass `hiddenSeries: []` to clear the override and show everything. */
export async function updateBlockChartOptions(
  dashboardId: string,
  blockId: string,
  workspaceId: string,
  opts: { chartType?: string; hiddenSeries?: string[] },
): Promise<unknown> {
  const url = `${API_BASE}/api/dashboards/${dashboardId}/blocks/${blockId}/chart-options?workspace_id=${encodeURIComponent(workspaceId)}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({
      chart_type: opts.chartType,
      hidden_series: opts.hiddenSeries,
    }),
  });
  return jsonOrThrow(res);
}

/** Rename a section header (row.label). Pass an empty string to clear
 *  the header so the row renders without a heading. */
export async function renameRow(
  dashboardId: string,
  tabId: string,
  rowId: string,
  workspaceId: string,
  label: string,
): Promise<{ id: string; label: string }> {
  const url = `${API_BASE}/api/dashboards/${dashboardId}/tabs/${tabId}/rows/${rowId}/label?workspace_id=${encodeURIComponent(workspaceId)}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ label }),
  });
  return jsonOrThrow(res);
}

/** Create a new (empty) section in a tab. Useful for grouping new
 *  blocks under a custom heading. Pass `afterRowId` to insert after a
 *  specific section; omit to append. */
export async function addRow(
  dashboardId: string,
  tabId: string,
  workspaceId: string,
  body: { label?: string; afterRowId?: string },
): Promise<{ id: string; label: string }> {
  const url = `${API_BASE}/api/dashboards/${dashboardId}/tabs/${tabId}/rows?workspace_id=${encodeURIComponent(workspaceId)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      label: body.label ?? '',
      after_row_id: body.afterRowId ?? null,
    }),
  });
  return jsonOrThrow(res);
}

/** Delete an empty section. Backend refuses to delete a section that
 *  still has blocks — caller should remove or move them first. */
export async function deleteRow(
  dashboardId: string,
  tabId: string,
  rowId: string,
  workspaceId: string,
): Promise<{ ok: boolean }> {
  const url = `${API_BASE}/api/dashboards/${dashboardId}/tabs/${tabId}/rows/${rowId}?workspace_id=${encodeURIComponent(workspaceId)}`;
  const res = await fetch(url, { method: 'DELETE', headers: authHeaders() });
  return jsonOrThrow(res);
}

export async function updateDashboardPrompt(
  dashboardId: string,
  workspaceId: string,
  body: { persona: string; objective: string; scope_notes?: string },
): Promise<{ run_id: string; dashboard_id: string; title: string; tabs: number; blocks: number }> {
  const url = `${API_BASE}/api/dashboards/${dashboardId}/prompt?workspace_id=${encodeURIComponent(workspaceId)}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  return jsonOrThrow(res);
}
