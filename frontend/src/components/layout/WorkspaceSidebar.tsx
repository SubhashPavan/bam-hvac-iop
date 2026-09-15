import { useState, useRef, useEffect } from 'react';
import { MessageSquare, Plus, Trash2, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import type { ChatSession } from '../../types/chat';

interface WorkspaceSidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onRenameSession?: (sessionId: string, title: string) => void;
  onDeleteSession?: (sessionId: string) => void;
  onClearAllSessions?: () => void;
  /** Initial collapsed state */
  defaultCollapsed?: boolean;
}

export default function WorkspaceSidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onRenameSession,
  onDeleteSession,
  onClearAllSessions,
  defaultCollapsed = false,
}: WorkspaceSidebarProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const sortedSessions = [...sessions].sort((a, b) => b.createdAt - a.createdAt);

  const todayStart = new Date().setHours(0, 0, 0, 0);
  const yesterdayStart = todayStart - 86400000;

  const today = sortedSessions.filter((s) => s.createdAt >= todayStart);
  const yesterday = sortedSessions.filter(
    (s) => s.createdAt >= yesterdayStart && s.createdAt < todayStart
  );
  const older = sortedSessions.filter((s) => s.createdAt < yesterdayStart);

  const renderGroup = (label: string, items: ChatSession[]) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-5">
        <p className="px-3 mb-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-navy-400">
          {label}
        </p>
        <div className="space-y-px">
          {items.map((session) => (
            <SessionItem
              key={session.id}
              session={session}
              isActive={session.id === activeSessionId}
              onSelect={() => onSelectSession(session.id)}
              onRename={
                onRenameSession ? (title: string) => onRenameSession(session.id, title) : undefined
              }
              onDelete={onDeleteSession ? () => onDeleteSession(session.id) : undefined}
            />
          ))}
        </div>
      </div>
    );
  };

  /* ── Collapsed ── */
  if (collapsed) {
    return (
      <aside className="flex w-[52px] shrink-0 flex-col items-center gap-1 border-r border-navy-100 bg-white py-3">
        <button
          className="flex h-9 w-9 items-center justify-center rounded-lg text-navy-500 transition-colors hover:bg-navy-50 hover:text-navy-800"
          onClick={() => setCollapsed(false)}
          title="Expand chat history"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
        <button
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-500 text-white transition-colors hover:bg-accent-600"
          onClick={onNewChat}
          title="New chat"
        >
          <Plus className="h-4 w-4" />
        </button>
        {sessions.length > 0 && (
          <button
            className="relative flex h-9 w-9 items-center justify-center rounded-lg text-navy-500 transition-colors hover:bg-navy-50 hover:text-navy-800"
            onClick={() => setCollapsed(false)}
            title={`${sessions.length} conversation${sessions.length === 1 ? '' : 's'}`}
          >
            <MessageSquare className="h-4 w-4" />
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-500 px-1 text-[10px] font-semibold text-white">
              {sessions.length}
            </span>
          </button>
        )}
      </aside>
    );
  }

  /* ── Expanded ── */
  return (
    <aside className="flex w-[260px] shrink-0 flex-col border-r border-navy-100 bg-white">
      {/* Top bar */}
      <div className="flex items-center gap-2 border-b border-navy-100 p-3">
        <button
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-navy-500 transition-colors hover:bg-navy-50 hover:text-navy-800"
          onClick={() => setCollapsed(true)}
          title="Collapse sidebar"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
        <button
          onClick={onNewChat}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent-500 px-3 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-accent-600"
        >
          <Plus className="h-4 w-4" />
          New chat
        </button>
      </div>

      {/* Session list */}
      <div className="custom-scrollbar flex-1 overflow-y-auto px-2 py-3">
        {sortedSessions.length === 0 ? (
          <div className="flex flex-col items-center px-3 py-14 text-center">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-navy-50 text-navy-300">
              <MessageSquare className="h-5 w-5" />
            </div>
            <p className="text-[12.5px] leading-relaxed text-navy-400">
              Your conversations
              <br />
              will appear here
            </p>
          </div>
        ) : (
          <>
            {renderGroup('Today', today)}
            {renderGroup('Yesterday', yesterday)}
            {renderGroup('Previous', older)}
          </>
        )}
      </div>

      {/* Footer */}
      {sessions.length > 0 && onClearAllSessions && (
        <div className="border-t border-navy-100 p-2">
          <button
            className="flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[11.5px] font-medium text-navy-500 transition-colors hover:bg-danger-50 hover:text-danger-600"
            onClick={onClearAllSessions}
            title="Clear all chat history"
          >
            <Trash2 className="h-3 w-3" />
            Clear all history
          </button>
        </div>
      )}
    </aside>
  );
}

/* ─── SessionItem ─── */
function SessionItem({
  session,
  isActive,
  onSelect,
  onRename,
  onDelete,
}: {
  session: ChatSession;
  isActive: boolean;
  onSelect: () => void;
  onRename?: (title: string) => void;
  onDelete?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(session.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleDoubleClick = () => {
    if (onRename) {
      setEditValue(session.title);
      setEditing(true);
    }
  };

  const handleSave = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== session.title && onRename) {
      onRename(trimmed);
    }
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') setEditing(false);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) onDelete();
  };

  if (editing) {
    return (
      <div
        className={`flex items-center rounded-lg px-3 py-2 ${
          isActive ? 'bg-accent-50 ring-1 ring-accent-200' : ''
        }`}
      >
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="w-full border-0 bg-transparent p-0 text-[13px] text-navy-900 outline-none"
        />
      </div>
    );
  }

  return (
    <div
      className={`group flex items-center rounded-lg transition-colors ${
        isActive
          ? 'bg-accent-50 text-accent-700'
          : 'text-navy-600 hover:bg-navy-50 hover:text-navy-900'
      }`}
    >
      <button
        onClick={onSelect}
        onDoubleClick={handleDoubleClick}
        className="min-w-0 flex-1 truncate px-3 py-2 text-left text-[13px] leading-snug"
        title="Double-click to rename"
      >
        {session.title}
      </button>
      {onDelete && (
        <button
          className="mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-navy-400 opacity-0 transition-all hover:bg-danger-50 hover:text-danger-600 group-hover:opacity-100"
          onClick={handleDelete}
          title="Delete chat"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
