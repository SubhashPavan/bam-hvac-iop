import Markdown from 'react-markdown';
import { Lightbulb, Sparkles, ArrowRight } from 'lucide-react';
import type { InsightSummary } from '../../types/chat';
import { extractTitleAndNarrative } from '../../utils/extractSummary';

interface TextSummaryProps {
  summary: InsightSummary;
  onFollowUp?: (question: string) => void;
  isConversational?: boolean;
}

type Significance = 'high' | 'medium' | 'low';

const SIG_STYLES: Record<Significance, { border: string; bg: string; badge: string }> = {
  high: {
    border: 'border-l-accent-500',
    bg: 'bg-accent-50/50',
    badge: 'bg-accent-100 text-accent-700 ring-accent-200',
  },
  medium: {
    border: 'border-l-amber-500',
    bg: 'bg-amber-50/50',
    badge: 'bg-amber-100 text-amber-700 ring-amber-200',
  },
  low: {
    border: 'border-l-navy-300',
    bg: 'bg-navy-50/60',
    badge: 'bg-navy-100 text-navy-600 ring-navy-200',
  },
};

export default function TextSummary({ summary, onFollowUp, isConversational }: TextSummaryProps) {
  const isWelcome =
    isConversational ??
    (summary.key_findings?.length > 0 &&
      summary.follow_up_questions?.length > 0 &&
      !summary.title?.toLowerCase().includes('analysis'));

  // The agent occasionally returns a JSON blob in narrative — extract
  // a clean title + narrative so we never render raw `{...}` to the user.
  const { title, narrative } = extractTitleAndNarrative(
    summary.title || '',
    summary.narrative || '',
  );

  return (
    <div className="space-y-4 rounded-xl border border-navy-100 bg-white p-4 shadow-sm">
      {/* Title */}
      {title && (
        <h3 className="text-[16px] font-semibold leading-tight text-navy-900">{title}</h3>
      )}

      {/* Narrative */}
      {narrative && (
        <div className="is-prose">
          <Markdown>{narrative}</Markdown>
        </div>
      )}

      {/* Key findings */}
      {summary.key_findings && summary.key_findings.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2">
            {isWelcome ? (
              <>
                <Sparkles className="h-4 w-4 text-accent-500" />
                <h4 className="text-[12.5px] font-semibold uppercase tracking-wider text-navy-700">
                  What I can help with
                </h4>
              </>
            ) : (
              <>
                <Lightbulb className="h-4 w-4 text-amber-500" />
                <h4 className="text-[12.5px] font-semibold uppercase tracking-wider text-navy-700">
                  Key findings
                </h4>
              </>
            )}
          </div>
          <div className="space-y-2">
            {summary.key_findings.map((finding, i) => {
              const sig = (finding.significance as Significance) || 'low';
              const style = SIG_STYLES[sig] || SIG_STYLES.low;
              return (
                <div
                  key={i}
                  className={`rounded-lg border border-navy-100 border-l-[3px] ${style.border} ${style.bg} p-3 animate-fade-slide-in`}
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-semibold leading-snug text-navy-900">
                        {finding.headline}
                      </p>
                      {finding.detail && (
                        <p className="mt-0.5 text-[13px] leading-relaxed text-navy-600">
                          {finding.detail}
                        </p>
                      )}
                    </div>
                    {!isWelcome && (
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider ring-1 ring-inset ${style.badge}`}
                      >
                        {finding.significance}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Follow-up questions */}
      {summary.follow_up_questions && summary.follow_up_questions.length > 0 && onFollowUp && (
        <div className="border-t border-navy-100 pt-3">
          <h4 className="mb-2 text-[12.5px] font-semibold uppercase tracking-wider text-navy-700">
            {isWelcome ? 'Try asking' : 'Explore further'}
          </h4>
          <div className="flex flex-col gap-1.5">
            {summary.follow_up_questions.map((q, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onFollowUp(q)}
                className="group inline-flex items-center gap-2 rounded-lg border border-navy-100 bg-navy-50/60 px-3 py-1.5 text-left text-[12.5px] text-navy-700 transition-all hover:border-accent-200 hover:bg-accent-50 hover:text-accent-700"
              >
                <ArrowRight className="h-3 w-3 text-accent-500 transition-transform group-hover:translate-x-0.5" />
                {q}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
