import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ResponsiveGridLayout, verticalCompactor } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import {
  ArrowLeft,
  RefreshCw,
  Globe,
  Lock,
  Loader2,
  AlertCircle,
  Clock,
  Settings,
  Brain,
  TrendingUp,
  GripVertical,
  X,
  Plus,
  LayoutGrid,
  Pencil,
  Check,
  Wand2,
  Sparkles,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import {
  addBlock,
  addRow,
  dashboardRunStreamUrl,
  deleteBlock,
  deleteRow,
  getDashboard,
  addDashboardTab,
  publishDashboard,
  refreshDashboard,
  renameRow,
  renameTab,
  resetDashboardLayout,
  updateBlockChartOptions,
  updateBlockTitle,
  updateDashboardPrompt,
  updateLayouts,
  updateRefreshSchedule,
  type LayoutItem,
} from '../services/dashboards';
import type {
  Dashboard,
  DashboardBlock,
  DashboardTab,
} from '../types/dashboard';
import { useAuthStore } from '../store/authStore';
import { useConfirm } from '../components/common/ConfirmProvider';
import ChartRenderer from '../components/insights/ChartRenderer';
import ChartToolbar from '../components/insights/ChartToolbar';

function timeAgo(iso?: string | null): string {
  if (!iso) return 'never';
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

// ── Auto-layout helpers ───────────────────────────────────────────────
// Type-driven default sizes (mirrors backend `_DEFAULT_SIZE` so the
// frontend can compute a sane "Auto-arrange" layout without a roundtrip,
// and so RGL has a sensible fallback when block.layout is missing.)
const AUTO_SIZE: Record<string, [number, number]> = {
  kpi: [3, 2],
  chart: [6, 4],
  table: [12, 5],
  narrative: [6, 3],
};
// (Auto-arrange is handled server-side by POST /api/dashboards/{id}/reset-layout;
// the previous client-side computeAutoLayout helper was dropped as dead code.)

function formatValue(raw: unknown, fmt?: string | null): string {
  if (raw == null) return '—';
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return String(raw);
  if (fmt === 'currency') {
    const sign = n < 0 ? '-' : '';
    const abs = Math.abs(n);
    if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(2)}K`;
    return `${sign}$${abs.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }
  if (fmt === 'percent') return `${n.toFixed(1)}%`;
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toFixed(2);
}

export default function DashboardViewPage() {
  const { workspaceId, dashboardId } = useParams<{ workspaceId: string; dashboardId: string }>();
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.user?.id || '');
  const confirm = useConfirm();
  const isPrivileged = useAuthStore((s) => s.isPrivileged);

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showPromptEdit, setShowPromptEdit] = useState(false);
  const [showAddTab, setShowAddTab] = useState(false);
  const [addingTab, setAddingTab] = useState(false);
  const [replanning, setReplanning] = useState(false);
  const [replanProgress, setReplanProgress] = useState<string>('');
  const [layoutError, setLayoutError] = useState<string | null>(null);
  const refreshESRef = useRef<EventSource | null>(null);
  const replanESRef = useRef<EventSource | null>(null);

  // Auto-clear the layout-save toast after a few seconds.
  useEffect(() => {
    if (!layoutError) return;
    const t = setTimeout(() => setLayoutError(null), 4000);
    return () => clearTimeout(t);
  }, [layoutError]);

  const canEdit = useMemo(() => {
    if (!dashboard) return false;
    return isPrivileged || dashboard.owner_id === userId;
  }, [dashboard, isPrivileged, userId]);

  const load = useCallback(async () => {
    if (!workspaceId || !dashboardId) return;
    try {
      const d = await getDashboard(dashboardId, workspaceId);
      setDashboard(d);
      if (!activeTabId && d.tabs[0]) setActiveTabId(d.tabs[0].id);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, dashboardId, activeTabId]);

  useEffect(() => {
    void load();
    return () => {
      refreshESRef.current?.close();
      replanESRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, dashboardId]);

  const handleRefresh = async () => {
    if (!workspaceId || !dashboardId || refreshing) return;
    setRefreshing(true);
    try {
      const { run_id } = await refreshDashboard(dashboardId, workspaceId);
      const es = new EventSource(dashboardRunStreamUrl(run_id));
      refreshESRef.current = es;
      es.addEventListener('done', () => {
        es.close();
        refreshESRef.current = null;
        void load();
        setRefreshing(false);
      });
      es.addEventListener('error', () => {
        es.close();
        refreshESRef.current = null;
        setRefreshing(false);
      });
    } catch (e) {
      setRefreshing(false);
      alert(e instanceof Error ? e.message : 'Refresh failed');
    }
  };

  // Persist a prompt edit and trigger a re-plan + re-execute. The
  // backend wipes existing tabs/blocks and rebuilds from scratch using
  // the new prompt — every query is regenerated. Progress streams over
  // SSE; on 'done' we reload to swap the page over to the new content.
  const handleSavePrompt = async (body: {
    persona: string;
    objective: string;
    scope_notes: string;
  }) => {
    if (!workspaceId || !dashboardId) return;
    setShowPromptEdit(false);
    setReplanning(true);
    setReplanProgress('Re-planning your dashboard…');
    try {
      const { run_id } = await updateDashboardPrompt(dashboardId, workspaceId, body);
      const es = new EventSource(dashboardRunStreamUrl(run_id));
      replanESRef.current = es;
      es.addEventListener('plan_ready', (ev) => {
        try {
          const data = JSON.parse((ev as MessageEvent).data) as { tabs?: number };
          setReplanProgress(
            data.tabs ? `New plan ready (${data.tabs} tab${data.tabs > 1 ? 's' : ''}). Running queries…` : 'Running queries…',
          );
        } catch {
          setReplanProgress('Running queries…');
        }
      });
      es.addEventListener('block_done', () => {
        setReplanProgress('Running queries…');
      });
      es.addEventListener('done', () => {
        es.close();
        replanESRef.current = null;
        setReplanning(false);
        setReplanProgress('');
        void load();
      });
      es.addEventListener('error', () => {
        es.close();
        replanESRef.current = null;
        setReplanning(false);
        setReplanProgress('');
        void load();
      });
    } catch (e) {
      setReplanning(false);
      setReplanProgress('');
      alert(e instanceof Error ? e.message : 'Re-plan failed');
    }
  };

  const handlePublish = async (publish: boolean) => {
    if (!workspaceId || !dashboardId) return;
    try {
      await publishDashboard(dashboardId, workspaceId, publish);
      void load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Publish failed');
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-navy-50">
        <Loader2 className="mr-2 h-4 w-4 animate-spin text-accent-600" />
        <span className="text-[13px] text-navy-500">Loading dashboard…</span>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-navy-50 p-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-danger-50 text-danger-600 ring-1 ring-inset ring-danger-500/20">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="text-[15px] font-semibold text-navy-900">{error || 'Dashboard not found'}</h2>
        <button
          type="button"
          onClick={() =>
            navigate(`/workspace/${workspaceId}`, { state: { tab: 'dashboards' } })
          }
          className="rounded-lg border border-navy-200 bg-white px-3.5 py-1.5 text-[13px] font-semibold text-navy-700 hover:bg-navy-50"
        >
          Back to dashboards
        </button>
      </div>
    );
  }

  const isPublished = dashboard.status === 'published';
  const activeTab = dashboard.tabs.find((t) => t.id === activeTabId) || dashboard.tabs[0];

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-navy-50">
      {/* Top bar */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-navy-100 bg-white px-6 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() =>
            navigate(`/workspace/${workspaceId}`, { state: { tab: 'dashboards' } })
          }
            className="flex h-8 w-8 items-center justify-center rounded-lg text-navy-400 transition-colors hover:bg-navy-50 hover:text-navy-700"
            title="Back to dashboards"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-[15.5px] font-semibold tracking-tight text-navy-900">
                {dashboard.title}
              </h1>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider ring-1 ring-inset ${
                  isPublished
                    ? 'bg-success-50 text-success-700 ring-success-500/25'
                    : 'bg-navy-100 text-navy-600 ring-navy-200'
                }`}
              >
                {isPublished ? <Globe className="mr-0.5 inline h-3 w-3 align-[-1.5px]" /> : <Lock className="mr-0.5 inline h-3 w-3 align-[-1.5px]" />}
                {dashboard.status}
              </span>
            </div>
            {(dashboard.persona || dashboard.objective) && (
              <p className="truncate text-[11.5px] text-navy-500">
                {dashboard.persona && <span className="font-medium">{dashboard.persona}</span>}
                {dashboard.persona && dashboard.objective && ' · '}
                {dashboard.objective}
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {dashboard.refresh.last_run_at && (
            <span className="hidden items-center gap-1 text-[11.5px] text-navy-500 sm:inline-flex">
              <Clock className="h-3 w-3" />
              refreshed {timeAgo(dashboard.refresh.last_run_at)}
            </span>
          )}

          {canEdit && (
            <button
              type="button"
              onClick={() => setShowSchedule((s) => !s)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-navy-200 bg-white px-2.5 py-1.5 text-[12.5px] font-semibold text-navy-700 transition-colors hover:bg-navy-50"
              title="Refresh schedule"
            >
              <Settings className="h-3.5 w-3.5" />
              {dashboard.refresh.enabled
                ? `Auto: ${formatInterval(dashboard.refresh.interval_minutes)}`
                : 'Auto-refresh off'}
            </button>
          )}

          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-navy-200 bg-white px-2.5 py-1.5 text-[12.5px] font-semibold text-navy-700 transition-colors hover:bg-navy-50 disabled:cursor-not-allowed disabled:opacity-60"
            title="Refresh now"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>

          {canEdit && !isPublished && (
            <button
              type="button"
              onClick={async () => {
                if (!workspaceId || !dashboardId) return;
                try {
                  await resetDashboardLayout(dashboardId, workspaceId);
                  void load();
                } catch (e) {
                  setLayoutError(
                    e instanceof Error ? e.message : 'Auto-arrange failed',
                  );
                }
              }}
              disabled={replanning}
              className="inline-flex items-center gap-1.5 rounded-lg border border-navy-200 bg-white px-2.5 py-1.5 text-[12.5px] font-semibold text-navy-700 shadow-sm transition-colors hover:bg-navy-50 disabled:cursor-not-allowed disabled:opacity-60"
              title="Reset to the clean default layout: KPIs on top, charts in the middle, tables at the bottom"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Auto-arrange
            </button>
          )}

          {canEdit && !isPublished && (
            <button
              type="button"
              onClick={() => setShowPromptEdit(true)}
              disabled={replanning}
              className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-[12.5px] font-semibold text-violet-700 shadow-sm transition-colors hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-60"
              title="Edit the original prompt — re-runs all queries"
            >
              <Wand2 className="h-3.5 w-3.5" />
              Edit prompt
            </button>
          )}

          {canEdit && (
            <button
              type="button"
              onClick={() => handlePublish(!isPublished)}
              disabled={replanning}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                isPublished
                  ? 'border border-navy-200 bg-white text-navy-700 hover:bg-navy-50'
                  : 'bg-accent-500 text-white hover:bg-accent-600'
              }`}
            >
              {isPublished ? (
                <>
                  <Lock className="h-3.5 w-3.5" />
                  Unpublish
                </>
              ) : (
                <>
                  <Globe className="h-3.5 w-3.5" />
                  Publish
                </>
              )}
            </button>
          )}
        </div>
      </header>

      {/* Replan banner — overlays a thin progress strip while the dashboard
          is re-planning + re-executing. Page stays interactive but blocks
          are visibly stale until reload. */}
      {replanning && (
        <div className="flex shrink-0 items-center gap-2 border-b border-violet-200 bg-violet-50 px-4 py-2 text-[12.5px] text-violet-800">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span className="font-semibold">{replanProgress || 'Re-planning…'}</span>
          <span className="text-violet-600">— current view will refresh when ready.</span>
        </div>
      )}

      {/* Layout-save error toast — shows for a few seconds when a drag
          fails to persist so users don't think we silently dropped it. */}
      {layoutError && (
        <div className="flex shrink-0 items-center gap-2 border-b border-danger-500/20 bg-danger-50 px-4 py-2 text-[12.5px] text-danger-700">
          <AlertCircle className="h-3.5 w-3.5" />
          <span className="font-semibold">Couldn't save the new layout:</span>
          <span>{layoutError}</span>
        </div>
      )}

      {/* Schedule popover */}
      {showSchedule && canEdit && workspaceId && dashboardId && (
        <SchedulePopover
          dashboard={dashboard}
          onClose={() => setShowSchedule(false)}
          onSaved={() => {
            setShowSchedule(false);
            void load();
          }}
          workspaceId={workspaceId}
          dashboardId={dashboardId}
        />
      )}

      {/* Edit-prompt modal */}
      {showPromptEdit && canEdit && !isPublished && (
        <EditPromptModal
          dashboard={dashboard}
          onClose={() => setShowPromptEdit(false)}
          onSave={handleSavePrompt}
        />
      )}

      {/* Add-tab modal */}
      {showAddTab && canEdit && !isPublished && workspaceId && dashboardId && (
        <AddTabModal
          submitting={addingTab}
          onClose={() => setShowAddTab(false)}
          onSubmit={async (body) => {
            setAddingTab(true);
            try {
              const created = await addDashboardTab(dashboardId, workspaceId, body);
              setShowAddTab(false);
              await load();
              setActiveTabId(created.id);
            } catch (e) {
              setLayoutError(e instanceof Error ? e.message : 'Add tab failed');
            } finally {
              setAddingTab(false);
            }
          }}
        />
      )}

      {/* Tab bar — always shown when editable so the + Tab button is
          available even on a single-tab dashboard. View-only mode hides
          it when there's only one tab (nothing to switch to). */}
      {(dashboard.tabs.length > 1 || (canEdit && !isPublished)) && (
        <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-navy-100 bg-white px-4 py-1.5">
          {dashboard.tabs.map((tab) => {
            const active = activeTabId === tab.id;
            return (
              <TabPill
                key={tab.id}
                tab={tab}
                active={active}
                editable={canEdit && !isPublished && !replanning}
                onClick={() => setActiveTabId(tab.id)}
                onRename={async (next) => {
                  if (!workspaceId || !dashboardId) return;
                  try {
                    await renameTab(dashboardId, tab.id, workspaceId, next);
                    void load();
                  } catch (e) {
                    setLayoutError(e instanceof Error ? e.message : 'Rename failed');
                  }
                }}
              />
            );
          })}
          {canEdit && !isPublished && (
            <button
              type="button"
              onClick={() => setShowAddTab(true)}
              disabled={replanning || addingTab}
              className="ml-1 inline-flex shrink-0 items-center gap-1 rounded-lg border border-dashed border-navy-300 px-2.5 py-1.5 text-[12.5px] font-semibold text-navy-600 transition-colors hover:border-accent-400 hover:bg-accent-50 hover:text-accent-700 disabled:cursor-not-allowed disabled:opacity-60"
              title="Add a new tab with its own prompt"
            >
              <Plus className="h-3.5 w-3.5" />
              Tab
            </button>
          )}
        </div>
      )}

      {/* Body */}
      <div className="custom-scrollbar flex-1 overflow-y-auto px-6 py-5">
        <div className="mx-auto max-w-7xl">
          {/* Prompt header — visible to editors when not published, so they
              know what they originally asked for. */}
          {canEdit && !isPublished && (
            <PromptHeader dashboard={dashboard} />
          )}
          {activeTab ? (
            <TabContent
              tab={activeTab}
              editable={canEdit && !isPublished && !replanning}
              onDeleteBlock={async (blockId) => {
                if (!workspaceId || !dashboardId) return;
                const ok = await confirm({
                  title: 'Delete this block?',
                  message: 'It will be removed from the dashboard. You can always add it again later.',
                  variant: 'danger',
                  confirmLabel: 'Delete block',
                });
                if (!ok) return;
                try {
                  await deleteBlock(dashboardId, blockId, workspaceId);
                  void load();
                } catch (e) {
                  alert(e instanceof Error ? e.message : 'Delete failed');
                }
              }}
              onChartChange={async (blockId, opts) => {
                if (!workspaceId || !dashboardId) return;
                try {
                  await updateBlockChartOptions(dashboardId, blockId, workspaceId, opts);
                  void load();
                } catch (e) {
                  alert(e instanceof Error ? e.message : 'Update failed');
                }
              }}
              onRenameBlock={async (blockId, title) => {
                if (!workspaceId || !dashboardId) return;
                try {
                  await updateBlockTitle(dashboardId, blockId, workspaceId, title);
                  void load();
                } catch (e) {
                  alert(e instanceof Error ? e.message : 'Rename failed');
                }
              }}
              onLayoutChange={async (items) => {
                if (!workspaceId || !dashboardId) return;
                try {
                  await updateLayouts(dashboardId, workspaceId, items);
                  setLayoutError(null);
                } catch (e) {
                  // Surface a transient toast so the user knows the
                  // arrangement didn't stick — silent failure is what
                  // makes drag-and-drop feel "buggy".
                  setLayoutError(e instanceof Error ? e.message : 'Layout save failed');
                }
              }}
              onAddBlock={async (objective) => {
                if (!workspaceId || !dashboardId || !activeTab) return;
                try {
                  await addBlock(dashboardId, workspaceId, objective, activeTab.id);
                  void load();
                } catch (e) {
                  alert(e instanceof Error ? e.message : 'Add insight failed');
                }
              }}
              onRenameRow={async (rowId, label) => {
                if (!workspaceId || !dashboardId || !activeTab) return;
                try {
                  await renameRow(dashboardId, activeTab.id, rowId, workspaceId, label);
                  void load();
                } catch (e) {
                  setLayoutError(e instanceof Error ? e.message : 'Rename section failed');
                }
              }}
              onAddRow={async (label, afterRowId) => {
                if (!workspaceId || !dashboardId || !activeTab) return;
                try {
                  await addRow(dashboardId, activeTab.id, workspaceId, { label, afterRowId });
                  void load();
                } catch (e) {
                  setLayoutError(e instanceof Error ? e.message : 'Add section failed');
                }
              }}
              onDeleteRow={async (rowId) => {
                if (!workspaceId || !dashboardId || !activeTab) return;
                try {
                  await deleteRow(dashboardId, activeTab.id, rowId, workspaceId);
                  void load();
                } catch (e) {
                  setLayoutError(e instanceof Error ? e.message : 'Delete section failed');
                }
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ─── Prompt header (admins/managers, draft state) ─── */
function PromptHeader({ dashboard }: { dashboard: Dashboard }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="mb-5 overflow-hidden rounded-xl border border-accent-200 bg-gradient-to-br from-accent-50/60 to-white">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-white/60"
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-navy-400" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-navy-400" />
          )}
          <Sparkles className="h-4 w-4 text-accent-600" />
          <span className="text-[12.5px] font-semibold text-navy-800">
            Original brief
          </span>
        </div>
        <span className="text-[11px] text-navy-500">
          The agent built this dashboard from the prompt below
        </span>
      </button>
      {expanded && (
        <div className="space-y-2 border-t border-accent-200/50 bg-white/70 px-4 py-3 text-[12.5px]">
          {dashboard.persona && (
            <p>
              <span className="mr-2 text-[10.5px] font-semibold uppercase tracking-wider text-navy-500">
                Audience
              </span>
              <span className="text-navy-800">{dashboard.persona}</span>
            </p>
          )}
          {dashboard.objective && (
            <p>
              <span className="mr-2 text-[10.5px] font-semibold uppercase tracking-wider text-navy-500">
                Objective
              </span>
              <span className="text-navy-800">{dashboard.objective}</span>
            </p>
          )}
          {dashboard.scope_notes && (
            <p>
              <span className="mr-2 text-[10.5px] font-semibold uppercase tracking-wider text-navy-500">
                Scope
              </span>
              <span className="text-navy-800">{dashboard.scope_notes}</span>
            </p>
          )}
          <p className="text-[11px] italic text-navy-400">
            Planned by {dashboard.plan_model || 'the agent'}.
          </p>
        </div>
      )}
    </div>
  );
}

/* ─── One tab's worth of content ─── */
function TabContent({
  tab,
  editable,
  onDeleteBlock,
  onChartChange,
  onRenameBlock,
  onLayoutChange,
  onAddBlock,
  onRenameRow,
  onAddRow,
  onDeleteRow,
}: {
  tab: DashboardTab;
  editable: boolean;
  onDeleteBlock: (blockId: string) => void;
  onChartChange: (blockId: string, opts: { chartType?: string; hiddenSeries?: string[] }) => void;
  onRenameBlock: (blockId: string, title: string) => Promise<void>;
  onLayoutChange: (items: LayoutItem[]) => Promise<void>;
  onAddBlock: (objective: string) => Promise<void>;
  onRenameRow: (rowId: string, label: string) => Promise<void>;
  onAddRow: (label: string, afterRowId?: string) => Promise<void>;
  onDeleteRow: (rowId: string) => Promise<void>;
}) {
  // Track the grid container's width — react-grid-layout needs an explicit
  // px width and we want the grid to fill the page.
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) setContainerWidth(entry.contentRect.width);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Flatten blocks across all rows for rendering / layout calc. Sections
  // are derived from the row.label boundaries.
  const blocks = useMemo(() => tab.rows.flatMap((r) => r.blocks), [tab.rows]);

  // Build the RGL layouts array. Each block contributes one item; each
  // section header contributes a non-draggable / non-resizable item
  // placed just above its section's first block. We render a header
  // when the row has a label, OR when we're in edit mode (so users can
  // name unlabelled rows and see/manage user-added empty sections). We
  // avoid `static: true` because RGL won't compact static items — that
  // left visible gaps between sections when a section's seeded y didn't
  // immediately follow the previous section's bottom. With isDraggable
  // / isResizable false, the user still can't move them, but the
  // vertical compactor can pull them up so sections sit flush.
  const { layouts, headerInfos } = useMemo(() => {
    const items: Array<{
      i: string;
      x: number;
      y: number;
      w: number;
      h: number;
      minW?: number;
      minH?: number;
      static?: boolean;
      isDraggable?: boolean;
      isResizable?: boolean;
    }> = [];
    const headers: Array<{ key: string; rowId: string; label: string; blockCount: number }> = [];

    for (const row of tab.rows) {
      // Render the section header when:
      //   • the row has a label (existing planner sections — renderable
      //     for rename when editing), OR
      //   • the row is an editable empty placeholder (user just added a
      //     new section but hasn't named or filled it yet).
      // Don't auto-create headers on un-labelled planner rows that
      // already have content — those rows were intentionally headerless.
      const showHeader =
        !!row.label || (editable && row.blocks.length === 0);
      if (showHeader) {
        const ys = row.blocks
          .map((b) => b.layout?.y)
          .filter((y): y is number => typeof y === 'number');
        const headerY = ys.length > 0 ? Math.max(0, Math.min(...ys) - 1) : 0;
        const headerKey = `__header__${row.id}`;
        headers.push({
          key: headerKey,
          rowId: row.id,
          label: row.label,
          blockCount: row.blocks.length,
        });
        items.push({
          i: headerKey,
          x: 0,
          y: headerY,
          w: 12,
          h: 1,
          isDraggable: false,
          isResizable: false,
        });
      }
      for (let i = 0; i < row.blocks.length; i += 1) {
        const b = row.blocks[i];
        const [fallbackW, fallbackH] = AUTO_SIZE[b.type] ?? AUTO_SIZE.chart;
        const layout = b.layout;
        items.push({
          i: b.id,
          x: layout?.x ?? 0,
          y: layout?.y ?? i * fallbackH,
          w: layout?.w ?? fallbackW,
          h: layout?.h ?? fallbackH,
          minW: 2,
          minH: 2,
        });
      }
    }
    return { layouts: { lg: items }, headerInfos: headers };
  }, [tab.rows, editable]);

  const handleStop = (
    next: ReadonlyArray<{
      readonly i: string;
      readonly x: number;
      readonly y: number;
      readonly w: number;
      readonly h: number;
    }>,
  ) => {
    // Drop section header items from the layout payload — they're static
    // visual scaffolding, not block records the backend knows about.
    const blockItems = next.filter((l) => !l.i.startsWith('__header__'));
    void onLayoutChange(
      blockItems.map((l) => ({ block_id: l.i, x: l.x, y: l.y, w: l.w, h: l.h })),
    );
  };

  return (
    <div className="space-y-5">
      {tab.description && (
        <p className="text-[13px] leading-relaxed text-navy-500">{tab.description}</p>
      )}
      <div ref={containerRef} className="w-full">
        {containerWidth > 0 && (blocks.length > 0 || headerInfos.length > 0) && (
          <ResponsiveGridLayout
            className="layout"
            layouts={layouts}
            breakpoints={{ lg: 0 }}
            cols={{ lg: 12 }}
            rowHeight={60}
            width={containerWidth}
            margin={[16, 16] as [number, number]}
            onDragStop={handleStop}
            onResizeStop={handleStop}
            compactor={verticalCompactor}
            // The local react-grid-layout fork is missing types for a
            // few props that exist at runtime — splat the rest as `any`.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            {...({
              isDraggable: editable,
              isResizable: editable,
              draggableCancel: 'input,textarea,button,select,.no-drag',
            } as any)}
          >
            {/* Section headers — static items, can't be dragged.
                Editable when allowed, with rename + delete actions. */}
            {headerInfos.map((h) => (
              <div key={h.key} className="flex h-full items-center">
                <SectionHeader
                  rowId={h.rowId}
                  label={h.label}
                  blockCount={h.blockCount}
                  editable={editable}
                  onRename={(label) => onRenameRow(h.rowId, label)}
                  onDelete={() => onDeleteRow(h.rowId)}
                />
              </div>
            ))}
            {/* Actual blocks. */}
            {blocks.map((b) => (
              <div key={b.id} className="overflow-hidden">
                <BlockCard
                  block={b}
                  editable={editable}
                  onDelete={() => onDeleteBlock(b.id)}
                  onChartChange={(opts) => onChartChange(b.id, opts)}
                  onRename={(title) => onRenameBlock(b.id, title)}
                />
              </div>
            ))}
          </ResponsiveGridLayout>
        )}
      </div>
      {editable && (
        <div className="flex flex-col gap-3">
          <AddSectionRow onAdd={(label) => onAddRow(label)} />
          <AddInsightPanel onAdd={onAddBlock} />
        </div>
      )}
    </div>
  );
}

