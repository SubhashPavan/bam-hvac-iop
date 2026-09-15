import { useState } from 'react';
import { Sparkles, LayoutGrid, Check, Trash2, ThumbsUp, ThumbsDown, Zap } from 'lucide-react';
import type { ChatMessage, InsightResult } from '../../types/chat';
import ThinkingSteps from './ThinkingSteps';
import InsightCard from '../insights/InsightCard';
import { extractTitleAndNarrative } from '../../utils/extractSummary';

/** Renders simple markdown bold (**text**) as <strong> tags */
function renderBoldText(text: string) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part));
}

// (extractTitleAndNarrative is imported from utils/extractSummary)

interface MessageBubbleProps {
  message: ChatMessage;
  onFollowUp?: (question: string) => void;
  onPushToCanvas?: (insight: InsightResult, messageId: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  onFeedback?: (messageId: string, feedback: 'positive' | 'negative' | null) => void;
  compact?: boolean;
}

export default function MessageBubble({
  message,
  onFollowUp,
  onPushToCanvas,
  onDeleteMessage,
  onFeedback,
  compact = false,
}: MessageBubbleProps) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="group flex items-start justify-end gap-2">
        {onDeleteMessage && (
          <button
            type="button"
            onClick={() => onDeleteMessage(message.id)}
            className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-navy-400 opacity-0 transition-all hover:bg-danger-50 hover:text-danger-600 group-hover:opacity-100"
            title="Delete message"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-accent-500 px-3.5 py-2 text-[13.5px] leading-relaxed text-white shadow-sm">
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
      </div>
    );
  }

  const isDeep = message.analysisMode === 'deep';
  const isDone = !message.isStreaming;

  return (
    <div className="group relative flex flex-col gap-2">
      {/* Hover delete button */}
      {onDeleteMessage && isDone && (
        <button
          type="button"
          onClick={() => onDeleteMessage(message.id)}
          className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-md bg-white text-navy-400 opacity-0 shadow-sm ring-1 ring-navy-100 transition-all hover:bg-danger-50 hover:text-danger-600 hover:ring-danger-200 group-hover:opacity-100"
          title="Delete message"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}

      <div className={compact ? 'max-w-full' : 'max-w-2xl'}>
        {/* Assistant header */}
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-accent-500 to-accent-700 text-white shadow-sm">
            <Sparkles className="h-3 w-3" />
          </div>
          <span className="text-[12.5px] font-semibold text-navy-700">DataLens</span>
          {message.analysisMode && message.insightResult &&
            ((message.insightResult.charts?.length ?? 0) > 0 ||
              (message.insightResult.tables?.length ?? 0) > 0) && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset ${
                  isDeep
                    ? 'bg-violet-50 text-violet-700 ring-violet-200'
                    : 'bg-accent-50 text-accent-700 ring-accent-200'
                }`}
              >
                {isDeep ? 'Deep' : 'Quick'}
              </span>
            )}
          {message.insightResult?.execution_metadata?.cached && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700 ring-1 ring-inset ring-amber-200">
              <Zap className="h-2.5 w-2.5" />
              Cached
            </span>
          )}
        </div>

        {/* Thinking steps */}
        {(message.steps.length > 0 || message.isStreaming) && (
          <ThinkingSteps
            steps={message.steps}
            isStreaming={!!message.isStreaming && !message.insightResult}
          />
        )}

        {/* Insight result */}
        {message.insightResult &&
          (() => {
            const hasVisuals =
              (message.insightResult.charts?.length ?? 0) > 0 ||
              (message.insightResult.tables?.length ?? 0) > 0;
            return compact && hasVisuals ? (
              <CompactInsightPreview
                insight={message.insightResult}
                messageId={message.id}
                isDeep={isDeep}
                onPushToCanvas={onPushToCanvas}
                onFollowUp={onFollowUp}
              />
            ) : (
              <InsightCard
                insight={message.insightResult}
                onFollowUp={onFollowUp}
                onPushToCanvas={
                  onPushToCanvas && hasVisuals
                    ? () => onPushToCanvas(message.insightResult!, message.id)
                    : undefined
                }
              />
            );
          })()}

        {/* Pure streaming state */}
        {message.isStreaming && !message.insightResult && message.steps.length === 0 && (
          <div className="flex items-center gap-2 rounded-xl border border-navy-100 bg-white px-3 py-2 text-[12.5px] text-navy-500 shadow-sm">
            <span className="flex gap-0.5">
              <span className="is-thinking-dot h-1.5 w-1.5 rounded-full bg-accent-500" style={{ animationDelay: '0ms' }} />
              <span className="is-thinking-dot h-1.5 w-1.5 rounded-full bg-accent-500" style={{ animationDelay: '160ms' }} />
              <span className="is-thinking-dot h-1.5 w-1.5 rounded-full bg-accent-500" style={{ animationDelay: '320ms' }} />
            </span>
            <span>Analyzing your question…</span>
          </div>
        )}

        {/* Feedback buttons */}
        {isDone && message.insightResult && onFeedback && (
          <div className="mt-2 flex gap-1">
            <button
              type="button"
              onClick={() => onFeedback(message.id, 'positive')}
              className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                message.feedback === 'positive'
                  ? 'bg-success-50 text-success-600 ring-1 ring-inset ring-success-500/25'
                  : 'text-navy-400 hover:bg-navy-50 hover:text-success-600'
              }`}
              title="Helpful"
            >
              <ThumbsUp className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={() => onFeedback(message.id, 'negative')}
              className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                message.feedback === 'negative'
                  ? 'bg-danger-50 text-danger-600 ring-1 ring-inset ring-danger-500/25'
                  : 'text-navy-400 hover:bg-navy-50 hover:text-danger-600'
              }`}
              title="Not helpful"
            >
              <ThumbsDown className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CompactInsightPreview({
  insight,
  messageId,
  isDeep,
  onPushToCanvas,
  onFollowUp,
}: {
  insight: InsightResult;
  messageId: string;
  isDeep: boolean;
  onPushToCanvas?: (insight: InsightResult, messageId: string) => void;
  onFollowUp?: (question: string) => void;
}) {
  const [pushed, setPushed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { summary, charts, tables } = insight;
  const chartCount = charts?.length || 0;
  const tableCount = tables?.length || 0;

  // Extract clean title + narrative from the agent response. Sometimes
  // the agent returns a JSON blob in `narrative` (e.g. wrapped in
  // ```json fences, or with trailing prose, or just a raw object) —
  // fall back to regex extraction if JSON.parse fails so we never
  // render `{...}` to the user.
  const cleaned = extractTitleAndNarrative(summary.title || '', summary.narrative || '');
  const titleText = cleaned.title;
  const narrativeText = cleaned.narrative;

