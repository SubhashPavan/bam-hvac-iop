import { useCallback } from 'react';
import type { ChatSession, InsightResult } from '../../types/chat';
import MessageList from './MessageList';
import ChatInput from './ChatInput';

interface ChatPanelProps {
  session: ChatSession | undefined;
  isLoading: boolean;
  hasConnection: boolean;
  onSend: (message: string, mode: 'quick' | 'deep') => void;
  onFollowUp: (question: string) => void;
  onPushToCanvas?: (insight: InsightResult, messageId: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  onFeedback?: (messageId: string, feedback: 'positive' | 'negative' | null) => void;
  compact?: boolean;
}

export default function ChatPanel({
  session,
  isLoading,
  hasConnection,
  onSend,
  onFollowUp,
  onPushToCanvas,
  onDeleteMessage,
  onFeedback,
  compact = false,
}: ChatPanelProps) {
  // Hide messages tagged as Deep Analysis from the main chat panel —
  // they live exclusively on the deep tab in the canvas.
  const allMessages = session?.messages || [];
  const messages = allMessages.filter((m) => m.analysisMode !== 'deep');
  const showSuggestions = messages.length === 0 && hasConnection;

  const handleFollowUp = useCallback(
    (question: string) => {
      onFollowUp(question);
    },
    [onFollowUp]
  );

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white">
      <MessageList
        messages={messages}
        onFollowUp={handleFollowUp}
        onPushToCanvas={onPushToCanvas}
        onDeleteMessage={onDeleteMessage}
        onFeedback={onFeedback}
        compact={compact}
      />
      <ChatInput
        onSend={onSend}
        isLoading={isLoading}
        disabled={!hasConnection}
        showSuggestions={showSuggestions && !compact}
        placeholder={hasConnection ? 'Ask about your data…' : 'Connect a data source to start'}
      />
    </div>
  );
}
