import { useState, useRef, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

interface ChatInputProps {
  /** Mode signature is preserved for compatibility with the parent, but
   *  this input only ever sends 'quick'. Deep Analysis is now a separate
   *  workspace tab with its own brief flow. */
  onSend: (message: string, mode: 'quick' | 'deep') => void;
  isLoading: boolean;
  disabled: boolean;
  placeholder?: string;
  showSuggestions?: boolean;
}

const SUGGESTIONS = [
  { icon: '📊', text: 'Show me revenue by product category' },
  { icon: '👥', text: 'What are the customer acquisition trends?' },
  { icon: '📈', text: 'How has growth trended over time?' },
  { icon: '🎯', text: 'Give me a business overview' },
];

export default function ChatInput({
  onSend,
  isLoading,
  disabled,
  placeholder,
  showSuggestions,
}: ChatInputProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px';
    }
  }, [input]);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading || disabled) return;
    onSend(trimmed, 'quick');
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const canSend = input.trim().length > 0 && !isLoading && !disabled;
  const placeholderText = placeholder || 'Ask about your data…';

  return (
    <div className="shrink-0 border-t border-navy-100 bg-white px-4 pb-3 pt-3">
      {showSuggestions && (
        <div className="mb-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.text}
              type="button"
              onClick={() => onSend(s.text, 'quick')}
              disabled={isLoading || disabled}
              className="inline-flex items-center gap-1.5 rounded-full border border-navy-200 bg-white px-3 py-1.5 text-[12.5px] text-navy-700 transition-all hover:border-accent-300 hover:bg-accent-50 hover:text-accent-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="text-[13px] leading-none">{s.icon}</span>
              <span>{s.text}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <div className="flex flex-col rounded-xl border border-navy-200 bg-white shadow-sm transition-colors focus-within:border-accent-400 focus-within:ring-2 focus-within:ring-accent-100">
          <div className="flex items-end gap-2 p-2.5">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholderText}
              disabled={isLoading || disabled}
              rows={1}
              className="flex-1 resize-none border-0 bg-transparent px-1 py-1 text-[13.5px] text-navy-800 placeholder:text-navy-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSend}
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all ${
                canSend
                  ? 'bg-accent-500 text-white shadow-sm hover:bg-accent-600'
                  : 'bg-navy-100 text-navy-400'
              }`}
              title="Send"
            >
              {isLoading ? <TypingDots /> : <ArrowUp className="h-4 w-4" strokeWidth={2.5} />}
            </button>
          </div>
        </div>

        <p className="text-center text-[11px] text-navy-400">
          AI-powered data analysis · DataLens
        </p>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="flex items-center gap-0.5">
      <span className="h-1 w-1 is-thinking-dot rounded-full bg-current" style={{ animationDelay: '0ms' }} />
      <span className="h-1 w-1 is-thinking-dot rounded-full bg-current" style={{ animationDelay: '160ms' }} />
      <span className="h-1 w-1 is-thinking-dot rounded-full bg-current" style={{ animationDelay: '320ms' }} />
    </span>
  );
}