  const firstSentence = narrativeText.split(/(?<=[.!?])\s/)[0] || '';
  const snippet =
    firstSentence.length > 200 ? firstSentence.slice(0, 200) + '…' : firstSentence;
  const hasMore = narrativeText.length > snippet.length;

  const handlePush = () => {
    if (onPushToCanvas && !pushed) {
      onPushToCanvas(insight, messageId);
      setPushed(true);
    }
  };

  return (
    <div className="rounded-xl border border-navy-100 bg-white p-3.5 shadow-sm">
      <h4 className="text-[14px] font-semibold leading-snug text-navy-900">{titleText}</h4>
      <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-navy-600">
        {renderBoldText(expanded ? narrativeText : snippet)}
      </p>
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-1 text-[12px] font-semibold text-accent-600 transition-colors hover:text-accent-700"
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}

      {(chartCount > 0 || tableCount > 0) && (
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-navy-100 pt-3">
          <div className="flex gap-3 text-[11.5px] text-navy-500">
            {chartCount > 0 && (
              <span>
                {chartCount} chart{chartCount > 1 ? 's' : ''}
              </span>
            )}
            {tableCount > 0 && (
              <span>
                {tableCount} table{tableCount > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {!isDeep && onPushToCanvas && (
            <button
              type="button"
              onClick={handlePush}
              disabled={pushed}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-semibold transition-colors ${
                pushed
                  ? 'bg-success-50 text-success-700 ring-1 ring-inset ring-success-500/25'
                  : 'bg-accent-500 text-white shadow-sm hover:bg-accent-600'
              }`}
            >
              {pushed ? <Check className="h-3 w-3" /> : <LayoutGrid className="h-3 w-3" />}
              {pushed ? 'On canvas' : 'Push to canvas'}
            </button>
          )}

          {isDeep && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-violet-50 px-2.5 py-1 text-[12px] font-semibold text-violet-700 ring-1 ring-inset ring-violet-200">
              <LayoutGrid className="h-3 w-3" />
              Auto-added to canvas
            </span>
          )}
        </div>
      )}

      {/* Follow-up suggestions */}
      {expanded &&
        summary.follow_up_questions &&
        summary.follow_up_questions.length > 0 &&
        onFollowUp && (
          <div className="mt-3 flex flex-col gap-1.5 border-t border-navy-100 pt-3">
            {summary.follow_up_questions.slice(0, 3).map((q, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onFollowUp(q)}
                className="rounded-md border border-navy-100 bg-navy-50/60 px-3 py-1.5 text-left text-[12px] text-navy-700 transition-colors hover:border-accent-200 hover:bg-accent-50 hover:text-accent-700"
              >
                {q}
              </button>
            ))}
          </div>
        )}
    </div>
  );
}