/* ─── Section header banner (rename / delete when editable) ─── */
function SectionHeader({
  rowId,
  label,
  blockCount,
  editable,
  onRename,
  onDelete,
}: {
  rowId: string;
  label: string;
  blockCount: number;
  editable: boolean;
  onRename: (next: string) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);
  const [saving, setSaving] = useState(false);

  // Re-sync the draft if the upstream label changes (after save / reload).
  useEffect(() => {
    if (!editing) setDraft(label);
  }, [label, editing]);

  const commit = async () => {
    const next = draft.trim();
    if (next === label) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onRename(next);
      setEditing(false);
    } catch {
      // Parent toast handles the error message; keep edit mode open.
    } finally {
      setSaving(false);
    }
  };

  const canDelete = editable && blockCount === 0;

  if (editing) {
    return (
      <div className="group flex w-full items-center gap-2 border-b border-accent-300 pb-1">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void commit();
            } else if (e.key === 'Escape') {
              setDraft(label);
              setEditing(false);
            }
          }}
          onBlur={() => void commit()}
          onMouseDown={(e) => e.stopPropagation()}
          disabled={saving}
          placeholder="Section name"
          className="no-drag flex-1 rounded-md border border-accent-300 bg-white px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-navy-700 outline-none ring-2 ring-accent-100"
        />
        {saving ? (
          <Loader2 className="h-3 w-3 animate-spin text-accent-500" />
        ) : (
          <Check className="h-3 w-3 text-accent-500" />
        )}
      </div>
    );
  }

  // Empty label + editable → render a discoverable placeholder.
  const isEmptyLabel = !label;

  return (
    <div className="group flex w-full items-center gap-2 border-b border-navy-200 pb-1" data-row-id={rowId}>
      {isEmptyLabel && editable ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          onMouseDown={(e) => e.stopPropagation()}
          className="no-drag rounded px-1 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-navy-400 italic hover:bg-navy-50 hover:text-navy-700"
          title="Click to name this section"
        >
          Untitled section
        </button>
      ) : (
        <button
          type="button"
          onClick={() => editable && setEditing(true)}
          onMouseDown={(e) => e.stopPropagation()}
          disabled={!editable}
          className={`no-drag rounded px-1 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-navy-700 ${
            editable ? 'cursor-text hover:bg-navy-50' : ''
          }`}
          title={editable ? 'Click to rename' : undefined}
        >
          {label}
        </button>
      )}
      {editable && !isEmptyLabel && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          onMouseDown={(e) => e.stopPropagation()}
          className="no-drag flex h-5 w-5 shrink-0 items-center justify-center rounded text-navy-300 opacity-0 transition-opacity hover:bg-navy-100 hover:text-navy-600 group-hover:opacity-100"
          title="Rename section"
        >
          <Pencil className="h-3 w-3" />
        </button>
      )}
      <span className="h-px flex-1 bg-gradient-to-r from-navy-200 to-transparent" />
      {canDelete && (
        <button
          type="button"
          onClick={() => void onDelete()}
          onMouseDown={(e) => e.stopPropagation()}
          className="no-drag flex h-5 w-5 shrink-0 items-center justify-center rounded text-navy-300 opacity-0 transition-opacity hover:bg-danger-50 hover:text-danger-600 group-hover:opacity-100"
          title="Delete this section (empty)"
        >
          <X className="h-3 w-3" />
        </button>
      )}
      {editable && !canDelete && blockCount > 0 && (
        <span
          className="shrink-0 rounded-full bg-navy-100 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-navy-500"
          title="Move or remove the blocks first to delete this section"
        >
          {blockCount}
        </span>
      )}
    </div>
  );
}

