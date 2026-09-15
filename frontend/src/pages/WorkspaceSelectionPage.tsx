import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  BarChart3,
  Database,
  Sparkles,
  Search,
  FolderOpen,
} from 'lucide-react';
import { useWorkspaceStore } from '../store/workspaceStore';
import { useAuthStore } from '../store/authStore';
import AppLayout from '../components/layout/AppLayout';
import CreateWorkspaceDialog from '../components/workspace/CreateWorkspaceDialog';
import WorkspaceCard from '../components/workspace/WorkspaceCard';
import type { CreateWorkspaceResult } from '../components/workspace/CreateWorkspaceDialog';
import type { ConnectionInfo } from '../types/connection';
import { createWorkspaceOnBackend } from '../services/api';

export default function WorkspaceSelectionPage() {
  const navigate = useNavigate();
  const userName = useAuthStore((s) => s.user?.name || 'User');
  const isPrivileged = useAuthStore((s) => s.isPrivileged);
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const {
    workspaces,
    setActiveWorkspace,
    createWorkspace,
    deleteWorkspace,
    addConnectionToWorkspace,
    loadWorkspacesFromBackend,
  } = useWorkspaceStore();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      refreshUser();
      loadWorkspacesFromBackend();
    }
  }, [isAuthenticated, refreshUser, loadWorkspacesFromBackend]);

  const sortedWorkspaces = [...workspaces]
    .sort((a, b) => b.lastActiveAt - a.lastActiveAt)
    .filter((ws) => !search || ws.name.toLowerCase().includes(search.toLowerCase()));
  const totalSources = workspaces.reduce((sum, w) => sum + w.connectionIds.length, 0);

  const handleSelectWorkspace = (id: string) => {
    setActiveWorkspace(id);
    navigate(`/workspace/${id}`);
  };

  const handleDeleteWorkspace = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteWorkspace(id);
  };

  const handleCreate = async (data: CreateWorkspaceResult): Promise<string> => {
    let backendId: string | undefined;
    try {
      const doc = await createWorkspaceOnBackend({
        name: data.name,
        description: data.description || '',
        icon: data.icon || 'bar-chart-3',
      });
      backendId = doc.id as string;
    } catch {
      /* fallback */
    }

    const ws = createWorkspace({
      name: data.name,
      description: data.description,
      icon: data.icon,
      backendId,
    } as Parameters<typeof createWorkspace>[0]);
    setActiveWorkspace(ws.id);

    if (data.connection) {
      const { id, config, selectedTables, schema } = data.connection;
      const connInfo: ConnectionInfo = {
        id,
        name: config.name,
        connectorType: config.connectorType,
        host: 'host' in config ? config.host : 'endpoint' in config ? config.endpoint : 'local',
        database: 'database' in config ? config.database : config.name,
        status: 'connected',
        selectedTableNames: selectedTables,
        schema,
      };
      addConnectionToWorkspace(ws.id, connInfo);
    }
    return ws.id;
  };

  const handleNavigateToWorkspace = (workspaceId: string) => {
    setShowCreateDialog(false);
    navigate(`/workspace/${workspaceId}`);
  };

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();
  const firstName = userName.split(' ')[0];

  const actions = isPrivileged ? (
    <button
      type="button"
      onClick={() => setShowCreateDialog(true)}
      className="flex items-center gap-1.5 rounded-lg bg-accent-500 px-3 py-1.5 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-accent-600"
    >
      <Plus className="h-4 w-4" />
      New workspace
    </button>
  ) : null;

  return (
    <AppLayout
      title="Workspaces"
      subtitle="Browse, open, and manage your analytical workspaces"
      actions={actions}
    >
      {/* Hero strip */}
      <section className="mb-8 rounded-2xl border border-navy-100 bg-gradient-to-br from-navy-900 via-navy-900 to-navy-800 p-7 text-white shadow-sm">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[12.5px] font-semibold uppercase tracking-[0.15em] text-accent-400">
              Home
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-[28px]">
              {greeting}, {firstName}
            </h2>
            <p className="mt-1.5 max-w-xl text-[13.5px] text-navy-300">
              Pick a workspace to resume your analysis — or start a new one to connect a fresh data
              source.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <StatPill icon={BarChart3} label="Workspaces" value={workspaces.length} />
            <StatPill icon={Database} label="Sources" value={totalSources} />
            <StatPill icon={Sparkles} label="Insights" value={0} />
          </div>
        </div>
      </section>

      {/* Toolbar */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-[15px] font-semibold tracking-tight text-navy-900">
          Your workspaces
          <span className="ml-2 text-[12px] font-normal text-navy-400">
            ({sortedWorkspaces.length})
          </span>
        </h3>

        <div className="relative max-w-sm flex-1 sm:flex-initial sm:basis-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400" />
          <input
            type="text"
            placeholder="Search workspaces…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-navy-200 bg-white py-2 pl-9 pr-3 text-[13px] text-navy-800 placeholder:text-navy-400 shadow-sm transition-colors focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-100"
          />
        </div>
      </div>

      {/* Grid */}
      {sortedWorkspaces.length === 0 && !isPrivileged ? (
        <EmptyState canCreate={false} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sortedWorkspaces.map((ws, i) => (
            <WorkspaceCard
              key={ws.id}
              workspace={ws}
              index={i}
              onClick={() => handleSelectWorkspace(ws.id)}
              onDelete={isPrivileged ? (e) => handleDeleteWorkspace(e, ws.id) : undefined}
            />
          ))}
          {isPrivileged && (
            <button
              type="button"
              onClick={() => setShowCreateDialog(true)}
              className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-navy-200 bg-white/40 p-6 text-navy-500 transition-all hover:border-accent-300 hover:bg-accent-50 hover:text-accent-700"
              style={{ minHeight: 200 }}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-accent-600 ring-1 ring-inset ring-accent-200">
                <Plus className="h-5 w-5" />
              </div>
              <p className="text-[14px] font-semibold">New workspace</p>
              <p className="max-w-[180px] text-center text-[12px] text-navy-400">
                Start a new data exploration
              </p>
            </button>
          )}
        </div>
      )}

      <CreateWorkspaceDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreate={handleCreate}
        onNavigate={handleNavigateToWorkspace}
      />
    </AppLayout>
  );
}

function StatPill({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof BarChart3;
  label: string;
  value: number;
}) {
  return (
    <div className="flex min-w-[90px] flex-col rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 backdrop-blur-sm">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-navy-300">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-1 text-[22px] font-bold leading-none tracking-tight text-white">
        {value}
      </div>
    </div>
  );
}

function EmptyState({ canCreate }: { canCreate: boolean }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-navy-200 bg-white py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-navy-50 text-navy-400">
        <FolderOpen className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-[15px] font-semibold text-navy-800">No workspaces yet</h3>
      <p className="mt-1 max-w-sm text-[13px] text-navy-500">
        {canCreate
          ? 'Create your first workspace to connect data and start asking questions.'
          : 'Your administrator needs to invite you to a workspace before you can get started.'}
      </p>
    </div>
  );
}
