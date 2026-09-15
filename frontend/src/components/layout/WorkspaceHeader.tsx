import { Database, FileText, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Workspace } from '../../types/workspace';
import type { ConnectionInfo } from '../../types/connection';
import ProfileStatus from '../workspace/ProfileStatus';
import { useAuthStore } from '../../store/authStore';

interface WorkspaceHeaderProps {
  workspace: Workspace;
  activeConnection: ConnectionInfo | null;
  onOpenConnectionDialog: () => void;
}

export default function WorkspaceHeader({
  workspace,
  activeConnection,
  onOpenConnectionDialog,
}: WorkspaceHeaderProps) {
  const navigate = useNavigate();
  const isPrivileged = useAuthStore((s) => s.isPrivileged);
  const isConnected = !!activeConnection;

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-navy-100 bg-white px-5">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button
          onClick={() => navigate('/')}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-navy-400 transition-colors hover:bg-navy-50 hover:text-navy-700"
          title="Back to workspaces"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold leading-tight text-navy-900">
            {workspace.name}
          </p>
          {workspace.description && (
            <p className="truncate text-[11.5px] leading-tight text-navy-500">
              {workspace.description}
            </p>
          )}
        </div>
        {isPrivileged && activeConnection && (
          <div className="ml-2 shrink-0">
            <ProfileStatus
              workspaceId={workspace.id}
              connectionId={activeConnection.id}
              connectionName={activeConnection.name || activeConnection.database}
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onOpenConnectionDialog}
          className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
            isConnected
              ? 'bg-success-50 text-success-700 ring-1 ring-inset ring-success-500/25 hover:bg-emerald-100'
              : 'bg-navy-50 text-navy-600 ring-1 ring-inset ring-navy-200 hover:bg-navy-100'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isConnected ? 'bg-success-500 animate-pulse-glow' : 'bg-navy-400'
            }`}
          />
          {activeConnection?.connectorType === 'file' ? (
            <FileText className="h-3.5 w-3.5" />
          ) : (
            <Database className="h-3.5 w-3.5" />
          )}
          <span className="truncate max-w-[180px]">
            {activeConnection ? activeConnection.name || activeConnection.database : 'Connect data'}
          </span>
        </button>
      </div>
    </header>
  );
}
