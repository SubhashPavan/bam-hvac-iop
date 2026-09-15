import { useEffect, useRef } from 'react';
import { Sparkles } from 'lucide-react';
import type { ChatMessage, InsightResult } from '../../types/chat';
import MessageBubble from './MessageBubble';

interface MessageListProps {
  messages: ChatMessage[];
  onFollowUp?: (question: string) => void;
  onPushToCanvas?: (insight: InsightResult, messageId: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  onFeedback?: (messageId: string, feedback: 'positive' | 'negative' | null) => void;
  compact?: boolean;
}

function EmptyState({ compact }: { compact: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div
        className={`mb-4 flex items-center justify-center rounded-2xl bg-accent-50 text-accent-600 ring-1 ring-inset ring-accent-200 ${
          compact ? 'h-12 w-12' : 'h-16 w-16'
        }`}
      >
        <Sparkles className={compact ? 'h-5 w-5' : 'h-7 w-7'} />
      </div>
      <h3 className={`font-semibold text-navy-900 ${compact ? 'text-[15px]' : 'text-[20px]'}`}>
        {compact ? 'Ask a question' : 'What would you like to explore?'}
      </h3>
      <p
        className={`mt-1 max-w-sm leading-relaxed text-navy-500 ${
          compact ? 'text-[12.5px]' : 'text-[13.5px]'
        }`}
      >
        {compact
          ? 'Type below to explore your data. Insights appear on the canvas.'
          : "Ask questions about your data in natural language. I'll analyze, visualize, and surface the key insights."}
      </p>
    </div>
  );
}

export default function MessageList({
  messages,
  onFollowUp,
  onPushToCanvas,
  onDeleteMessage,
  onFeedback,
  compact = false,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, messages.at(-1)?.steps.length, messages.at(-1)?.insightResult]);

  if (messages.length === 0) {
    return <EmptyState compact={compact} />;
  }

  return (
    <div className="custom-scrollbar flex-1 overflow-y-auto bg-navy-50/30">
      <div
        className={`mx-auto flex flex-col gap-5 ${
          compact ? 'max-w-full px-5 py-6' : 'max-w-3xl px-6 py-8'
        }`}
      >
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            onFollowUp={onFollowUp}
            onPushToCanvas={onPushToCanvas}
            onDeleteMessage={onDeleteMessage}
            onFeedback={onFeedback}
            compact={compact}
          />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
