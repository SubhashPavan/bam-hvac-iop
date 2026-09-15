import { useEffect, useRef, useState } from 'react';
import { Sparkles, Send, Database, ShieldCheck } from 'lucide-react';

const QUICK = [
  'What inventory can be reduced in Lalru plant?',
  'How much working capital can South Africa release?',
  'Show top 10 non-moving items with highest value',
  'Which plants have service level below 95%?',
  'What are the top emergency stockout risks?',
  'Give me ABC analysis summary across all regions',
  'Why did inventory increase last month?',
  'What is our total savings potential by region?',
];

interface Msg { id: string; role: 'user' | 'agent'; text: string; tools?: string[]; sources?: string[] }

function answer(q: string): Msg {
  return {
    id: `a-${Math.random().toString(36).slice(2)}`,
    role: 'agent',
    tools: ['query_gold_inventory', 'savings_calculator'],
    text: `Based on the MRO inventory across 24 plants, here's what I found for “${q.trim()}”. This is a demo response — the live agent routes to governed SQL over the Gold tables and returns entitlement-filtered rows, then explains the reasoning like the AI Recommendations screen.`,
    sources: ['gold_recommendations', 'gold_plant_summary'],
  };
}

export default function InventoryCopilot() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const scroll = useRef<HTMLDivElement>(null);

  const send = (raw: string) => {
    const q = raw.trim();
    if (!q || thinking) return;
    setMsgs((m) => [...m, { id: `u-${Math.random().toString(36).slice(2)}`, role: 'user', text: q }]);
    setInput('');
    setThinking(true);
    window.setTimeout(() => { setMsgs((m) => [...m, answer(q)]); setThinking(false); }, 1100);
  };

  useEffect(() => { scroll.current?.scrollTo({ top: scroll.current.scrollHeight, behavior: 'smooth' }); }, [msgs, thinking]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-navy-100 px-6 py-4 dark:border-slate-800">
        <h1 className="text-[20px] font-semibold tracking-tight">Ask</h1>
        <p className="text-[14px] text-navy-500 dark:text-slate-500">Conversational inventory intelligence · Inventory Optimization Assistant</p>
      </div>

      <div ref={scroll} className="custom-scrollbar flex-1 overflow-y-auto px-6 py-5">
        <div className="mx-auto max-w-3xl">
          {msgs.length === 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {QUICK.map((q) => (
                <button key={q} onClick={() => send(q)}
                  className="rounded-full border border-navy-200 bg-white px-3 py-1.5 text-[13px] text-navy-600 hover:border-accent-300 hover:bg-accent-500/5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">{q}</button>
              ))}
            </div>
          )}

          {msgs.length === 0 && (
            <div className="flex gap-2.5">
              <Avatar />
              <div className="rounded-2xl rounded-tl-sm border border-navy-100 bg-white px-4 py-3 text-[14.5px] leading-relaxed dark:border-slate-800 dark:bg-[#211c33]">
                <p className="mb-2 font-semibold">Inventory Optimization Inventory Copilot 👋</p>
                <p className="text-navy-600 dark:text-slate-300">I'm your AI inventory assistant. I have visibility across your MRO materials, plants, and regions — scoped to what you're entitled to see. Ask me anything, from a single plant's slow movers to global savings opportunities. Try a quick prompt above to get started.</p>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-5">
            {msgs.map((m) => m.role === 'user' ? (
              <div key={m.id} className="max-w-[78%] self-end rounded-2xl rounded-br-sm bg-accent-500/10 px-3.5 py-2 text-[14px] leading-relaxed text-accent-800 dark:bg-accent-500/15 dark:text-accent-200">{m.text}</div>
            ) : (
              <div key={m.id} className="flex gap-2.5">
                <Avatar />
                <div className="min-w-0 flex-1">
                  {m.tools && (
                    <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-navy-400 dark:text-slate-500">Tools</span>
                      {m.tools.map((t) => <span key={t} className="flex items-center gap-1 rounded border border-navy-200 bg-white px-1.5 py-0.5 font-mono text-[11.5px] text-navy-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"><Database className="h-2.5 w-2.5" />{t}</span>)}
                    </div>
                  )}
                  <div className="text-[14px] leading-relaxed text-navy-800 dark:text-slate-200">{m.text}</div>
                  {m.sources && (
                    <div className="mt-2 flex items-center gap-2 border-t border-dashed border-navy-100 pt-1.5 text-[11.5px] text-navy-400 dark:border-slate-800 dark:text-slate-500">
                      <ShieldCheck className="h-3 w-3 text-emerald-500" /><span className="font-mono">{m.sources.join(' · ')}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {thinking && (
              <div className="flex gap-2.5"><Avatar />
                <div className="rounded-2xl border border-navy-100 bg-white px-3.5 py-2.5 text-[13.5px] text-navy-500 dark:border-slate-800 dark:bg-[#211c33] dark:text-slate-400">Querying gold tables…</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-navy-100 px-6 py-3 dark:border-slate-800">
        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="mx-auto flex max-w-3xl items-center gap-2 rounded-xl border border-navy-200 bg-white px-3 py-2 focus-within:border-accent-400 dark:border-slate-700 dark:bg-slate-900">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask anything about your MRO inventory…"
            className="flex-1 border-none bg-transparent text-[14px] outline-none placeholder:text-navy-400 dark:text-slate-200 dark:placeholder:text-slate-500" />
          <button type="submit" disabled={!input.trim() || thinking} className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-500 text-white hover:bg-accent-600 disabled:opacity-40"><Send className="h-3.5 w-3.5" /></button>
        </form>
      </div>
    </div>
  );
}

function Avatar() {
  return <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300"><Sparkles className="h-3.5 w-3.5" /></div>;
}
