import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Activity, DollarSign, Clock, Check, X, Trash2,
  Settings, Loader2, AlertTriangle, RefreshCw, Plus, UserPlus,
  MessageSquare, Database, BarChart3,
  Shield, Search, ChevronRight,
  UserCog, ScrollText, LayoutDashboard, Building2, Plug,
} from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import { useConfirm } from '../components/common/ConfirmProvider';
import { useAuthStore, type User } from '../store/authStore';
import { useWorkspaceStore } from '../store/workspaceStore';
import CreateWorkspaceDialog from '../components/workspace/CreateWorkspaceDialog';
import ApiToolManager from '../components/workspace/ApiToolManager';
import type { CreateWorkspaceResult } from '../components/workspace/CreateWorkspaceDialog';
import type { ConnectionInfo } from '../types/connection';
import { createWorkspaceOnBackend } from '../services/api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

type Section = 'dashboard' | 'workspaces' | 'managers' | 'users' | 'usage';
type UserFilter = 'all' | 'pending' | 'active' | 'suspended';

/* ─── Types ─── */
interface WorkspaceMember {
  email: string;
  name: string;
  avatar_url: string;
  status: string;
  added_at: string;
}

interface WorkspaceOwner {
  id: string;
  name: string;
  email: string;
  avatar_url: string;
  role: string;
}

interface WorkspaceMetrics {
  total_queries: number;
  total_tokens: number;
  total_cost: number;
}

interface AdminWorkspace {
  id: string;
  name: string;
  description: string;
  icon: string;
  created_at: string;
  last_active_at: string;
  connection_count: number;
  api_tools_count: number;
  owner: WorkspaceOwner;
  members: WorkspaceMember[];
  member_count: number;
  metrics: WorkspaceMetrics;
}

interface AdminStats {
  total_users: number;
  active_users: number;
  pending_users: number;
  suspended_users: number;
  total_questions_today: number;
  total_tokens_today: number;
  total_cost_today: number;
  total_cost_month: number;
  recent_signups: User[];
}

interface UsageEntry {
  user_name: string;
  user_email: string;
  questions: number;
  tokens: number;
  cost_usd: number;
  model: string;
  timestamp: string;
}

function useAdminApi() {
  const token = useAuthStore((s) => s.token);
  const headers = useCallback((): Record<string, string> => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    // Use zustand token first, fall back to localStorage (handles hydration delay)
    let t = token;
    if (!t) {
      try {
        const stored = localStorage.getItem('insightsmart-auth');
        if (stored) t = JSON.parse(stored)?.state?.token || null;
      } catch { /* ignore */ }
    }
    if (t) h['Authorization'] = `Bearer ${t}`;
    return h;
  }, [token]);
  return { headers };
}

/* ─── Small reusable components ─── */

type StatTone = 'accent' | 'success' | 'warn' | 'danger' | 'navy';

const STAT_TONES: Record<StatTone, { bg: string; text: string }> = {
  accent: { bg: 'bg-accent-50', text: 'text-accent-600' },
  success: { bg: 'bg-success-50', text: 'text-success-600' },
  warn: { bg: 'bg-warn-50', text: 'text-warn-600' },
  danger: { bg: 'bg-danger-50', text: 'text-danger-600' },
  navy: { bg: 'bg-navy-100', text: 'text-navy-700' },
};

function StatCard({ icon, label, value, tone = 'accent' }: {
  icon: React.ReactNode; label: string; value: string | number; tone?: StatTone;
}) {
  const c = STAT_TONES[tone];
  return (
    <div className="flex items-center gap-4 rounded-xl border border-navy-100 bg-white p-5 shadow-sm">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${c.bg} ${c.text}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-semibold tracking-tight text-navy-900">{value}</div>
        <div className="text-[12px] font-medium uppercase tracking-wide text-navy-500">{label}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'bg-success-50 text-success-700 ring-success-200',
    pending: 'bg-warn-50 text-warn-700 ring-warn-200',
    suspended: 'bg-danger-50 text-danger-700 ring-danger-200',
    inactive: 'bg-navy-100 text-navy-600 ring-navy-200',
  };
  const cls = map[status] || 'bg-navy-100 text-navy-600 ring-navy-200';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ring-1 ring-inset ${cls}`}>
      {status}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, string> = {
    admin: 'bg-danger-50 text-danger-700 ring-danger-200',
    manager: 'bg-accent-50 text-accent-700 ring-accent-200',
    user: 'bg-navy-100 text-navy-600 ring-navy-200',
  };
  const cls = map[role] || map.user;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ring-1 ring-inset ${cls}`}>
      {role}
    </span>
  );
}

function Avatar({ name, url, size = 32 }: { name: string; url?: string | null; size?: number }) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        style={{ width: size, height: size }}
        className="shrink-0 rounded-full object-cover ring-1 ring-navy-100"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-navy-800 to-navy-900 font-bold text-white"
    >
      {name?.charAt(0)?.toUpperCase() || '?'}
    </div>
  );
}

function MiniStat({ icon, value }: { icon: React.ReactNode; value: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-navy-50 px-2 py-1 text-[12px] font-medium text-navy-600">
      <span className="text-navy-400">{icon}</span>
      {value}
    </span>
  );
}

