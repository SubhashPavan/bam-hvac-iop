import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Zap, Brain, LayoutDashboard } from 'lucide-react';
import { useChat } from '../hooks/useChat';
import { useChatStore } from '../store/chatStore';
import { useWorkspaceStore } from '../store/workspaceStore';
import { useCanvasStore } from '../store/canvasStore';
import { useWorkspaceSync } from '../hooks/useWorkspaceSync';
import WorkspaceHeader from '../components/layout/WorkspaceHeader';
import WorkspaceSidebar from '../components/layout/WorkspaceSidebar';
import AppSidebar from '../components/layout/AppSidebar';
import SplitPanel from '../components/layout/SplitPanel';
import ChatPanel from '../components/chat/ChatPanel';
import CanvasPanel from '../components/canvas/CanvasPanel';
import ConnectionDialog from '../components/connections/ConnectionDialog';
import ConfirmDialog from '../components/common/ConfirmDialog';
import MetricsBar from '../components/workspace/MetricsBar';
import DeepInsightView from '../components/workspace/DeepInsightView';
import DashboardsTabContent from '../components/workspace/DashboardsTabContent';
import type { ConnectionInfo } from '../types/connection';
import type { InsightResult } from '../types/chat';
import { refreshQuery } from '../services/api';

type WorkspaceMode = 'quick' | 'deep' | 'dashboards';

