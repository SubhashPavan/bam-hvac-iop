import { useState, useCallback, useRef } from 'react';
import { useChatStore } from '../store/chatStore';
import { useCanvasStore } from '../store/canvasStore';
import { sendMessage as apiSendMessage, createEventSource, type HistoryMessage } from '../services/api';
import type { ChatMessage, AgentStep, InsightResult } from '../types/chat';
import type { DeepProgressKind, DeepProgressStep } from '../types/canvas';

function generateId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
}

/** Map SSE event types to canvas deep-progress kinds for richer labels. */
function kindFromEventType(eventType: string): DeepProgressKind {
  switch (eventType) {
    case 'plan': return 'plan';
    case 'sub_query_start': return 'query';
    case 'sub_query_result': return 'query_result';
    case 'api_call_start': return 'api';
    case 'api_call_result': return 'api_result';
    case 'consolidating': return 'synthesis';
    case 'chart_selected': return 'chart';
    case 'error': return 'error';
    default: return 'thinking';
  }
}

export function useChat(workspaceId?: string) {
  // Use individual selectors to avoid subscribing to entire store
  const sessions = useChatStore((s) => s.sessions);
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const createSession = useChatStore((s) => s.createSession);
  const addMessage = useChatStore((s) => s.addMessage);
  const addStep = useChatStore((s) => s.addStep);
  const setInsightResult = useChatStore((s) => s.setInsightResult);
  const setMessageStreaming = useChatStore((s) => s.setMessageStreaming);
  const setActiveSession = useChatStore((s) => s.setActiveSession);

  // Only blocks input while a QUICK message is streaming. Deep runs in
  // background on the canvas and does NOT set this flag, so the user
  // can continue chatting while deep analysis finishes.
  const [isLoading, setIsLoading] = useState(false);
  // messageId → EventSource so multiple streams can run concurrently.
  const eventSourcesRef = useRef<Map<string, EventSource>>(new Map());

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  const sendMessage = useCallback(
    async (
      content: string,
      connectionId: string,
      mode: 'quick' | 'deep' = 'quick',
      /** When set, this is a follow-up inside an existing deep thread. */
      opts?: { deepThreadId?: string },
    ) => {
      const isDeep = mode === 'deep';

      // Only quick mode blocks the input — deep streams in the background.
      if (!isDeep) setIsLoading(true);

      // Read fresh state at call time
      let sessionId = useChatStore.getState().activeSessionId;
      if (!sessionId) {
        sessionId = generateId();
        createSession(sessionId, workspaceId);
      }

      const assistantMessageId = generateId();
      // For root deep queries, the assistant message is itself the
      // deepThreadId. For follow-ups, the caller supplies the existing
      // thread root.
      const deepThreadId = isDeep ? (opts?.deepThreadId || assistantMessageId) : undefined;

      const userMessage: ChatMessage = {
        id: generateId(),
        role: 'user',
        content,
        timestamp: Date.now(),
        steps: [],
        analysisMode: mode,
        deepThreadId,
      };
      addMessage(sessionId, userMessage);

      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        steps: [],
        isStreaming: true,
        analysisMode: mode,
        deepThreadId,
      };
      addMessage(sessionId, assistantMessage);

      // For deep mode, immediately create a placeholder deep_analysis block
      // on the canvas. Root queries open a new deep tab; follow-ups append
      // to the existing tab via deepThreadId.
      if (isDeep && workspaceId && deepThreadId) {
        useCanvasStore.getState().startDeepTask(
          workspaceId,
          assistantMessageId,
          content,
          sessionId,
          deepThreadId,
        );
      }

      try {
        // Build condensed conversation history for the agent
        const currentState = useChatStore.getState();
        const currentSession = currentState.sessions.find((s) => s.id === sessionId);
        const history: HistoryMessage[] = [];
        if (currentSession) {
          const prior = currentSession.messages.slice(0, -2).slice(-10);
          for (const msg of prior) {
            if (msg.role === 'user') {
              history.push({ role: 'user', content: msg.content.slice(0, 300) });
            } else if (msg.role === 'assistant' && msg.insightResult) {
              const ir = msg.insightResult;
              const title = ir.summary?.title || '';
              const narr = ir.summary?.narrative || '';
              history.push({
                role: 'assistant',
                content: `[Analysis: "${title}" — ${narr.slice(0, 150)}]`,
              });
            } else if (msg.role === 'assistant' && msg.content) {
              history.push({ role: 'assistant', content: msg.content.slice(0, 200) });
            }
          }
        }

        const result = await apiSendMessage(sessionId, content, connectionId, mode, workspaceId || '', history);
        // Backend returns run_id (new) or session_id (legacy) — either
        // works as the stream key. Prefer run_id if present.
        const streamId = (result as { run_id?: string; session_id?: string }).run_id
          || result.session_id;

        // Previous stream for THIS message (if re-submitted) gets closed;
        // other concurrent streams for other messages keep running.
        const prev = eventSourcesRef.current.get(assistantMessageId);
        if (prev) prev.close();

        const es = createEventSource(streamId);
        eventSourcesRef.current.set(assistantMessageId, es);

        // Track last-emitted sub_query_start so we can mark it 'done' when
        // its matching sub_query_result arrives (for the deep timeline).
        const deepStepByIndex = new Map<number, string>();

        const handleEvent = (eventType: string) => (event: MessageEvent) => {
          let parsed: Record<string, unknown>;
          try {
            parsed = JSON.parse(event.data);
          } catch {
            parsed = { content: event.data };
          }

          const stepType = eventType as AgentStep['type'];
          const validTypes: AgentStep['type'][] = [
            'thinking',
            'plan',
            'sub_query_start',
            'sub_query_result',
            'api_call_start',
            'api_call_result',
            'consolidating',
            'chart_selected',
            'clarification',
            'error',
          ];

          const label = (parsed.content as string) || (parsed.description as string) || JSON.stringify(parsed);

          if (validTypes.includes(stepType)) {
            // Always record on the chat message (expandable thinking steps)
            const step: AgentStep = {
              type: stepType,
              content: label,
              sql: parsed.sql as string | undefined,
              data: parsed.data as Record<string, unknown> | undefined,
              timestamp: Date.now(),
              completed: true,
            };
            addStep(sessionId!, assistantMessageId, step);

            // For deep mode, also push a richer step onto the canvas block's
            // timeline so the user sees live progress on the deep tab.
            if (isDeep && workspaceId) {
              const canvas = useCanvasStore.getState();
              if (eventType === 'sub_query_result') {
                // Close out the matching sub_query_start step
                const idx = (parsed.index as number) ?? -1;
                const openStepId = deepStepByIndex.get(idx);
                if (openStepId) {
                  const err = parsed.error as string | undefined;
                  canvas.updateDeepTaskStep(workspaceId, assistantMessageId, openStepId, {
                    status: err ? 'error' : 'done',
                    completedAt: Date.now(),
                    rowCount: parsed.row_count as number | undefined,
                    durationMs: parsed.duration_ms as number | undefined,
                    detail: err,
                  });
                  deepStepByIndex.delete(idx);
                }
              } else {
                const deepStep: DeepProgressStep = {
                  id: generateId(),
                  kind: kindFromEventType(eventType),
                  label: label.length > 160 ? label.slice(0, 157) + '…' : label,
                  detail: parsed.sql as string | undefined,
                  status: eventType === 'error' ? 'error' : 'active',
                  startedAt: Date.now(),
                  sql: parsed.sql as string | undefined,
                };
                canvas.appendDeepTaskStep(workspaceId, assistantMessageId, deepStep);
                if (eventType === 'sub_query_start') {
                  const idx = (parsed.index as number) ?? -1;
                  deepStepByIndex.set(idx, deepStep.id);
                }
              }
            }
          }
        };

        es.addEventListener('thinking', handleEvent('thinking'));
        es.addEventListener('plan', handleEvent('plan'));
        es.addEventListener('sub_query_start', handleEvent('sub_query_start'));
        es.addEventListener('sub_query_result', handleEvent('sub_query_result'));
        es.addEventListener('api_call_start', handleEvent('api_call_start'));
        es.addEventListener('api_call_result', handleEvent('api_call_result'));
        es.addEventListener('consolidating', handleEvent('consolidating'));
        es.addEventListener('chart_selected', handleEvent('chart_selected'));
        es.addEventListener('clarification', (event: MessageEvent) => {
          try {
            const parsed = JSON.parse(event.data);
            const question = (parsed.question as string) || event.data;
            addStep(sessionId!, assistantMessageId, {
              type: 'clarification',
              content: question,
              timestamp: Date.now(),
              completed: true,
            });
            const store = useChatStore.getState();
            const session = store.sessions.find((s) => s.id === sessionId);
            if (session) {
              const msg = session.messages.find((m) => m.id === assistantMessageId);
              if (msg) {
                msg.content = question;
              }
            }
          } catch {
            // fallback
          }
        });
        es.addEventListener('error', handleEvent('error'));

        es.addEventListener('final_result', (event: MessageEvent) => {
          try {
            const insightResult: InsightResult = JSON.parse(event.data);
            setInsightResult(sessionId!, assistantMessageId, insightResult);
            // For deep mode, finalize the canvas block in-place RIGHT HERE,
            // exactly once. We do NOT depend on a render-triggered effect
            // to do this — that pattern recreated deleted blocks on every
            // re-render of WorkspaceView.
            if (isDeep && workspaceId) {
              // The placeholder block already carries deepThreadId from
              // startDeepTask — addBlocksFromInsight patches it in place.
              useCanvasStore.getState().addBlocksFromInsight(
                workspaceId,
                insightResult,
                assistantMessageId,
                {
                  analysisMode: 'deep',
                  sourceQuery: content,
                  sessionId: sessionId!,
                },
              );
            }
          } catch {
            addStep(sessionId!, assistantMessageId, {
              type: 'error',
              content: 'Failed to parse final result',
              timestamp: Date.now(),
              completed: true,
            });
            if (isDeep && workspaceId) {
              useCanvasStore.getState().failDeepTask(
                workspaceId,
                assistantMessageId,
                'Failed to parse final result',
              );
            }
          }
        });

        es.addEventListener('done', () => {
          setMessageStreaming(sessionId!, assistantMessageId, false);
          if (!isDeep) setIsLoading(false);
          es.close();
          eventSourcesRef.current.delete(assistantMessageId);
        });

        es.onerror = () => {
          addStep(sessionId!, assistantMessageId, {
            type: 'error',
            content: 'Connection to server lost',
            timestamp: Date.now(),
            completed: true,
          });
          setMessageStreaming(sessionId!, assistantMessageId, false);
          if (!isDeep) setIsLoading(false);
          if (isDeep && workspaceId) {
            useCanvasStore.getState().failDeepTask(
              workspaceId,
              assistantMessageId,
              'Connection to server lost',
            );
          }
          es.close();
          eventSourcesRef.current.delete(assistantMessageId);
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        addStep(sessionId, assistantMessageId, {
          type: 'error',
          content: errorMessage,
          timestamp: Date.now(),
          completed: true,
        });
        setMessageStreaming(sessionId, assistantMessageId, false);
        if (!isDeep) setIsLoading(false);
        if (isDeep && workspaceId) {
          useCanvasStore.getState().failDeepTask(workspaceId, assistantMessageId, errorMessage);
        }
      }
    },
    [createSession, addMessage, addStep, setInsightResult, setMessageStreaming, workspaceId]
  );

  return {
    sendMessage,
    isLoading,
    sessions,
    activeSession,
    setActiveSession,
  };
}