/* ─── Limits Modal ─── */
function LimitsModal({ user, onClose, onSave }: {
  user: User; onClose: () => void; onSave: (limits: Record<string, unknown>) => void;
}) {
  const [maxQ, setMaxQ] = useState(String(user.max_questions_per_day));
  const [maxT, setMaxT] = useState(String(user.max_tokens_per_day));
  const [maxC, setMaxC] = useState(String(user.max_cost_usd_per_month));
  const [expiry, setExpiry] = useState(user.expiry_date || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave({
      max_questions_per_day: parseInt(maxQ) || 0,
      max_tokens_per_day: parseInt(maxT) || 0,
      max_cost_usd_per_month: parseFloat(maxC) || 0,
      expiry_date: expiry || null,
    });
    setSaving(false);
    onClose();
  };

  const inputCls = "w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm text-navy-800 placeholder:text-navy-400 focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-100";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-navy-900">Set Limits for {user.name}</h3>
        <p className="mt-1 text-sm text-navy-500">Adjust quotas and expiry for this user.</p>

        <div className="mt-5 grid gap-4">
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-navy-600">Max Questions/Day</span>
            <input type="number" className={inputCls} value={maxQ} onChange={(e) => setMaxQ(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-navy-600">Max Tokens/Day</span>
            <input type="number" className={inputCls} value={maxT} onChange={(e) => setMaxT(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-navy-600">Max Cost USD/Month</span>
            <input type="number" step="0.01" className={inputCls} value={maxC} onChange={(e) => setMaxC(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-navy-600">Expiry Date</span>
            <input type="date" className={inputCls} value={expiry} onChange={(e) => setExpiry(e.target.value)} />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            className="rounded-lg border border-navy-200 bg-white px-4 py-2 text-sm font-medium text-navy-700 transition-colors hover:bg-navy-50"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-600 disabled:opacity-60"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            Save Limits
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Shared table wrapper ─── */
function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-navy-100 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full">{children}</table>
      </div>
    </div>
  );
}

const TH_CLS = "bg-navy-50 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-navy-500";
const TD_CLS = "px-4 py-3 text-sm text-navy-700";
const TR_CLS = "border-t border-navy-100 hover:bg-navy-50";

function LoadingBlock({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-xl border border-navy-100 bg-white py-16 text-sm text-navy-500 shadow-sm">
      <Loader2 size={18} className="animate-spin text-accent-500" />
      {label}
    </div>
  );
}

function EmptyBlock({ label, padded = false }: { label: string; padded?: boolean }) {
  return (
    <div className={`rounded-xl border border-dashed border-navy-200 bg-navy-50/50 text-center text-sm text-navy-500 ${padded ? 'p-16' : 'p-8'}`}>
      {label}
    </div>
  );
}

/* ================================================================
   SECTION: Dashboard
   ================================================================ */
function DashboardSection({ stats, workspaces, loading, onOpenWorkspace }: {
  stats: AdminStats | null; workspaces: AdminWorkspace[]; loading: boolean;
  onOpenWorkspace: (id: string) => void;
}) {
  if (loading) return <LoadingBlock label="Loading..." />;

  return (
    <div className="space-y-8">
      {/* User stats row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Users size={20} />} label="Total Users" value={stats?.total_users ?? 0} tone="accent" />
        <StatCard icon={<Check size={20} />} label="Active" value={stats?.active_users ?? 0} tone="success" />
        <StatCard icon={<Clock size={20} />} label="Pending" value={stats?.pending_users ?? 0} tone="warn" />
        <StatCard icon={<X size={20} />} label="Suspended" value={stats?.suspended_users ?? 0} tone="danger" />
      </div>

      {/* Activity stats row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<BarChart3 size={20} />} label="Workspaces" value={workspaces.length} tone="accent" />
        <StatCard icon={<MessageSquare size={20} />} label="Today's Questions" value={stats?.total_questions_today ?? 0} tone="navy" />
        <StatCard icon={<DollarSign size={20} />} label="Today Cost" value={`$${(stats?.total_cost_today ?? 0).toFixed(2)}`} tone="warn" />
        <StatCard icon={<DollarSign size={20} />} label="Month Cost" value={`$${(stats?.total_cost_month ?? 0).toFixed(2)}`} tone="danger" />
      </div>

      {/* Top workspaces summary table */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-navy-900">Top Workspaces</h3>
          <span className="text-xs text-navy-500">Sorted by queries</span>
        </div>
        <TableShell>
          <thead>
            <tr>
              <th className={TH_CLS}>Workspace</th>
              <th className={TH_CLS}>Manager</th>
              <th className={TH_CLS}>Members</th>
              <th className={TH_CLS}>Connections</th>
              <th className={TH_CLS}>Queries</th>
              <th className={TH_CLS}>Cost</th>
            </tr>
          </thead>
          <tbody>
            {[...workspaces]
              .sort((a, b) => b.metrics.total_queries - a.metrics.total_queries)
              .slice(0, 10)
              .map((ws) => (
                <tr key={ws.id} className={`${TR_CLS} cursor-pointer`} onClick={() => onOpenWorkspace(ws.id)}>
                  <td className={TD_CLS}>
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-50 text-accent-600 ring-1 ring-accent-100">
                        <BarChart3 size={14} />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-navy-800">{ws.name}</div>
                        <div className="truncate text-xs text-navy-500">{ws.description || '--'}</div>
                      </div>
                    </div>
                  </td>
                  <td className={TD_CLS}>
                    <div className="flex items-center gap-2">
                      <Avatar name={ws.owner.name} url={ws.owner.avatar_url} size={24} />
                      <span className="text-sm text-navy-700">{ws.owner.name}</span>
                    </div>
                  </td>
                  <td className={TD_CLS}>{ws.member_count}</td>
                  <td className={TD_CLS}>{ws.connection_count}</td>
                  <td className={TD_CLS}>{ws.metrics.total_queries.toLocaleString()}</td>
                  <td className={TD_CLS}>${ws.metrics.total_cost.toFixed(2)}</td>
                </tr>
              ))}
            {workspaces.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-navy-500">
                  No workspaces yet
                </td>
              </tr>
            )}
          </tbody>
        </TableShell>
      </section>

      {/* Recent signups */}
      {stats?.recent_signups && stats.recent_signups.length > 0 && (
        <section>
          <h3 className="mb-3 text-base font-semibold text-navy-900">Recent Signups</h3>
          <div className="divide-y divide-navy-100 overflow-hidden rounded-xl border border-navy-100 bg-white shadow-sm">
            {stats.recent_signups.slice(0, 5).map((u) => (
              <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={u.name} url={u.avatar_url} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-navy-800">{u.name}</div>
                  <div className="truncate text-xs text-navy-500">{u.email}</div>
                </div>
                <RoleBadge role={u.role} />
                <StatusBadge status={u.status} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ================================================================
   SECTION: Workspaces (full management)
   ================================================================ */
function WorkspacesSection({ workspaces, loading, onOpenWorkspace, onDeleteWorkspace, headers, onRefresh }: {
  workspaces: AdminWorkspace[]; loading: boolean;
  onOpenWorkspace: (id: string) => void;
  onDeleteWorkspace: (id: string, name: string) => void;
  headers: Record<string, string>;
  onRefresh: () => void;
}) {
  const navigate = useNavigate();
  const wsStore = useWorkspaceStore();
  const confirm = useConfirm();
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [addingMember, setAddingMember] = useState<string | null>(null);
  const [removingMember, setRemovingMember] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [showBulk, setShowBulk] = useState<string | null>(null);
  const [bulkAdding, setBulkAdding] = useState(false);
  const [apiToolsWsId, setApiToolsWsId] = useState<string | null>(null);

  const addMembersBulk = async (wsId: string) => {
    const emails = bulkText
      .split(/[\n,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e && e.includes('@'));
    if (emails.length === 0) return;
    setBulkAdding(true);
    for (const email of emails) {
      try {
        await fetch(`${API_BASE}/api/workspaces/${wsId}/members`, {
          method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
      } catch { /* skip */ }
    }
    setBulkAdding(false);
    setBulkText('');
    setShowBulk(null);
    onRefresh();
  };

  const addMember = async (wsId: string) => {
    if (!newEmail.trim()) return;
    setAddingMember(wsId);
    try {
      const res = await fetch(`${API_BASE}/api/workspaces/${wsId}/members`, {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail.trim() }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.detail || 'Failed to add member'); return; }
      setNewEmail('');
      onRefresh();
    } catch { alert('Network error'); }
    finally { setAddingMember(null); }
  };

  const removeMember = async (wsId: string, email: string) => {
    const ok = await confirm({
      title: `Remove ${email}?`,
      message: 'They will lose access to this workspace. You can add them back any time.',
      variant: 'danger',
      confirmLabel: 'Remove',
    });
    if (!ok) return;
    setRemovingMember(email);
    try {
      await fetch(`${API_BASE}/api/workspaces/${wsId}/members/${encodeURIComponent(email)}`, {
        method: 'DELETE', headers,
      });
      onRefresh();
    } catch { alert('Network error'); }
    finally { setRemovingMember(null); }
  };

  const handleCreate = async (data: CreateWorkspaceResult): Promise<string> => {
    // Build connection_ids from the wizard result
    const connectionIds: string[] = [];
    if (data.connection?.id) connectionIds.push(data.connection.id);

    // Create workspace on backend (sets owner_id from JWT)
    const doc = await createWorkspaceOnBackend({
      name: data.name,
      description: data.description || '',
      icon: data.icon || 'bar-chart-3',
      connection_ids: connectionIds,
    });
    const backendId = doc.id as string;

    // Also create in local store for navigation
    const ws = wsStore.createWorkspace({
      name: data.name,
      description: data.description,
      icon: data.icon,
      backendId,
    } as Parameters<typeof wsStore.createWorkspace>[0]);
    wsStore.setActiveWorkspace(ws.id);

    if (data.connection) {
      const { id, config, selectedTables, schema } = data.connection;
      const connInfo: ConnectionInfo = {
        id,
        name: config.name,
        connectorType: config.connectorType,
        host: 'host' in config ? config.host : ('endpoint' in config ? config.endpoint : 'local'),
        database: 'database' in config ? config.database : config.name,
        status: 'connected',
        selectedTableNames: selectedTables,
        schema,
      };
      wsStore.addConnectionToWorkspace(ws.id, connInfo);

      // Trigger profiling on the backend workspace
      if (backendId && id) {
        try {
          await fetch(`${API_BASE}/api/workspaces/${backendId}/profile/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify({
              connection_id: id,
              selected_tables: selectedTables || [],
            }),
          });
        } catch { /* profiling is non-blocking */ }
      }
    }
    onRefresh();
    return ws.id;
  };

  const handleNavigateToWorkspace = (workspaceId: string) => {
    setShowCreateDialog(false);
    navigate(`/workspace/${workspaceId}`);
  };

  if (loading) return <LoadingBlock label="Loading workspaces..." />;

  const filtered = workspaces.filter((ws) =>
    !search ||
    ws.name.toLowerCase().includes(search.toLowerCase()) ||
    ws.owner.name.toLowerCase().includes(search.toLowerCase()) ||
    ws.owner.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-xl border border-navy-100 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-navy-200 bg-white px-3 py-2 focus-within:border-accent-400 focus-within:ring-2 focus-within:ring-accent-100">
          <Search size={14} className="text-navy-400" />
          <input
            type="text"
            placeholder="Search workspaces, managers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-sm text-navy-800 placeholder:text-navy-400 focus:outline-none"
          />
        </div>
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <span className="text-sm text-navy-500">
            {filtered.length} workspace{filtered.length !== 1 ? 's' : ''}
          </span>
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-600"
            onClick={() => setShowCreateDialog(true)}
          >
            <Plus size={14} /> New Workspace
          </button>
        </div>
      </div>

      <CreateWorkspaceDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreate={handleCreate}
        onNavigate={handleNavigateToWorkspace}
      />

      {filtered.length === 0 ? (
        <EmptyBlock label="No workspaces found" padded />
      ) : (
        <div className="space-y-3">
          {filtered.map((ws) => {
            const isOpen = expandedId === ws.id;
            return (
              <div
                key={ws.id}
                className={`overflow-hidden rounded-xl border bg-white shadow-sm transition-colors ${
                  isOpen ? 'border-accent-200' : 'border-navy-100'
                }`}
              >
                {/* Header row (clickable) */}
                <div
                  className="flex cursor-pointer items-center gap-4 px-4 py-4 hover:bg-navy-50"
                  onClick={() => setExpandedId(isOpen ? null : ws.id)}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-600 ring-1 ring-accent-100">
                    <BarChart3 size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold text-navy-900">{ws.name}</h3>
                    <p className="truncate text-xs text-navy-500">{ws.description || 'No description'}</p>
                  </div>
                  <div className="hidden items-center gap-2 md:flex">
                    <MiniStat icon={<Users size={13} />} value={ws.member_count} />
                    <MiniStat icon={<Database size={13} />} value={ws.connection_count} />
                    <MiniStat icon={<MessageSquare size={13} />} value={ws.metrics.total_queries} />
                    <MiniStat icon={<DollarSign size={13} />} value={`$${ws.metrics.total_cost.toFixed(2)}`} />
                  </div>
                  <ChevronRight
                    size={16}
                    className={`shrink-0 text-navy-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                  />
                </div>

                {isOpen && (
                  <div className="border-t border-navy-100 bg-navy-50/30 p-5">
                    {/* Metrics grid */}
                    <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
                      {[
                        { lbl: 'Queries', val: ws.metrics.total_queries.toLocaleString() },
                        { lbl: 'Tokens', val: ws.metrics.total_tokens.toLocaleString() },
                        { lbl: 'Cost', val: `$${ws.metrics.total_cost.toFixed(2)}` },
                        { lbl: 'Connections', val: ws.connection_count },
                        { lbl: 'API Tools', val: ws.api_tools_count },
                      ].map((m) => (
                        <div key={m.lbl} className="rounded-lg border border-navy-100 bg-white px-3 py-3 text-center">
                          <div className="text-lg font-semibold text-navy-900">{m.val}</div>
                          <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-navy-500">{m.lbl}</div>
                        </div>
                      ))}
                    </div>

                    {/* Manager */}
                    <div className="mb-5">
                      <h4 className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-navy-500">
                        <Shield size={13} /> Manager / Owner
                      </h4>
                      <div className="flex items-center gap-3 rounded-lg border border-navy-100 bg-white px-3 py-2.5">
                        <Avatar name={ws.owner.name} url={ws.owner.avatar_url} size={28} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-navy-800">{ws.owner.name || 'Unknown'}</div>
                          <div className="truncate text-xs text-navy-500">{ws.owner.email}</div>
                        </div>
                        <RoleBadge role={ws.owner.role} />
                      </div>
                    </div>

                    {/* Members */}
                    <div className="mb-5">
                      <h4 className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-navy-500">
                        <Users size={13} /> Members ({ws.members.length})
                      </h4>

                      {/* Add member form */}
                      <div className="mb-2 flex flex-wrap gap-2">
                        <input
                          type="email"
                          placeholder="Enter email to add member..."
                          value={expandedId === ws.id ? newEmail : ''}
                          onChange={(e) => setNewEmail(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addMember(ws.id)}
                          className="min-w-[220px] flex-1 rounded-lg border border-navy-200 bg-white px-3 py-1.5 text-sm text-navy-800 placeholder:text-navy-400 focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-100"
                        />
                        <button
                          className="inline-flex items-center gap-1.5 rounded-lg bg-accent-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent-600 disabled:opacity-60"
                          disabled={addingMember === ws.id || !newEmail.trim()}
                          onClick={() => addMember(ws.id)}
                        >
                          {addingMember === ws.id ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <>
                              <UserPlus size={13} /> Add
                            </>
                          )}
                        </button>
                        <button
                          className="rounded-lg border border-navy-200 bg-white px-3 py-1.5 text-xs font-medium text-navy-700 transition-colors hover:bg-navy-50"
                          onClick={() => setShowBulk(showBulk === ws.id ? null : ws.id)}
                        >
                          Bulk Add
                        </button>
                      </div>

                      {/* Bulk add */}
                      {showBulk === ws.id && (
                        <div className="mb-3 rounded-lg border border-navy-100 bg-white p-3">
                          <p className="mb-2 text-xs text-navy-500">
                            Paste emails separated by commas, semicolons, or new lines:
                          </p>
                          <textarea
                            value={bulkText}
                            onChange={(e) => setBulkText(e.target.value)}
                            placeholder={"user1@example.com\nuser2@example.com\nuser3@example.com"}
                            rows={4}
                            className="w-full resize-y rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm text-navy-800 placeholder:text-navy-400 focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-100"
                          />
                          <div className="mt-2 flex justify-end gap-2">
                            <button
                              className="rounded-lg border border-navy-200 bg-white px-3 py-1.5 text-xs font-medium text-navy-700 transition-colors hover:bg-navy-50"
                              onClick={() => { setShowBulk(null); setBulkText(''); }}
                            >
                              Cancel
                            </button>
                            <button
                              className="inline-flex items-center gap-1.5 rounded-lg bg-accent-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent-600 disabled:opacity-60"
                              disabled={bulkAdding || !bulkText.trim()}
                              onClick={() => addMembersBulk(ws.id)}
                            >
                              {bulkAdding ? (
                                <>
                                  <Loader2 size={13} className="animate-spin" /> Adding...
                                </>
                              ) : (
                                `Add ${bulkText.split(/[\n,;]+/).filter(e => e.trim().includes('@')).length} Members`
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      {ws.members.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-navy-200 bg-white px-3 py-4 text-center text-sm text-navy-500">
                          No members added yet
                        </p>
                      ) : (
                        <div className="divide-y divide-navy-100 overflow-hidden rounded-lg border border-navy-100 bg-white">
                          {ws.members.map((m) => (
                            <div key={m.email} className="flex items-center gap-3 px-3 py-2.5">
                              <Avatar name={m.name} url={m.avatar_url} size={28} />
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-medium text-navy-800">{m.name}</div>
                                <div className="truncate text-xs text-navy-500">{m.email}</div>
                              </div>
                              <StatusBadge status={m.status} />
                              <button
                                className="rounded p-1.5 text-danger-500 transition-colors hover:bg-danger-50 hover:text-danger-700 disabled:opacity-60"
                                title="Remove member"
                                disabled={removingMember === m.email}
                                onClick={() => removeMember(ws.id, m.email)}
                              >
                                {removingMember === m.email ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : (
                                  <X size={14} />
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Footer: timestamps + actions */}
                    <div className="flex flex-col items-start gap-3 border-t border-navy-100 pt-4 md:flex-row md:items-center md:justify-between">
                      <div className="flex flex-wrap gap-4 text-xs text-navy-500">
                        <span className="inline-flex items-center gap-1">
                          <Clock size={12} /> Created: {ws.created_at ? new Date(ws.created_at).toLocaleDateString() : '--'}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Activity size={12} /> Last Active: {ws.last_active_at ? new Date(ws.last_active_at).toLocaleDateString() : '--'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="inline-flex items-center gap-1.5 rounded-lg border border-accent-200 bg-accent-50 px-3 py-1.5 text-xs font-semibold text-accent-700 transition-colors hover:bg-accent-100"
                          onClick={(e) => { e.stopPropagation(); setApiToolsWsId(ws.id); }}
                        >
                          <Plug size={13} /> API Tools
                        </button>
                        <button
                          className="inline-flex items-center gap-1.5 rounded-lg border border-danger-200 bg-white px-3 py-1.5 text-xs font-semibold text-danger-600 transition-colors hover:bg-danger-50"
                          onClick={(e) => { e.stopPropagation(); onDeleteWorkspace(ws.id, ws.name); }}
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                        <button
                          className="inline-flex items-center gap-1.5 rounded-lg bg-accent-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent-600"
                          onClick={(e) => { e.stopPropagation(); onOpenWorkspace(ws.id); }}
                        >
                          Open Workspace <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {apiToolsWsId && (
        <ApiToolManager
          workspaceId={apiToolsWsId}
          onClose={() => { setApiToolsWsId(null); onRefresh(); }}
        />
      )}
    </div>
  );
}

/* ================================================================
   SECTION: Managers
   ================================================================ */
function ManagersSection({ workspaces, users, loading }: {
  workspaces: AdminWorkspace[]; users: User[]; loading: boolean;
}) {
  if (loading) return <LoadingBlock label="Loading..." />;

  // Group workspaces by owner
  const managers = users.filter((u) => u.role === 'manager' || u.role === 'admin');
  const wsByOwner: Record<string, AdminWorkspace[]> = {};
  for (const ws of workspaces) {
    const oid = ws.owner.id;
    if (!wsByOwner[oid]) wsByOwner[oid] = [];
    wsByOwner[oid].push(ws);
  }

  if (managers.length === 0) return <EmptyBlock label="No managers found" padded />;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {managers.map((mgr) => {
        const owned = wsByOwner[mgr.id] || [];
        const totalQueries = owned.reduce((s, w) => s + w.metrics.total_queries, 0);
        const totalCost = owned.reduce((s, w) => s + w.metrics.total_cost, 0);
        const totalMembers = owned.reduce((s, w) => s + w.member_count, 0);
        return (
          <div key={mgr.id} className="rounded-xl border border-navy-100 bg-white p-5 shadow-sm">
            {/* Header */}
            <div className="flex items-center gap-3">
              <Avatar name={mgr.name} url={mgr.avatar_url} size={40} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-navy-900">{mgr.name}</div>
                <div className="truncate text-xs text-navy-500">{mgr.email}</div>
              </div>
              <RoleBadge role={mgr.role} />
              <StatusBadge status={mgr.status} />
            </div>

            {/* Stats */}
            <div className="mt-4 grid grid-cols-4 gap-2">
              {[
                { lbl: 'Workspaces', val: owned.length },
                { lbl: 'Members', val: totalMembers },
                { lbl: 'Queries', val: totalQueries },
                { lbl: 'Cost', val: `$${totalCost.toFixed(2)}` },
              ].map((s) => (
                <div key={s.lbl} className="rounded-lg bg-navy-50 px-2 py-2 text-center">
                  <div className="text-base font-semibold text-navy-900">{s.val}</div>
                  <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-navy-500">{s.lbl}</div>
                </div>
              ))}
            </div>

            {/* Owned workspaces */}
            {owned.length > 0 && (
              <div className="mt-4 border-t border-navy-100 pt-3">
                <h5 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-navy-500">
                  <BarChart3 size={12} /> Workspaces
                </h5>
                <div className="space-y-1.5">
                  {owned.map((ws) => (
                    <div key={ws.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-navy-50/50 px-2.5 py-1.5">
                      <span className="flex-1 truncate text-sm font-medium text-navy-800">{ws.name}</span>
                      <MiniStat icon={<Users size={11} />} value={ws.member_count} />
                      <MiniStat icon={<Database size={11} />} value={ws.connection_count} />
                      <MiniStat icon={<MessageSquare size={11} />} value={ws.metrics.total_queries} />
                      <MiniStat icon={<DollarSign size={11} />} value={`$${ws.metrics.total_cost.toFixed(2)}`} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ================================================================
   SECTION: Users
   ================================================================ */
function UsersSection({ users, loading, onAction, headers }: {
  users: User[]; loading: boolean;
  onAction: (action: string, userId: string, payload?: Record<string, unknown>) => Promise<void>;
  headers: () => Record<string, string>;
}) {
  const [filter, setFilter] = useState<UserFilter>('all');
  const [limitsUser, setLimitsUser] = useState<User | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const filtered = filter === 'all' ? users : users.filter((u) => u.status === filter);
  const counts = {
    all: users.length,
    pending: users.filter((u) => u.status === 'pending').length,
    active: users.filter((u) => u.status === 'active').length,
    suspended: users.filter((u) => u.status === 'suspended').length,
  };

  const handleAction = async (action: string, userId: string, payload?: Record<string, unknown>) => {
    setActionLoading(userId);
    await onAction(action, userId, payload);
    setActionLoading(null);
    setDeleteConfirm(null);
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await fetch(`${API_BASE}/api/admin/users/${userId}`, {
        method: 'PUT', headers: headers(), body: JSON.stringify({ role: newRole }),
      });
      await onAction('refresh', '');
    } catch { /* ignore */ }
  };

  if (loading) return <LoadingBlock label="Loading users..." />;

  const tabs: UserFilter[] = ['all', 'pending', 'active', 'suspended'];

  const actionBtnBase = "inline-flex h-7 w-7 items-center justify-center rounded-md border transition-colors";
  const actionBtnNeutral = `${actionBtnBase} border-navy-200 bg-white text-navy-600 hover:bg-navy-50`;
  const actionBtnSuccess = `${actionBtnBase} border-success-200 bg-success-50 text-success-700 hover:bg-success-100`;
  const actionBtnWarn = `${actionBtnBase} border-warn-200 bg-warn-50 text-warn-700 hover:bg-warn-100`;
  const actionBtnDanger = `${actionBtnBase} border-danger-200 bg-danger-50 text-danger-700 hover:bg-danger-100`;

  return (
    <div className="space-y-5">
      {/* Tabs (underline style) */}
      <div className="flex flex-wrap items-center gap-1 border-b border-navy-100">
        {tabs.map((f) => {
          const active = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? 'border-accent-500 text-accent-700'
                  : 'border-transparent text-navy-500 hover:text-navy-800'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              <span
                className={`inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                  active ? 'bg-accent-100 text-accent-700' : 'bg-navy-100 text-navy-600'
                }`}
              >
                {counts[f]}
              </span>
            </button>
          );
        })}
      </div>

      <TableShell>
        <thead>
          <tr>
            <th className={TH_CLS}>User</th>
            <th className={TH_CLS}>Role</th>
            <th className={TH_CLS}>Status</th>
            <th className={TH_CLS}>Questions Today</th>
            <th className={TH_CLS}>Tokens Today</th>
            <th className={TH_CLS}>Cost (Month)</th>
            <th className={TH_CLS}>Expiry</th>
            <th className={TH_CLS}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((u) => (
            <tr key={u.id} className={TR_CLS}>
              <td className={TD_CLS}>
                <div className="flex items-center gap-3">
                  <Avatar name={u.name} url={u.avatar_url} size={28} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-navy-800">{u.name}</div>
                    <div className="truncate text-xs text-navy-500">{u.email}</div>
                  </div>
                </div>
              </td>
              <td className={TD_CLS}>
                <select
                  className="rounded-md border border-navy-200 bg-white px-2 py-1 text-xs font-medium text-navy-700 focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-100"
                  value={u.role}
                  onChange={(e) => handleRoleChange(u.id, e.target.value)}
                >
                  <option value="user">User</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </td>
              <td className={TD_CLS}><StatusBadge status={u.status} /></td>
              <td className={TD_CLS}>{u.today_questions}</td>
              <td className={TD_CLS}>{u.today_tokens?.toLocaleString()}</td>
              <td className={TD_CLS}>${u.month_cost_usd?.toFixed(2)}</td>
              <td className={TD_CLS}>{u.expiry_date || '--'}</td>
              <td className={TD_CLS}>
                <div className="flex items-center gap-1.5">
                  {actionLoading === u.id ? (
                    <Loader2 size={14} className="animate-spin text-accent-500" />
                  ) : deleteConfirm === u.id ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-danger-600">Delete?</span>
                      <button
                        className="rounded-md bg-danger-500 px-2 py-1 text-[11px] font-semibold text-white hover:bg-danger-600"
                        onClick={() => handleAction('delete', u.id)}
                      >
                        Yes
                      </button>
                      <button
                        className="rounded-md border border-navy-200 bg-white px-2 py-1 text-[11px] font-semibold text-navy-700 hover:bg-navy-50"
                        onClick={() => setDeleteConfirm(null)}
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <>
                      {u.status === 'pending' && (
                        <button className={actionBtnSuccess} title="Approve" onClick={() => handleAction('approve', u.id)}>
                          <Check size={14} />
                        </button>
                      )}
                      {u.status !== 'suspended' && (
                        <button className={actionBtnWarn} title="Suspend" onClick={() => handleAction('suspend', u.id)}>
                          <AlertTriangle size={14} />
                        </button>
                      )}
                      {u.status === 'suspended' && (
                        <button className={actionBtnSuccess} title="Reactivate" onClick={() => handleAction('approve', u.id)}>
                          <Check size={14} />
                        </button>
                      )}
                      <button className={actionBtnNeutral} title="Set Limits" onClick={() => setLimitsUser(u)}>
                        <Settings size={14} />
                      </button>
                      <button className={actionBtnDanger} title="Delete" onClick={() => setDeleteConfirm(u.id)}>
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-10 text-center text-sm text-navy-500">
                No users found
              </td>
            </tr>
          )}
        </tbody>
      </TableShell>

      {limitsUser && (
        <LimitsModal
          user={limitsUser}
          onClose={() => setLimitsUser(null)}
          onSave={async (limits) => { await onAction('limits', limitsUser.id, limits); }}
        />
      )}
    </div>
  );
}

/* ================================================================
   SECTION: Usage
   ================================================================ */
function UsageSection({ usage, loading }: { usage: UsageEntry[]; loading: boolean }) {
  if (loading) return <LoadingBlock label="Loading usage..." />;
  return (
    <TableShell>
      <thead>
        <tr>
          <th className={TH_CLS}>User</th>
          <th className={TH_CLS}>Questions</th>
          <th className={TH_CLS}>Tokens</th>
          <th className={TH_CLS}>Cost</th>
          <th className={TH_CLS}>Model</th>
          <th className={TH_CLS}>Time</th>
        </tr>
      </thead>
      <tbody>
        {usage.map((entry, i) => (
          <tr key={i} className={TR_CLS}>
            <td className={TD_CLS}>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-navy-800">{entry.user_name}</div>
                <div className="truncate text-xs text-navy-500">{entry.user_email}</div>
              </div>
            </td>
            <td className={TD_CLS}>{entry.questions}</td>
            <td className={TD_CLS}>{entry.tokens?.toLocaleString()}</td>
            <td className={TD_CLS}>${entry.cost_usd?.toFixed(4)}</td>
            <td className={TD_CLS}>
              <span className="inline-flex items-center rounded-md bg-navy-100 px-2 py-0.5 font-mono text-[11px] font-medium text-navy-700">
                {entry.model}
              </span>
            </td>
            <td className={`${TD_CLS} whitespace-nowrap text-navy-500`}>
              {new Date(entry.timestamp).toLocaleString()}
            </td>
          </tr>
        ))}
        {usage.length === 0 && (
          <tr>
            <td colSpan={6} className="px-4 py-10 text-center text-sm text-navy-500">
              No usage data
            </td>
          </tr>
        )}
      </tbody>
    </TableShell>
  );
}

/* ================================================================
   MAIN: Admin Dashboard
   ================================================================ */
export default function AdminDashboard() {
  const navigate = useNavigate();
  const { headers } = useAdminApi();
  const user = useAuthStore((s) => s.user);
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);

  const openWorkspace = (id: string) => {
    setActiveWorkspace(id);
    navigate(`/workspace/${id}`);
  };

  const role = user?.role || 'user';
  const isAdmin = role === 'admin';

  // Non-admins default to workspaces view
  const [section, setSection] = useState<Section>(isAdmin ? 'dashboard' : 'workspaces');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [workspaces, setWorkspaces] = useState<AdminWorkspace[]>([]);
  const [usage, setUsage] = useState<UsageEntry[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(true);
  const [wsLoading, setWsLoading] = useState(true);
  const [usageLoading, setUsageLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchStats = useCallback(async () => {
    if (!isAdmin) { setStatsLoading(false); return; }
    setStatsLoading(true);
    try { const r = await fetch(`${API_BASE}/api/admin/stats`, { headers: headers() }); if (r.ok) setStats(await r.json()); } catch {}
    setStatsLoading(false);
  }, [headers, isAdmin]);

  const fetchUsers = useCallback(async () => {
    if (!isAdmin) { setUsersLoading(false); return; }
    setUsersLoading(true);
    try { const r = await fetch(`${API_BASE}/api/admin/users`, { headers: headers() }); if (r.ok) setUsers(await r.json()); } catch {}
    setUsersLoading(false);
  }, [headers, isAdmin]);

  const fetchWorkspaces = useCallback(async () => {
    // Skip if no auth token available yet (zustand hydration pending)
    const h = headers();
    if (!h['Authorization']) { return; }
    setWsLoading(true);
    try {
      // Admins get enriched workspace data, others get regular workspace list
      const url = isAdmin ? `${API_BASE}/api/admin/workspaces` : `${API_BASE}/api/workspaces`;
      const r = await fetch(url, { headers: h });
      if (r.ok) {
        const data = await r.json();
        if (isAdmin) {
          setWorkspaces(data);
        } else {
          // Map regular workspace format to AdminWorkspace shape
          setWorkspaces((data.workspaces || data).map((ws: Record<string, unknown>) => ({
            id: ws.id, name: ws.name, description: ws.description || '',
            owner: { id: ws.owner_id || '', name: '', email: '', role: 'manager', avatar_url: '' },
            members: (ws.members as Array<Record<string, string>>) || [],
            member_count: ((ws.members as unknown[]) || []).length,
            connection_count: 0, api_tools_count: 0,
            created_at: ws.created_at || '', last_active_at: '',
            metrics: { total_queries: 0, total_tokens: 0, total_cost: 0 },
          })));
        }
      }
    } catch {}
    setWsLoading(false);
  }, [headers, isAdmin]);

  const fetchUsage = useCallback(async () => {
    if (!isAdmin) { setUsageLoading(false); return; }
    setUsageLoading(true);
    try { const r = await fetch(`${API_BASE}/api/admin/usage`, { headers: headers() }); if (r.ok) setUsage(await r.json()); } catch {}
    setUsageLoading(false);
  }, [headers, isAdmin]);

  useEffect(() => { fetchWorkspaces(); if (isAdmin) { fetchStats(); fetchUsers(); } }, [fetchStats, fetchWorkspaces, fetchUsers, isAdmin]);
  useEffect(() => { if (section === 'usage') fetchUsage(); }, [section, fetchUsage]);

  const refreshAll = () => { fetchStats(); fetchWorkspaces(); fetchUsers(); if (section === 'usage') fetchUsage(); };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const deleteWorkspace = (id: string, name: string) => {
    setDeleteConfirm({ id, name });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/workspaces/${deleteConfirm.id}`, { method: 'DELETE', headers: headers() });
      if (res.ok) {
        showToast(`Workspace "${deleteConfirm.name}" deleted successfully`, 'success');
        fetchWorkspaces();
        fetchStats();
      } else {
        const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
        showToast(err.detail || 'Failed to delete workspace', 'error');
      }
    } catch (e) {
      showToast(`Network error: ${e}`, 'error');
    }
    setDeleting(false);
    setDeleteConfirm(null);
  };

  const handleUserAction = async (action: string, userId: string, payload?: Record<string, unknown>) => {
    try {
      if (action === 'refresh') { await Promise.all([fetchStats(), fetchUsers(), fetchWorkspaces()]); return; }
      if (action === 'approve') await fetch(`${API_BASE}/api/admin/users/${userId}`, { method: 'PUT', headers: headers(), body: JSON.stringify({ status: 'active' }) });
      else if (action === 'suspend') await fetch(`${API_BASE}/api/admin/users/${userId}`, { method: 'PUT', headers: headers(), body: JSON.stringify({ status: 'suspended' }) });
      else if (action === 'limits') await fetch(`${API_BASE}/api/admin/users/${userId}`, { method: 'PUT', headers: headers(), body: JSON.stringify(payload) });
      else if (action === 'delete') await fetch(`${API_BASE}/api/admin/users/${userId}`, { method: 'DELETE', headers: headers() });
      await Promise.all([fetchStats(), fetchUsers(), fetchWorkspaces()]);
    } catch {}
  };

  const sectionMeta: Record<Section, { title: string; subtitle: string; icon: typeof LayoutDashboard }> = {
    dashboard: { title: 'Admin Dashboard', subtitle: 'Platform-wide overview of users, workspaces, and activity', icon: LayoutDashboard },
    workspaces: { title: 'Workspaces', subtitle: 'Manage workspaces, members, and data connections', icon: Building2 },
    managers: { title: 'Managers', subtitle: 'Manager accounts and the workspaces they own', icon: UserCog },
    users: { title: 'User Management', subtitle: 'Review accounts, quotas, and access', icon: Users },
    usage: { title: 'Usage Logs', subtitle: 'Per-query token and cost history', icon: ScrollText },
  };

  const meta = sectionMeta[section];

  // Build section tab strip (shown inside the page, above content)
  const availableSections: Section[] = isAdmin
    ? ['dashboard', 'workspaces', 'managers', 'users', 'usage']
    : ['workspaces', 'usage'];

  const topbarActions = (
    <button
      onClick={refreshAll}
      className="inline-flex items-center gap-2 rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm font-medium text-navy-700 transition-colors hover:bg-navy-50"
    >
      <RefreshCw size={14} /> Refresh
    </button>
  );

  return (
    <AppLayout title={meta.title} subtitle={meta.subtitle} actions={topbarActions} activePath="/admin">
      <div className="space-y-6">
        {/* Section tab strip */}
        <div className="flex flex-wrap items-center gap-1 border-b border-navy-100">
          {availableSections.map((key) => {
            const m = sectionMeta[key];
            const Icon = m.icon;
            const active = section === key;
            return (
              <button
                key={key}
                onClick={() => setSection(key)}
                className={`-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? 'border-accent-500 text-accent-700'
                    : 'border-transparent text-navy-500 hover:text-navy-800'
                }`}
              >
                <Icon size={15} />
                {m.title === 'Admin Dashboard' ? 'Dashboard' : m.title}
              </button>
            );
          })}
        </div>

        {/* Section content */}
        {section === 'dashboard' && (
          <DashboardSection
            stats={stats}
            workspaces={workspaces}
            loading={statsLoading && wsLoading}
            onOpenWorkspace={openWorkspace}
          />
        )}
        {section === 'workspaces' && (
          <WorkspacesSection
            workspaces={workspaces}
            loading={wsLoading}
            onOpenWorkspace={openWorkspace}
            onDeleteWorkspace={deleteWorkspace}
            headers={headers()}
            onRefresh={refreshAll}
          />
        )}
        {section === 'managers' && (
          <ManagersSection workspaces={workspaces} users={users} loading={usersLoading && wsLoading} />
        )}
        {section === 'users' && (
          <UsersSection users={users} loading={usersLoading} onAction={handleUserAction} headers={headers} />
        )}
        {section === 'usage' && <UsageSection usage={usage} loading={usageLoading} />}
      </div>

      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm shadow-lg ${
            toast.type === 'success'
              ? 'border-success-200 bg-white text-success-700'
              : 'border-danger-200 bg-white text-danger-700'
          }`}
        >
          {toast.type === 'success' ? (
            <Check size={16} className="text-success-500" />
          ) : (
            <AlertTriangle size={16} className="text-danger-500" />
          )}
          <span className="font-medium">{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-2 rounded p-1 text-navy-400 hover:bg-navy-50 hover:text-navy-700"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/50 p-4 backdrop-blur-sm"
          onClick={() => !deleting && setDeleteConfirm(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-danger-50 text-danger-600 ring-1 ring-danger-200">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-navy-900">Delete Workspace</h3>
                <p className="text-xs text-navy-500">This action cannot be undone</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-navy-700">
              Are you sure you want to delete <strong className="font-semibold text-navy-900">{deleteConfirm.name}</strong>?
              All sessions, canvas data, and analytics for this workspace will be permanently removed.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                className="rounded-lg border border-navy-200 bg-white px-4 py-2 text-sm font-medium text-navy-700 transition-colors hover:bg-navy-50 disabled:opacity-60"
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-lg bg-danger-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-danger-600 disabled:opacity-60"
                onClick={confirmDelete}
                disabled={deleting}
              >
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {deleting ? 'Deleting...' : 'Delete Workspace'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
