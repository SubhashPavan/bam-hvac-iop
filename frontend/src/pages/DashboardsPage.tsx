import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Plus,
  LayoutDashboard,
  RefreshCw,
  Globe,
  Lock,
  ArrowRight,
  Trash2,
  Loader2,
  Sparkles,
  Clock,
} from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import { useAuthStore } from '../store/authStore';
import { useWorkspaceStore } from '../store/workspaceStore';
import { listDashboards, deleteDashboard } from '../services/dashboards';
import type { DashboardSummary } from '../types/dashboard';
import { useConfirm } from '../components/common/ConfirmProvider';
import CreateDashboardWizard from '../components/dashboard/CreateDashboardWizard';

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

export default function DashboardsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const isPrivileged = useAuthStore((s) => s.isPrivileged);
  const userId = useAuthStore((s) => s.user?.id || '');
  const confirm = useConfirm();

  const workspace = useWorkspaceStore((s) =>
    s.workspaces.find((w) => w.id === workspaceId),
  );

  const [items, setItems] = useState<DashboardSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const list = await listDashboards(workspaceId);
      setItems(list);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboards');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  const handleDelete = async (id: string) => {
    if (!workspaceId) return;
    const ok = await confirm({
      title: 'Delete this dashboard?',
      message: 'This cannot be undone. Everyone in the workspace will lose access to it.',
      variant: 'danger',
      confirmLabel: 'Delete dashboard',
    });
    if (!ok) return;
    try {
      await deleteDashboard(id, workspaceId);
      setItems((prev) => (prev || []).filter((d) => d.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const sorted = useMemo(() => {
    return [...(items || [])].sort((a, b) =>
      (b.updated_at || '').localeCompare(a.updated_at || ''),
    );
  }, [items]);

  const actions = isPrivileged ? (
    <button
      type="button"
      onClick={() => setShowWizard(true)}
      className="flex items-center gap-1.5 rounded-lg bg-accent-500 px-3 py-1.5 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-accent-600"
    >
      <Plus className="h-4 w-4" />
      New dashboard
    </button>
  ) : null;

  return (
    <AppLayout
      title="Dashboards"
      subtitle={workspace ? `Curated views for ${workspace.name}` : 'Curated, refreshable views over your data'}
      actions={actions}
    >
      {loading ? (
        <div className="flex h-40 items-center justify-center text-[13px] text-navy-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading dashboards…
        </div>
      ) : error ? (
        <div className="rounded-xl border border-danger-500/20 bg-danger-50 px-4 py-3 text-[13px] text-danger-700">
          {error}
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState canCreate={isPrivileged} onCreate={() => setShowWizard(true)} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((d) => (
            <DashboardCard
              key={d.id}
              d={d}
              canEdit={isPrivileged || d.owner_id === userId}
              onOpen={() => navigate(`/workspace/${workspaceId}/dashboard/${d.id}`)}
              onDelete={() => handleDelete(d.id)}
            />
          ))}
        </div>
      )}

      {showWizard && workspaceId && (
        <CreateDashboardWizard
          workspaceId={workspaceId}
          onClose={() => setShowWizard(false)}
          onCreated={(dashboardId) => {
            setShowWizard(false);
            navigate(`/workspace/${workspaceId}/dashboard/${dashboardId}`);
          }}
        />
      )}
    </AppLayout>
  );
}

/* ─── Card ─── */
function DashboardCard({
  d,
  canEdit,
  onOpen,
  onDelete,
}: {
  d: DashboardSummary;
  canEdit: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const isPublished = d.status === 'published';
  const statusTone = isPublished
    ? 'bg-success-50 text-success-700 ring-success-500/25'
    : d.status === 'building'
    ? 'bg-accent-50 text-accent-700 ring-accent-200'
    : d.status === 'failed'
    ? 'bg-danger-50 text-danger-700 ring-danger-500/25'
    : 'bg-navy-100 text-navy-600 ring-navy-200';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      className="group flex cursor-pointer flex-col overflow-hidden rounded-xl border border-navy-100 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-accent-500"
    >
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-50 text-accent-600 ring-1 ring-inset ring-accent-200">
          <LayoutDashboard className="h-5 w-5" />
        </div>
        <div className="flex items-center gap-1">
          {canEdit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="flex h-7 w-7 items-center justify-center rounded-md text-navy-400 opacity-0 transition-all hover:bg-danger-50 hover:text-danger-600 group-hover:opacity-100"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          <div className="flex h-7 w-7 items-center justify-center rounded-md text-navy-300 transition-colors group-hover:bg-accent-50 group-hover:text-accent-600">
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 px-4 pb-4">
        <h3 className="line-clamp-1 text-[15px] font-semibold tracking-tight text-navy-900">
          {d.title}
        </h3>
        {d.persona && (
          <p className="line-clamp-1 text-[12px] text-navy-500">
            <span className="font-semibold uppercase tracking-wider text-navy-600">For:</span>{' '}
            {d.persona}
          </p>
        )}
        {d.objective && (
          <p className="line-clamp-2 min-h-[34px] text-[12.5px] leading-relaxed text-navy-500">
            {d.objective}
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-navy-100 pt-3 text-[11.5px]">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold uppercase tracking-wider ring-1 ring-inset ${statusTone}`}
          >
            {isPublished ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
            {d.status}
          </span>
          <span className="inline-flex items-center gap-1 text-navy-500">
            <Sparkles className="h-3 w-3" />
            {d.block_count} block{d.block_count !== 1 ? 's' : ''}
          </span>
          <span className="inline-flex items-center gap-1 text-navy-500">
            <Clock className="h-3 w-3" />
            updated {timeAgo(d.updated_at)}
          </span>
          {d.last_refreshed_at && (
            <span className="inline-flex items-center gap-1 text-navy-500">
              <RefreshCw className="h-3 w-3" />
              refreshed {timeAgo(d.last_refreshed_at)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Empty state ─── */
function EmptyState({ canCreate, onCreate }: { canCreate: boolean; onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-navy-200 bg-white py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-accent-50 text-accent-600 ring-1 ring-inset ring-accent-200">
        <LayoutDashboard className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-[15px] font-semibold text-navy-800">No dashboards yet</h3>
      <p className="mt-1 max-w-sm text-[13px] text-navy-500">
        {canCreate
          ? 'Tell the agent your audience and objective — it plans the KPIs, runs the SQL, and assembles a dashboard you can publish.'
          : 'Your admin or manager hasn\'t published any dashboards in this workspace yet.'}
      </p>
      {canCreate && (
        <button
          type="button"
          onClick={onCreate}
          className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-accent-500 px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-accent-600"
        >
          <Plus className="h-4 w-4" />
          Create your first dashboard
        </button>
      )}
    </div>
  );
}