export default function WorkspaceView() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  // Allow other pages (e.g. DashboardViewPage's back arrow) to return here
  // with a specific tab pre-selected via `navigate(path, { state: { tab } })`.
  const initialTab = (location.state as { tab?: WorkspaceMode } | null)?.tab;
  const workspace = useWorkspaceStore((s) => s.workspaces.find((w) => w.id === workspaceId));
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);
  const addConnectionToWorkspace = useWorkspaceStore((s) => s.addConnectionToWorkspace);
  const addBlocksFromInsight = useCanvasStore((s) => s.addBlocksFromInsight);
  const replaceBlocksByMessageId = useCanvasStore((s) => s.replaceBlocksByMessageId);
  const renameSession = useChatStore((s) => s.renameSession);
  const deleteSession = useChatStore((s) => s.deleteSession);
  const deleteMessage = useChatStore((s) => s.deleteMessage);
  const setMessageFeedback = useChatStore((s) => s.setMessageFeedback);
  const clearAllSessions = useChatStore((s) => s.clearAllSessions);
  // Subscribe to the canvas's active tab so we can hide the chat panel
  // entirely when the user is viewing a Deep Analysis tab.
  // (deep tab visibility on canvas isn't used now — the workspaceMode tab
  // strip controls which view is shown.)

  // Sync workspace data from Cosmos DB
  useWorkspaceSync(workspaceId);

  const { sendMessage, isLoading, sessions: allSessions, activeSession, setActiveSession } = useChat(workspaceId);

  // Filter sessions to only show ones for this workspace
  const sessions = allSessions.filter(
    (s) => s.workspaceId === workspaceId || !s.workspaceId
  );

  const [connections, setConnections] = useState<ConnectionInfo[]>([]);
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null);
  const [showConnectionDialog, setShowConnectionDialog] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>(
    initialTab && ['quick', 'deep', 'dashboards'].includes(initialTab) ? initialTab : 'quick',
  );

  // If we land here with location state but the user navigates within the
  // workspace, clear the state so a real refresh doesn't keep forcing the tab.
  useEffect(() => {
    if (initialTab) {
      navigate(`/workspace/${workspaceId}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (workspaceId) setActiveWorkspace(workspaceId);
  }, [workspaceId, setActiveWorkspace]);

  useEffect(() => {
    if (!workspace) navigate('/');
  }, [workspace, navigate]);

  // Auto-restore saved connections on workspace load + validate with backend
  useEffect(() => {
    if (!workspace) return;
    const saved = workspace.connections;
    if (saved.length > 0 && !activeConnectionId) {
      // Workspace has saved connections — restore the first one
      setActiveConnectionId(saved[0].id);

      // Validate connection still exists on backend (non-blocking)
      import('../services/api').then(({ testConnection }) => {
        testConnection(saved[0].id).catch(() => {
          // Connection no longer exists on backend — keep showing it but mark disconnected
          console.warn(`Connection ${saved[0].id} not found on backend`);
        });
      });
    }
  }, [workspace?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build active connection: prefer workspace-stored connections, then local state
  const activeConnection: ConnectionInfo | null = (() => {
    if (activeConnectionId) {
      const wsConn = workspace?.connections.find((c) => c.id === activeConnectionId);
      if (wsConn) return wsConn;
      return connections.find((c) => c.id === activeConnectionId) || null;
    }
    return null;
  })();

  const hasConnection = activeConnectionId !== null;

  const handleSend = useCallback(
    (message: string, mode: 'quick' | 'deep' = 'quick') => {
      const connId = activeConnectionId || '';
      sendMessage(message, connId, mode);
    },
    [sendMessage, activeConnectionId]
  );

  const handleFollowUp = useCallback(
    (question: string) => {
      handleSend(question, 'quick');
    },
    [handleSend]
  );

  // Follow-up question inside an existing Deep Analysis thread.
  // Routes back through useChat.sendMessage with the same deepThreadId
  // so the new analysis appends to the same deep tab on the canvas.
  const handleDeepFollowUp = useCallback(
    (question: string, deepThreadId: string) => {
      const connId = activeConnectionId || '';
      sendMessage(question, connId, 'deep', { deepThreadId });
    },
    [sendMessage, activeConnectionId]
  );

  // Manual push to canvas (for Quick Insight mode)
  const handlePushToCanvas = useCallback(
    (insight: InsightResult, messageId: string) => {
      if (!workspaceId) return;
      const existingBlocks = useCanvasStore.getState().getBlocks(workspaceId);
      const alreadyHasBlocks = existingBlocks.some((b) => b.sourceMessageId === messageId);
      if (!alreadyHasBlocks) {
        // Find user query from chat session
        let userQuery = '';
        if (activeSession) {
          const msgIdx = activeSession.messages.findIndex((m) => m.id === messageId);
          if (msgIdx > 0 && activeSession.messages[msgIdx - 1].role === 'user') {
            userQuery = activeSession.messages[msgIdx - 1].content;
          }
        }
        addBlocksFromInsight(workspaceId, insight, messageId, {
          skipNarrative: true,
          analysisMode: 'quick',
          sourceQuery: userQuery,
          sessionId: activeSession?.id,
        });
      }
    },
    [workspaceId, addBlocksFromInsight, activeSession]
  );

  // Delete a message (and its paired response)
  const handleDeleteMessage = useCallback(
    (messageId: string) => {
      const sessionId = activeSession?.id;
      if (!sessionId) return;
      deleteMessage(sessionId, messageId);
    },
    [activeSession?.id, deleteMessage]
  );

  // Feedback on AI response
  const handleFeedback = useCallback(
    (messageId: string, feedback: 'positive' | 'negative' | null) => {
      const sessionId = activeSession?.id;
      if (!sessionId) return;
      setMessageFeedback(sessionId, messageId, feedback);
    },
    [activeSession?.id, setMessageFeedback]
  );

  // Refresh all canvas queries — re-runs SQL against the real database (or demo simulator for mock)
  const handleRefreshCanvas = useCallback(async () => {
    if (!workspaceId || isRefreshing) return;
    setIsRefreshing(true);

    const blocks = useCanvasStore.getState().getBlocks(workspaceId);
    // Only refresh blocks belonging to the active session
    const sessionBlocks = activeSession
      ? blocks.filter((b) => b.sessionId === activeSession.id || !b.sessionId)
      : blocks;
    const uniqueMessageIds = [...new Set(sessionBlocks.map((b) => b.sourceMessageId))];

    const chatState = useChatStore.getState();
    const allSessions = chatState.sessions;
    const connId = activeConnectionId || '';

    for (const msgId of uniqueMessageIds) {
      let userContent = '';
      let mode: 'quick' | 'deep' = 'quick';

      for (const session of allSessions) {
        const msgIdx = session.messages.findIndex((m) => m.id === msgId);
        if (msgIdx !== -1) {
          const assistantMsg = session.messages[msgIdx];
          mode = assistantMsg.analysisMode || 'quick';
          if (msgIdx > 0 && session.messages[msgIdx - 1].role === 'user') {
            userContent = session.messages[msgIdx - 1].content;
          }
          break;
        }
      }

      if (!userContent || !connId) continue;

      try {
        const result = await refreshQuery(userContent, connId, mode);

        const tempId = `__refresh_${msgId}`;
        const store = useCanvasStore.getState();
        store.addBlocksFromInsight(tempId, result, msgId, {
          skipNarrative: mode === 'quick',
          analysisMode: mode,
          sourceQuery: userContent,
          sessionId: activeSession?.id,
        });
        const newBlocks = useCanvasStore.getState().getBlocks(tempId);
        store.clearCanvas(tempId);
        replaceBlocksByMessageId(workspaceId, msgId, newBlocks);
      } catch (err) {
        console.error(`Failed to refresh canvas block for message ${msgId}:`, err);
      }
    }

    setIsRefreshing(false);
  }, [workspaceId, isRefreshing, replaceBlocksByMessageId, activeConnectionId, activeSession]);

  const handleConnect = useCallback((connection: ConnectionInfo) => {
    if (workspaceId) {
      addConnectionToWorkspace(workspaceId, connection);
    }
    setConnections((prev) => [...prev, connection]);
    setActiveConnectionId(connection.id);
  }, [workspaceId, addConnectionToWorkspace]);

  const handleSelectConnection = useCallback((id: string) => {
    setActiveConnectionId(id);
  }, []);

  const handleNewChat = useCallback(() => {
    setActiveSession('');
  }, [setActiveSession]);

  const handleRenameSession = useCallback(
    (sessionId: string, title: string) => {
      renameSession(sessionId, title);
    },
    [renameSession]
  );

  const handleDeleteSession = useCallback(
    (sessionId: string) => {
      deleteSession(sessionId);
    },
    [deleteSession]
  );

  const handleClearAllSessions = useCallback(() => {
    setShowClearConfirm(true);
  }, []);

  const confirmClearAll = useCallback(() => {
    if (workspaceId) {
      clearAllSessions(workspaceId);
    } else {
      sessions.forEach((s) => deleteSession(s.id));
    }
    setShowClearConfirm(false);
  }, [workspaceId, sessions, deleteSession, clearAllSessions]);

  // (Deep Analysis blocks are finalized inline by useChat's final_result
  // SSE handler — see hooks/useChat.ts. We deliberately do NOT auto-push
  // them here: doing so on every render meant deleted deep blocks were
  // recreated whenever WorkspaceView re-rendered with a deep message
  // that still carried its insightResult.)

  if (!workspace) return null;

  const canvasTitle = activeSession?.title || undefined;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-navy-50">
      <AppSidebar activePath="/" defaultCollapsed />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <WorkspaceHeader
          workspace={workspace}
          activeConnection={activeConnection}
          onOpenConnectionDialog={() => setShowConnectionDialog(true)}
        />

        {/* ── Mode tab strip: Quick / Deep / Dashboards ── */}
        <ModeTabBar mode={workspaceMode} onChange={setWorkspaceMode} />

        {/* MetricsBar shows on Quick + Deep tabs (chat sessions); not on Dashboards. */}
        {workspaceMode !== 'dashboards' && <MetricsBar sessions={sessions} />}

        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          {workspaceMode === 'quick' && (
            <>
              <WorkspaceSidebar
                sessions={sessions}
                activeSessionId={activeSession?.id || null}
                onSelectSession={setActiveSession}
                onNewChat={handleNewChat}
                onRenameSession={handleRenameSession}
                onDeleteSession={handleDeleteSession}
                onClearAllSessions={handleClearAllSessions}
                defaultCollapsed
              />

              <SplitPanel
                left={
                  <ChatPanel
                    session={activeSession}
                    isLoading={isLoading}
                    hasConnection={hasConnection}
                    onSend={handleSend}
                    onFollowUp={handleFollowUp}
                    onPushToCanvas={handlePushToCanvas}
                    onDeleteMessage={handleDeleteMessage}
                    onFeedback={handleFeedback}
                    compact={true}
                  />
                }
                right={
                  <CanvasPanel
                    workspaceId={workspaceId!}
                    activeSessionId={activeSession?.id || null}
                    onFollowUp={handleFollowUp}
                    onDeepFollowUp={handleDeepFollowUp}
                    canvasTitle={canvasTitle}
                    onRenameCanvas={
                      activeSession
                        ? (next) => renameSession(activeSession.id, next)
                        : undefined
                    }
                    onRefreshCanvas={handleRefreshCanvas}
                    isRefreshing={isRefreshing}
                  />
                }
                defaultLeftWidth={440}
                minLeftWidth={340}
                minRightWidth={420}
              />
            </>
          )}

          {workspaceMode === 'deep' && (
            <DeepInsightView
              workspaceId={workspaceId!}
              hasConnection={hasConnection}
              connectionId={activeConnectionId || ''}
              onRunDeep={handleSend}
              onFollowUp={handleDeepFollowUp}
            />
          )}

          {workspaceMode === 'dashboards' && (
            <DashboardsTabContent workspaceId={workspaceId!} />
          )}
        </div>
      </div>

      <ConnectionDialog
        isOpen={showConnectionDialog}
        onClose={() => setShowConnectionDialog(false)}
        onConnect={handleConnect}
        connections={[...(workspace?.connections || []), ...connections.filter((c) => !workspace?.connections.some((wc) => wc.id === c.id))]}
        activeConnectionId={activeConnectionId}
        onSelectConnection={handleSelectConnection}
      />

      <ConfirmDialog
        isOpen={showClearConfirm}
        title="Clear all chat history"
        message="This will permanently delete all conversations in this workspace. This action cannot be undone."
        confirmLabel="Clear All"
        variant="danger"
        onConfirm={confirmClearAll}
        onCancel={() => setShowClearConfirm(false)}
      />
    </div>
  );
}

/* ─── Workspace mode tab strip ─── */
function ModeTabBar({
  mode,
  onChange,
}: {
  mode: WorkspaceMode;
  onChange: (m: WorkspaceMode) => void;
}) {
  const tabs: { id: WorkspaceMode; label: string; icon: typeof Zap; subtitle: string }[] = [
    { id: 'quick', label: 'Quick Insights', icon: Zap, subtitle: 'Ask & get an answer' },
    { id: 'deep', label: 'Deep Insight', icon: Brain, subtitle: 'Multi-step analysis' },
    { id: 'dashboards', label: 'Dashboards', icon: LayoutDashboard, subtitle: 'Curated views' },
  ];

  return (
    <div className="flex shrink-0 items-stretch gap-1 border-b border-navy-100 bg-white px-3 py-1.5">
      {tabs.map((t) => {
        const Icon = t.icon;
        const active = mode === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
              active
                ? 'bg-accent-50 text-accent-700 ring-1 ring-inset ring-accent-200'
                : 'text-navy-600 hover:bg-navy-50 hover:text-navy-900'
            }`}
            title={t.subtitle}
          >
            <Icon className={`h-3.5 w-3.5 ${active ? 'text-accent-600' : 'text-navy-400'}`} />
            <span>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