/* ─── Add-section row (footer) ─── */
function AddSectionRow({ onAdd }: { onAdd: (label: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const v = label.trim();
    if (!v || submitting) return;
    setSubmitting(true);
    try {
      await onAdd(v);
      setLabel('');
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-navy-200 bg-white/40 py-2.5 text-[12px] font-semibold uppercase tracking-wider text-navy-500 transition-all hover:border-accent-300 hover:bg-accent-50 hover:text-accent-700"
      >
        <Plus className="h-3.5 w-3.5" />
        Add section
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-accent-200 bg-white px-3 py-2 shadow-sm">
      <input
        autoFocus
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void submit();
          } else if (e.key === 'Escape') {
            setLabel('');
            setOpen(false);
          }
        }}
        placeholder="e.g. Vendor Risk, Cash Flow, Late Payments"
        disabled={submitting}
        className="flex-1 rounded-md border border-navy-200 bg-white px-2.5 py-1.5 text-[12.5px] text-navy-800 placeholder:text-navy-400 focus:border-accent-400 focus:ring-2 focus:ring-accent-100 focus:outline-none"
      />
      <button
        type="button"
        onClick={submit}
        disabled={!label.trim() || submitting}
        className="inline-flex items-center gap-1 rounded-md bg-accent-500 px-2.5 py-1.5 text-[12px] font-semibold text-white hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Plus className="h-3.5 w-3.5" />
        )}
        Add
      </button>
      <button
        type="button"
        onClick={() => {
          setLabel('');
          setOpen(false);
        }}
        disabled={submitting}
        className="rounded-md px-2 py-1.5 text-[12px] font-semibold text-navy-500 hover:bg-navy-50 hover:text-navy-700 disabled:opacity-60"
      >
        Cancel
      </button>
    </div>
  );
}

