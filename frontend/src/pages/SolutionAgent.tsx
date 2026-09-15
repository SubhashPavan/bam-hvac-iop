import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Sparkles,
  Send,
  User,
  ShieldCheck,
  Database,
  Brain,
  Filter,
  Loader2,
  Copy,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';

/* ── Message model ──────────────────────────────────────────────── */

interface ToolCall {
  name: string;
  icon: typeof Database;
}

interface TableResult {
  columns: string[];
  rows: (string | { value: string; tone: 'danger' | 'warn' | 'plain' })[][];
  moreCount?: number;
}

interface AgentMessage {
  id: string;
  role: 'user' | 'agent';
  text: string;
  tools?: ToolCall[];
  meta?: string;
  table?: TableResult;
  followText?: string;
  followUps?: string[];
  sources?: string[];
}

const QUICK_ASKS = [
  'A-class stockout risk',
  'Slow movers, last 60 days',
  'Cover ratio by category',
  'Compare DC-04 vs DC-11',
];

/* Canned answer for the stockout question — the flagship demo path. */
function buildStockoutAnswer(): AgentMessage {
  return {
    id: `a-${Math.random().toString(36).slice(2)}`,
    role: 'agent',
    tools: [
      { name: 'query_stock_status', icon: Database },
      { name: 'demand_forecast_14d', icon: Brain },
      { name: 'abc_classifier', icon: Filter },
    ],
    meta: '1.4s · 8.7k rows scanned',
    text:
      '23 A-class SKUs are projected to stock out within 14 days across your 12 warehouses. DC-04 accounts for 14 of them — the demand forecast there is running 32% above the 90-day baseline. Top 5 by risk:',
    table: {
      columns: ['SKU', 'DC', 'On hand', '14d fcst', 'Days to zero'],
      rows: [
        ['SKU-9214', 'DC-04', '312', '1,180', { value: '4', tone: 'danger' }],
        ['SKU-1076', 'DC-04', '89', '340', { value: '4', tone: 'danger' }],
        ['SKU-4453', 'DC-11', '1,204', '2,100', { value: '8', tone: 'warn' }],
        ['SKU-2891', 'DC-04', '560', '890', { value: '9', tone: 'warn' }],
        ['SKU-7702', 'DC-07', '2,240', '3,180', { value: '10', tone: 'warn' }],
      ],
      moreCount: 18,
    },
    followText: 'Want me to break this down by warehouse, or draft replenishment orders for the top 5?',
    followUps: ['Break down by warehouse', 'Draft POs for top 5', 'Why is DC-04 running hot?'],
    sources: ['datalens_inv_opt.gold_stock_status', 'datalens_inv_opt.forecast_daily'],
  };
}

/* Generic fallback answer for any other question. */
function buildGenericAnswer(q: string): AgentMessage {
  return {
    id: `a-${Math.random().toString(36).slice(2)}`,
    role: 'agent',
    tools: [{ name: 'query_gold_tables', icon: Database }],
    meta: '0.9s · 3.1k rows scanned',
    text: `Here's what I found for “${q.trim()}”. This is a demo response — in the live agent this routes to the accelerator's SQL-backed tools and returns real rows from your Gold tables, filtered to your entitled scope.`,
    followText: 'Want me to go deeper on any dimension?',
    followUps: ['Break down by warehouse', 'Show as a chart', 'Export to dashboard'],
    sources: ['datalens_inv_opt.gold_stock_status'],
  };
}

