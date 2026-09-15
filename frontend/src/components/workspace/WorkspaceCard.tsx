import {
  BarChart3,
  Users,
  Settings,
  Wallet,
  Database,
  FolderOpen,
  ArrowUpRight,
  Clock,
  Trash2,
} from 'lucide-react';
import type { Workspace } from '../../types/workspace';

interface WorkspaceCardProps {
  workspace: Workspace;
  onClick: () => void;
  onDelete?: (e: React.MouseEvent) => void;
  index?: number;
}

const ICON_MAP: Record<string, typeof BarChart3> = {
  'bar-chart-3': BarChart3,
  users: Users,
  settings: Settings,
  wallet: Wallet,
  database: Database,
  folder: FolderOpen,
};

/** Each icon gets a distinct accent color from our palette. */
const TONES: Record<string, { bg: string; ring: string; fg: string; bar: string }> = {
  'bar-chart-3': { bg: 'bg-accent-50', ring: 'ring-accent-200', fg: 'text-accent-700', bar: 'bg-accent-500' },
  users: { bg: 'bg-emerald-50', ring: 'ring-emerald-200', fg: 'text-emerald-700', bar: 'bg-emerald-500' },
  settings: { bg: 'bg-amber-50', ring: 'ring-amber-200', fg: 'text-amber-700', bar: 'bg-amber-500' },
  wallet: { bg: 'bg-violet-50', ring: 'ring-violet-200', fg: 'text-violet-700', bar: 'bg-violet-500' },
  database: { bg: 'bg-cyan-50', ring: 'ring-cyan-200', fg: 'text-cyan-700', bar: 'bg-cyan-500' },
  folder: { bg: 'bg-rose-50', ring: 'ring-rose-200', fg: 'text-rose-700', bar: 'bg-rose-500' },
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

export default function WorkspaceCard({ workspace, onClick, onDelete, index = 0 }: WorkspaceCardProps) {
  const Icon = ICON_MAP[workspace.icon] || FolderOpen;
  const tone = TONES[workspace.icon] || TONES['bar-chart-3'];
  const sourceCount = workspace.connectionIds.length;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border border-navy-100 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-accent-200 hover:shadow-[0_14px_32px_-8px_rgba(15,23,42,0.12)] focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 animate-fade-slide-in"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Top accent bar */}
      <div className={`h-1 w-full ${tone.bar}`} />

      <div className="flex flex-1 flex-col p-5">
        {/* Head */}
        <div className="flex items-start justify-between">
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-xl ring-1 ring-inset ${tone.bg} ${tone.ring} ${tone.fg}`}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex items-center gap-1">
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="flex h-7 w-7 items-center justify-center rounded-md text-navy-400 opacity-0 transition-all hover:bg-danger-50 hover:text-danger-600 group-hover:opacity-100"
                title="Delete workspace"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
            <div className="flex h-7 w-7 items-center justify-center rounded-md text-navy-300 transition-colors group-hover:bg-accent-50 group-hover:text-accent-600">
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </div>
          </div>
        </div>

        {/* Title + description */}
        <h3 className="mt-4 line-clamp-1 text-[15.5px] font-semibold tracking-tight text-navy-900">
          {workspace.name}
        </h3>
        <p className="mt-1 line-clamp-2 min-h-[34px] text-[13px] leading-relaxed text-navy-500">
          {workspace.description || 'No description provided'}
        </p>

        {/* Footer meta */}
        <div className="mt-5 flex items-center justify-between border-t border-navy-100 pt-3 text-[11.5px] text-navy-500">
          <span className="inline-flex items-center gap-1.5">
            <Database className="h-3 w-3" />
            {sourceCount} source{sourceCount !== 1 ? 's' : ''}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            {timeAgo(workspace.lastActiveAt)}
          </span>
        </div>
      </div>
    </div>
  );
}