/* ─── Add insight panel (free-text → backend plans + executes one block) ─── */
function AddInsightPanel({ onAdd }: { onAdd: (objective: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [objective, setObjective] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const o = objective.trim();
    if (!o || submitting) return;
    setSubmitting(true);
    try {
      await onAdd(o);
      setObjective('');
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-navy-200 bg-white/40 py-5 text-[13px] font-semibold text-navy-500 transition-all hover:border-accent-300 hover:bg-accent-50 hover:text-accent-700"
      >
        <Plus className="h-4 w-4" />
        Add another insight
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-accent-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-accent-600" />
        <span className="text-[12.5px] font-semibold text-navy-800">Describe the new insight</span>
      </div>
      <textarea
        value={objective}
        onChange={(e) => setObjective(e.target.value)}
        rows={2}
        autoFocus
        placeholder="e.g. Show the top 5 customers by revenue this quarter, or revenue split by region."
        className="w-full resize-none rounded-lg border border-navy-200 bg-white px-3 py-2 text-[13.5px] text-navy-800 placeholder:text-navy-400 focus:border-accent-400 focus:ring-2 focus:ring-accent-100 focus:outline-none"
      />
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-[11.5px] italic text-navy-500">
          The agent picks the best block type (KPI / chart / table) for what you describe.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setObjective('');
              setOpen(false);
            }}
            disabled={submitting}
            className="rounded-lg border border-navy-200 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-navy-700 hover:bg-navy-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!objective.trim() || submitting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent-500 px-3 py-1.5 text-[12.5px] font-semibold text-white shadow-sm hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Adding…
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" />
                Add insight
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Single block card ─── */
interface BlockCardProps {
  block: DashboardBlock;
  editable: boolean;
  onDelete: () => void;
  /** Generic chart-options update — chart_type and / or hidden_series.
   *  The page-level handler turns this into a `chart-options` PUT. */
  onChartChange: (opts: { chartType?: string; hiddenSeries?: string[] }) => void;
  onRename: (title: string) => Promise<void>;
}

function BlockCard(props: BlockCardProps) {
  const { block, editable, onDelete } = props;
  if (block.last_error) {
    return (
      <div className="group relative flex h-full flex-col rounded-xl border border-danger-500/20 bg-danger-50/40 p-4">
        {editable && <BlockToolbar onDelete={onDelete} />}
        {editable && <DragGripBadge />}
        <div className="flex items-center gap-2 pr-12 text-danger-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <EditableTitle
            title={block.title}
            editable={editable}
            onRename={props.onRename}
            className="text-[13px] font-semibold text-danger-700"
          />
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-danger-700">
          {humanizeError(block.last_error)}
        </p>
        <details className="mt-2 text-[11px] text-danger-600">
          <summary className="cursor-pointer select-none hover:text-danger-700">Technical detail</summary>
          <pre className="mt-1.5 max-h-32 overflow-auto whitespace-pre-wrap rounded-md bg-white/60 p-2 font-mono text-[10.5px]">
            {block.last_error}
          </pre>
        </details>
      </div>
    );
  }

  if (block.type === 'kpi') return <KpiTile {...props} />;
  if (block.type === 'chart') return <ChartCard {...props} />;
  // table/narrative — render as a simple titled card with a row count.
  return (
    <div className="group relative flex h-full flex-col rounded-xl border border-navy-100 bg-white p-4 shadow-sm">
      {editable && <BlockToolbar onDelete={onDelete} />}
      {editable && <DragGripBadge />}
      <EditableTitle
        title={block.title}
        editable={editable}
        onRename={props.onRename}
        className="pr-12 text-[13px] font-semibold text-navy-800"
      />
      <p className="mt-1 text-[11.5px] text-navy-500">
        {block.last_row_count.toLocaleString()} rows
      </p>
    </div>
  );
}

/** Floating delete button — appears on hover, sits in the top-right
 *  corner. The mouse-down stopPropagation prevents this click from
 *  initiating a drag in react-grid-layout.  */
function BlockToolbar({ onDelete }: { onDelete: () => void }) {
  return (
    <button
      type="button"
      onClick={onDelete}
      onMouseDown={(e) => e.stopPropagation()}
      className="no-drag absolute right-2 top-2 z-20 flex h-6 w-6 items-center justify-center rounded-md bg-white/90 text-navy-400 opacity-0 shadow-sm ring-1 ring-navy-100 backdrop-blur transition-all hover:bg-danger-50 hover:text-danger-600 hover:ring-danger-200 group-hover:opacity-100 focus-within:opacity-100"
      title="Delete block"
    >
      <X className="h-3 w-3" />
    </button>
  );
}

/** Tiny grip badge anchored to the top-left of editable blocks so users
 *  see at a glance that the tile is draggable. The block itself is the
 *  drag handle — this is purely affordance.  */
function DragGripBadge() {
  return (
    <span
      className="pointer-events-none absolute left-2 top-2 z-10 flex items-center gap-0.5 rounded-md bg-white/80 px-1 py-0.5 text-navy-300 opacity-0 shadow-sm ring-1 ring-navy-100 backdrop-blur transition-opacity group-hover:opacity-100"
      title="Drag to reposition"
    >
      <GripVertical className="h-3 w-3" />
    </span>
  );
}

/** Title that flips into an inline <input> on click of the pencil icon.
 *  Saves on Enter or blur, cancels on Escape. */
function EditableTitle({
  title,
  editable,
  onRename,
  className = '',
}: {
  title: string;
  editable: boolean;
  onRename: (title: string) => Promise<void>;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const [saving, setSaving] = useState(false);

  // Re-sync if the title prop changes underneath us (e.g. after reload).
  useEffect(() => {
    if (!editing) setDraft(title);
  }, [title, editing]);

  const commit = async () => {
    const next = draft.trim();
    if (!next || next === title) {
      setEditing(false);
      setDraft(title);
      return;
    }
    setSaving(true);
    try {
      await onRename(next);
      setEditing(false);
    } catch {
      // Error toast already shown by parent — keep edit mode open
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <span className="inline-flex min-w-0 flex-1 items-center gap-1.5">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void commit();
            } else if (e.key === 'Escape') {
              setEditing(false);
              setDraft(title);
            }
          }}
          onBlur={() => void commit()}
          onMouseDown={(e) => e.stopPropagation()}
          disabled={saving}
          className={`no-drag min-w-0 flex-1 rounded-md border border-accent-300 bg-white px-1.5 py-0.5 outline-none ring-2 ring-accent-100 focus:border-accent-500 ${className}`}
        />
        {saving ? (
          <Loader2 className="h-3 w-3 animate-spin text-accent-500" />
        ) : (
          <Check className="h-3 w-3 text-accent-500" />
        )}
      </span>
    );
  }

  return (
    <span className={`inline-flex min-w-0 items-center gap-1 ${className}`}>
      <span className="truncate">{title}</span>
      {editable && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          onMouseDown={(e) => e.stopPropagation()}
          className="no-drag flex h-5 w-5 shrink-0 items-center justify-center rounded text-navy-300 opacity-0 transition-all hover:bg-navy-100 hover:text-navy-600 group-hover:opacity-100"
          title="Rename"
        >
          <Pencil className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

function KpiTile({ block, editable, onDelete, onRename }: BlockCardProps) {
  const row = block.last_data?.[0];
  const numericKey = block.last_columns.find((c) => {
    const v = row?.[c];
    return typeof v === 'number' || (typeof v === 'string' && !Number.isNaN(Number(v)));
  });
  const value = numericKey ? row?.[numericKey] : null;

  return (
    <div
      className={`group relative flex h-full min-h-[120px] flex-col justify-center rounded-xl border border-navy-100 bg-white px-5 py-4 shadow-sm transition-all hover:shadow-md ${
        editable ? 'cursor-grab active:cursor-grabbing' : ''
      }`}
    >
      {editable && <BlockToolbar onDelete={onDelete} />}
      {editable && <DragGripBadge />}
      <EditableTitle
        title={block.title}
        editable={editable}
        onRename={onRename}
        className="truncate pr-12 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-navy-500"
      />
      <p className="mt-1.5 truncate text-[28px] font-bold leading-none tabular-nums tracking-tight text-accent-700">
        {formatValue(value, block.value_format)}
      </p>
      {block.last_refreshed_at && (
        <p className="mt-1 text-[10.5px] text-navy-400">
          Updated {timeAgo(block.last_refreshed_at)}
        </p>
      )}
    </div>
  );
}

function ChartCard({
  block,
  editable,
  onDelete,
  onChartChange,
  onRename,
}: BlockCardProps) {
  const [showData, setShowData] = useState(false);

  // Cast the stored chart payload to a ChartRecommendation. The backend
  // serialises `last_chart` as an opaque dict; we know it conforms.
  const chart = block.last_chart as
    | (import('../types/chat').ChartRecommendation & { hidden_series?: string[] })
    | null;

  return (
    <div
      className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-navy-100 bg-white shadow-sm"
    >
      {/* The header doubles as the drag handle for chart blocks (cursor
          changes to grab when editable). Buttons inside stop propagation
          on mouse-down so clicks don't trigger drags. */}
      <header
        className={`flex shrink-0 items-center justify-between gap-2 border-b border-navy-100 px-4 py-2 ${
          editable ? 'cursor-grab active:cursor-grabbing' : ''
        }`}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          {editable && <GripVertical className="h-3.5 w-3.5 shrink-0 text-navy-300" />}
          <EditableTitle
            title={block.title}
            editable={editable}
            onRename={onRename}
            className="truncate pr-2 text-[13px] font-semibold text-navy-800"
          />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="rounded-full bg-navy-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-navy-600">
            {block.last_row_count} rows
          </span>
          {chart && (
            <ChartToolbar
              chart={chart}
              showData={showData}
              onShowDataToggle={() => setShowData((v) => !v)}
              onChartChange={
                editable
                  ? (next) => {
                      // Diff against current to send only what changed.
                      const opts: { chartType?: string; hiddenSeries?: string[] } = {};
                      if (next.chart_type !== chart.chart_type) {
                        opts.chartType = next.chart_type;
                      }
                      const prevHidden = chart.hidden_series || [];
                      const nextHidden = next.hidden_series || [];
                      if (
                        prevHidden.length !== nextHidden.length ||
                        prevHidden.some((s, i) => s !== nextHidden[i])
                      ) {
                        opts.hiddenSeries = nextHidden;
                      }
                      if (Object.keys(opts).length > 0) onChartChange(opts);
                    }
                  : undefined
              }
            />
          )}
          {editable && (
            <button
              type="button"
              onClick={onDelete}
              onMouseDown={(e) => e.stopPropagation()}
              className="no-drag flex h-7 w-7 items-center justify-center rounded-md text-navy-400 transition-colors hover:bg-danger-50 hover:text-danger-600"
              title="Delete block"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 p-3">
        {chart ? (
          <ChartRenderer chart={chart} compact showData={showData} />
        ) : (
          <div className="flex h-full items-center justify-center text-[12px] italic text-navy-400">
            No data
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Schedule popover ─── */
function SchedulePopover({
  dashboard,
  onClose,
  onSaved,
  workspaceId,
  dashboardId,
}: {
  dashboard: Dashboard;
  onClose: () => void;
  onSaved: () => void;
  workspaceId: string;
  dashboardId: string;
}) {
  const [enabled, setEnabled] = useState(dashboard.refresh.enabled);
  const [interval, setIntervalM] = useState(dashboard.refresh.interval_minutes);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await updateRefreshSchedule(dashboardId, workspaceId, enabled, interval);
      onSaved();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Save failed');
      setSaving(false);
    }
  };

  return (
    <div className="absolute right-6 top-16 z-30 w-80 rounded-2xl border border-navy-100 bg-white p-4 shadow-xl">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-[13px] font-semibold text-navy-900">Auto-refresh</h4>
        <button onClick={onClose} className="text-navy-400 hover:text-navy-700">
          ✕
        </button>
      </div>
      <label className="mb-2 flex items-center gap-2 text-[13px] text-navy-700">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4 rounded"
        />
        Refresh automatically
      </label>
      <select
        value={interval}
        disabled={!enabled}
        onChange={(e) => setIntervalM(Number(e.target.value))}
        className="w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-[13px] disabled:opacity-50"
      >
        <option value={15}>Every 15 minutes</option>
        <option value={60}>Every hour</option>
        <option value={240}>Every 4 hours</option>
        <option value={1440}>Daily</option>
        <option value={10080}>Weekly</option>
      </select>
      <button
        onClick={save}
        disabled={saving}
        className="mt-3 w-full rounded-lg bg-accent-500 px-3 py-2 text-[13px] font-semibold text-white hover:bg-accent-600 disabled:opacity-60"
      >
        {saving ? 'Saving…' : 'Save schedule'}
      </button>
    </div>
  );
}

/* ─── Edit-prompt modal ─── */
function EditPromptModal({
  dashboard,
  onClose,
  onSave,
}: {
  dashboard: Dashboard;
  onClose: () => void;
  onSave: (body: { persona: string; objective: string; scope_notes: string }) => Promise<void> | void;
}) {
  const [persona, setPersona] = useState(dashboard.persona || '');
  const [objective, setObjective] = useState(dashboard.objective || '');
  const [scope, setScope] = useState(dashboard.scope_notes || '');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const p = persona.trim();
    const o = objective.trim();
    if (!p || !o || saving) return;
    setSaving(true);
    try {
      await onSave({ persona: p, objective: o, scope_notes: scope.trim() });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/50 px-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-navy-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500 text-white shadow-sm">
              <Wand2 className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-[15.5px] font-semibold tracking-tight text-navy-900">
                Edit dashboard prompt
              </h2>
              <p className="text-[11.5px] text-navy-500">
                Saving will re-plan and re-run every query against the new prompt.
              </p>
            </div>
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
              Audience
            </label>
            <input
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
              placeholder="e.g. Head of Sales"
              className="w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-[13.5px] text-navy-800 placeholder:text-navy-400 focus:border-accent-400 focus:ring-2 focus:ring-accent-100 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wider text-navy-500">
              Objective
            </label>
            <textarea
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              rows={3}
              placeholder="What business questions should this dashboard answer?"
              className="w-full resize-none rounded-lg border border-navy-200 bg-white px-3 py-2 text-[13.5px] text-navy-800 placeholder:text-navy-400 focus:border-accent-400 focus:ring-2 focus:ring-accent-100 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wider text-navy-500">
              Scope <span className="font-normal lowercase text-navy-400">optional</span>
            </label>
            <input
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              placeholder="e.g. last 12 months, North America only"
              className="w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-[13.5px] text-navy-800 placeholder:text-navy-400 focus:border-accent-400 focus:ring-2 focus:ring-accent-100 focus:outline-none"
            />
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2.5 text-[12px] leading-relaxed text-amber-800">
            <strong className="font-semibold">Heads up:</strong> Saving rebuilds the entire dashboard.
            All current tiles (including any you renamed, reordered, or added) will be replaced by what
            the agent picks for the new prompt.
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-navy-100 bg-navy-50/40 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-navy-200 bg-white px-4 py-2 text-[13.5px] font-semibold text-navy-700 hover:bg-navy-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!persona.trim() || !objective.trim() || saving}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-[13.5px] font-semibold text-white shadow-sm hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Re-planning…
              </>
            ) : (
              <>
                <Wand2 className="h-3.5 w-3.5" />
                Save & re-run queries
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Tab pill (click-to-rename when editable) ─── */
function TabPill({
  tab,
  active,
  editable,
  onClick,
  onRename,
}: {
  tab: DashboardTab;
  active: boolean;
  editable: boolean;
  onClick: () => void;
  onRename: (next: string) => Promise<void> | void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(tab.title);

  useEffect(() => {
    if (!editing) setDraft(tab.title);
  }, [tab.title, editing]);

  const commit = async () => {
    const next = draft.trim();
    if (next && next !== tab.title) {
      await onRename(next);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void commit();
          } else if (e.key === 'Escape') {
            setDraft(tab.title);
            setEditing(false);
          }
        }}
        onBlur={() => void commit()}
        className="shrink-0 rounded-lg border border-accent-300 bg-white px-2 py-1 text-[12.5px] font-medium text-navy-900 outline-none ring-2 ring-accent-100"
        style={{ minWidth: 80 }}
      />
    );
  }

  return (
    <span className="group/tab inline-flex shrink-0 items-center">
      <button
        type="button"
        onClick={onClick}
        onDoubleClick={() => editable && setEditing(true)}
        className={`shrink-0 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
          active
            ? 'bg-accent-50 text-accent-700 ring-1 ring-inset ring-accent-200'
            : 'text-navy-600 hover:bg-navy-50 hover:text-navy-900'
        }`}
        title={editable ? 'Click to switch · double-click to rename' : tab.title}
      >
        {tab.title}
      </button>
      {editable && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="ml-0.5 flex h-5 w-5 items-center justify-center rounded text-navy-300 opacity-0 transition-opacity hover:bg-navy-100 hover:text-navy-600 group-hover/tab:opacity-100"
          title="Rename tab"
        >
          <Pencil className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

/* ─── Add-tab modal ─── */
function AddTabModal({
  submitting,
  onClose,
  onSubmit,
}: {
  submitting: boolean;
  onClose: () => void;
  onSubmit: (body: { title: string; objective: string; description?: string }) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [objective, setObjective] = useState('');
  const [scope, setScope] = useState('');

  const submit = async () => {
    const t = title.trim();
    const o = objective.trim();
    if (!t || !o || submitting) return;
    await onSubmit({ title: t, objective: o, description: scope.trim() || undefined });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/50 px-4 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-navy-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent-500 text-white shadow-sm">
              <Plus className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-[15.5px] font-semibold tracking-tight text-navy-900">
                New tab
              </h2>
              <p className="text-[11.5px] text-navy-500">
                The agent plans + runs the new tab against the objective you give it.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-navy-400 hover:bg-navy-50 hover:text-navy-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wider text-navy-500">
              Tab name
            </label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Vendor Risk"
              className="w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-[13.5px] text-navy-800 placeholder:text-navy-400 focus:border-accent-400 focus:ring-2 focus:ring-accent-100 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wider text-navy-500">
              Objective
            </label>
            <textarea
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              rows={3}
              placeholder="What questions should this tab answer? e.g. Which vendors carry the most risk based on late payments and concentration?"
              className="w-full resize-none rounded-lg border border-navy-200 bg-white px-3 py-2 text-[13.5px] text-navy-800 placeholder:text-navy-400 focus:border-accent-400 focus:ring-2 focus:ring-accent-100 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wider text-navy-500">
              Scope <span className="font-normal lowercase text-navy-400">optional</span>
            </label>
            <input
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              placeholder="e.g. last 12 months"
              className="w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-[13.5px] text-navy-800 placeholder:text-navy-400 focus:border-accent-400 focus:ring-2 focus:ring-accent-100 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-navy-100 bg-navy-50/40 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-navy-200 bg-white px-4 py-2 text-[13.5px] font-semibold text-navy-700 hover:bg-navy-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!title.trim() || !objective.trim() || submitting}
            className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-2 text-[13.5px] font-semibold text-white shadow-sm hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Building…
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" />
                Add tab
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Strip noisy SQLAlchemy / driver wrappers from error strings so the
 *  user sees the actionable bit ("relation foo does not exist"). */
function humanizeError(raw: string): string {
  if (!raw) return 'Query failed.';
  let s = raw.trim();
  // Strip Python class wrappers like "<class 'asyncpg.exceptions.UndefinedTableError'>:"
  s = s.replace(/<class\s+'[^']+'>:?/g, '').trim();
  // Strip leading "(driver...)" parenthesized wrapper
  s = s.replace(/^\([^)]+\)\s*/, '').trim();
  // Strip the [SQL: ...] tail and the "Background on this error..." link
  s = s.replace(/\s*\[SQL:[\s\S]*$/, '').trim();
  s = s.replace(/\(Background on this error[\s\S]*$/, '').trim();
  // Title-case first character
  if (s.length > 1) s = s.charAt(0).toUpperCase() + s.slice(1);
  return s || 'Query failed.';
}

function formatInterval(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / 1440)}d`;
}

// (lints — keep referenced symbols importable)
export { formatValue, timeAgo };
const _references = { Brain, TrendingUp };
void _references;