export default function SolutionAgent() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const wsName = workspaceId || 'inv-opt-supply-chain';

  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const seededRef = useRef(false);

  const send = (raw: string) => {
    const q = raw.trim();
    if (!q || thinking) return;
    const userMsg: AgentMessage = { id: `u-${Math.random().toString(36).slice(2)}`, role: 'user', text: q };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setThinking(true);
    const isStockout = /stockout|stock out|at risk|a-class|a class/i.test(q);
    window.setTimeout(() => {
      setMessages((m) => [...m, isStockout ? buildStockoutAnswer() : buildGenericAnswer(q)]);
      setThinking(false);
    }, 1300);
  };

  // Seed from ?q= (agent prompt on Solution Home), once.
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    const seed = searchParams.get('q');
    if (seed) send(seed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, thinking]);

  return (
    <AppLayout title="Inventory agent" fluid>
      <div className="flex h-full flex-col bg-navy-50/40">
        {/* Header */}
        <header className="flex shrink-0 items-center gap-3 border-b border-navy-100 bg-white px-5 py-2.5">
          <button
            type="button"
            onClick={() => navigate(`/solution/${wsName}`)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-navy-200 text-navy-600 hover:bg-navy-50"
            aria-label="Back to solution"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-violet-800">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-bold text-navy-900">Inventory agent</div>
            <div className="text-[10.5px] text-navy-500">Retail CoE · Inventory Optimization v2.1.0 · 5 tools</div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <span className="flex items-center gap-1 rounded bg-accent-500/10 px-2 py-1 text-[10px] font-semibold text-accent-700">
              <User className="h-3 w-3" />
              Category mgr
            </span>
            <span className="flex items-center gap-1 rounded border border-navy-200 bg-white px-2 py-1 text-[10px] font-medium text-navy-600">
              <ShieldCheck className="h-3 w-3" />
              Your view: 12 warehouses
            </span>
          </div>
        </header>

        {/* Thread */}
        <div ref={scrollRef} className="custom-scrollbar flex-1 overflow-y-auto px-4 py-5">
          <div className="mx-auto flex max-w-3xl flex-col gap-5">
            {messages.length === 0 && !thinking && (
              <EmptyState onPick={send} />
            )}

            {messages.map((m) =>
              m.role === 'user' ? (
                <div
                  key={m.id}
                  className="max-w-[78%] self-end rounded-2xl rounded-br-sm bg-accent-500/10 px-3.5 py-2 text-[12.5px] leading-relaxed text-accent-800"
                >
                  {m.text}
                </div>
              ) : (
                <AgentBubble key={m.id} msg={m} onFollowUp={send} />
              ),
            )}

            {thinking && (
              <div className="flex gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-800">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <div className="flex items-center gap-2 rounded-2xl border border-navy-100 bg-white px-3.5 py-2.5 text-[12px] text-navy-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Querying gold tables…
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        <div className="shrink-0 border-t border-navy-100 bg-white px-4 py-3">
          <div className="mx-auto max-w-3xl">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex items-center gap-2 rounded-xl border border-navy-200 bg-white px-3 py-2 focus-within:border-accent-400 focus-within:ring-2 focus-within:ring-accent-500/20"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about SKUs, warehouses, forecasts, orders…"
                className="flex-1 border-none bg-transparent text-[12.5px] text-navy-800 outline-none placeholder:text-navy-400"
              />
              <button
                type="submit"
                disabled={!input.trim() || thinking}
                className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-500 text-white hover:bg-accent-600 disabled:opacity-40"
                aria-label="Send"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[9.5px] font-semibold uppercase tracking-wider text-navy-400">Quick asks</span>
              {QUICK_ASKS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => send(q)}
                  className="rounded-full border border-navy-200 bg-navy-50/60 px-2.5 py-1 text-[10.5px] text-navy-600 hover:bg-navy-100"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

/* ── Empty state ────────────────────────────────────────────────── */

function EmptyState({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-800">
        <Sparkles className="h-6 w-6" />
      </div>
      <div>
        <p className="text-[14px] font-semibold text-navy-800">Ask the Inventory agent</p>
        <p className="mt-1 text-[12px] text-navy-500">
          It queries your Gold tables and models, filtered to what you're entitled to see.
        </p>
      </div>
      <div className="mt-1 flex flex-col gap-1.5">
        {[
          'Which A-class SKUs are at risk of stockout in the next 14 days?',
          'Show me slow movers over the last 60 days',
          'Compare fill-rate: DC-04 vs DC-11',
        ].map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onPick(q)}
            className="rounded-lg border border-navy-100 bg-white px-3 py-2 text-[11.5px] text-navy-700 hover:border-accent-200 hover:bg-accent-500/5"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Agent bubble ───────────────────────────────────────────────── */

function AgentBubble({ msg, onFollowUp }: { msg: AgentMessage; onFollowUp: (q: string) => void }) {
  return (
    <div className="flex gap-2.5">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-800">
        <Sparkles className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        {/* Tool trace */}
        {msg.tools && msg.tools.length > 0 && (
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <span className="text-[9.5px] font-semibold uppercase tracking-wider text-navy-400">Tools used</span>
            {msg.tools.map((t) => {
              const Icon = t.icon;
              return (
                <span
                  key={t.name}
                  className="flex items-center gap-1 rounded border border-navy-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-navy-700"
                >
                  <Icon className="h-2.5 w-2.5 text-navy-500" />
                  {t.name}
                </span>
              );
            })}
            {msg.meta && <span className="ml-auto text-[9.5px] text-navy-400">{msg.meta}</span>}
          </div>
        )}

        <div className="mb-2.5 text-[12.5px] leading-relaxed text-navy-800">{msg.text}</div>

        {/* Table */}
        {msg.table && (
          <div className="mb-2.5 overflow-hidden rounded-xl border border-navy-100 bg-white">
            <table className="w-full table-fixed text-[11px]">
              <thead>
                <tr className="bg-navy-50/60">
                  {msg.table.columns.map((c, i) => (
                    <th
                      key={c}
                      className={`px-2 py-1.5 text-[9.5px] font-semibold uppercase tracking-wide text-navy-400 ${
                        i === 0 ? 'text-left' : 'text-right'
                      }`}
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {msg.table.rows.map((row, ri) => (
                  <tr key={ri} className="border-t border-navy-100">
                    {row.map((cell, ci) => {
                      const isObj = typeof cell === 'object';
                      const value = isObj ? cell.value : cell;
                      const tone = isObj ? cell.tone : 'plain';
                      return (
                        <td
                          key={ci}
                          className={`px-2 py-1.5 ${ci === 0 ? 'text-left font-mono text-[10.5px] text-navy-800' : 'text-right text-navy-700'}`}
                        >
                          {tone === 'plain' ? (
                            value
                          ) : (
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                tone === 'danger'
                                  ? 'bg-danger-50 text-danger-700'
                                  : 'bg-warn-50 text-warn-700'
                              }`}
                            >
                              {value}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between border-t border-navy-100 bg-navy-50/40 px-2 py-1.5 text-[9.5px] text-navy-500">
              <span>
                {msg.table.moreCount ?? 0} more · <span className="text-accent-600">show all</span>
              </span>
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-success-600" />
                filtered to your entitled warehouses
              </span>
            </div>
          </div>
        )}

        {msg.followText && <div className="mb-2 text-[11.5px] text-navy-600">{msg.followText}</div>}

        {msg.followUps && msg.followUps.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {msg.followUps.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => onFollowUp(f)}
                className="rounded-full border border-navy-300 px-2.5 py-1 text-[10.5px] text-navy-700 hover:bg-navy-50"
              >
                {f}
              </button>
            ))}
          </div>
        )}

        {/* Sources + actions */}
        {msg.sources && msg.sources.length > 0 && (
          <div className="mt-2.5 flex items-center gap-2 border-t border-dashed border-navy-100 pt-1.5 text-[10px] text-navy-400">
            <Database className="h-3 w-3" />
            <span className="truncate font-mono">{msg.sources.join(' · ')}</span>
            <span className="ml-auto flex items-center gap-0.5">
              <button className="rounded p-1 hover:bg-navy-50" aria-label="Copy"><Copy className="h-3 w-3" /></button>
              <button className="rounded p-1 hover:bg-navy-50" aria-label="Good"><ThumbsUp className="h-3 w-3" /></button>
              <button className="rounded p-1 hover:bg-navy-50" aria-label="Bad"><ThumbsDown className="h-3 w-3" /></button>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
