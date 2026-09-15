import { useEffect, useRef, useState } from 'react';
import {
  X,
  Sparkles,
  Brain,
  Loader2,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Database,
  BarChart3,
  Layers,
  Clock,
  HelpCircle,
  Lightbulb,
} from 'lucide-react';
import {
  createDashboard,
  dashboardRunStreamUrl,
  refineDashboardBrief,
} from '../../services/dashboards';
import type {
  ClarificationAnswer,
  RefineBriefQuestion,
} from '../../types/dashboard';

interface Props {
  workspaceId: string;
  onClose: () => void;
  onCreated: (dashboardId: string) => void;
}

// brief → refining → interview → building → done | failed
type WizardStep = 'brief' | 'refining' | 'interview' | 'building' | 'done' | 'failed';

interface BlockProgress {
  block_id: string;
  title: string;
  type: string;
  row_count?: number;
  duration_ms?: number;
  error?: string | null;
  done: boolean;
}

const PRIMARY_BTN =
  'inline-flex items-center gap-2 rounded-lg bg-accent-500 hover:bg-accent-600 disabled:bg-navy-200 disabled:text-navy-400 px-4 py-2 text-[13.5px] font-semibold text-white shadow-sm transition-colors';
const SECONDARY_BTN =
  'inline-flex items-center gap-2 rounded-lg border border-navy-200 bg-white hover:bg-navy-50 px-4 py-2 text-[13.5px] font-semibold text-navy-700 transition-colors';
const INPUT_CLASS =
  'w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-[13.5px] text-navy-800 placeholder:text-navy-400 focus:border-accent-400 focus:ring-2 focus:ring-accent-100 focus:outline-none transition-colors';
const LABEL_CLASS = 'mb-1.5 block text-[12px] font-semibold uppercase tracking-wider text-navy-500';

const REFRESH_OPTIONS: { label: string; value: number }[] = [
  { label: '15 minutes', value: 15 },
  { label: '1 hour', value: 60 },
  { label: '4 hours', value: 240 },
  { label: 'Daily', value: 1440 },
  { label: 'Weekly', value: 10080 },
];

export default function CreateDashboardWizard({ workspaceId, onClose, onCreated }: Props) {
  const [step, setStep] = useState<WizardStep>('brief');
  const [persona, setPersona] = useState('');
  const [objective, setObjective] = useState('');
  const [scopeNotes, setScopeNotes] = useState('');
  const [titleHint, setTitleHint] = useState('');
  const [refreshMinutes, setRefreshMinutes] = useState(60);

  const [planTitle, setPlanTitle] = useState('');
  const [planTabCount, setPlanTabCount] = useState(0);
  const [totalBlocks, setTotalBlocks] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [progressLog, setProgressLog] = useState<BlockProgress[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Brief-refiner / interview state
  const [understanding, setUnderstanding] = useState('');
  const [questions, setQuestions] = useState<RefineBriefQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const dashboardIdRef = useRef<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    return () => {
      esRef.current?.close();
    };
  }, []);

  const canSubmit = persona.trim().length >= 2 && objective.trim().length >= 10;

  // Step 1 → 1.5: send brief to the agent, get back its read-back +
  // clarifying questions. If the agent returns no questions, jump
  // straight to build (the brief was already detailed enough).
  const goToInterview = async () => {
    if (!canSubmit) return;
    setErrorMsg(null);
    setStep('refining');
    try {
      const res = await refineDashboardBrief(workspaceId, {
        persona: persona.trim(),
        objective: objective.trim(),
        scope_notes: scopeNotes.trim() || undefined,
      });
      setUnderstanding(res.understanding || '');
      setQuestions(res.questions || []);
      // Pre-fill suggested answers so users can one-click accept
      const seed: Record<string, string> = {};
      for (const q of res.questions || []) {
        if (q.suggested_answer) seed[q.id] = q.suggested_answer;
      }
      setAnswers(seed);
      if (!res.questions || res.questions.length === 0) {
        // Nothing to ask — go straight to build with empty clarifications.
        await build([]);
        return;
      }
      setStep('interview');
    } catch (e) {
      // Refiner failed — don't block the user, fall through to build
      // without clarifications. They still get the (already richer)
      // direct planner pass.
      setUnderstanding('');
      setQuestions([]);
      setAnswers({});
      console.warn('refine-brief failed:', e);
      await build([]);
    }
  };

  // Step 2: build the dashboard, optionally with clarifications.
  const build = async (clarifications: ClarificationAnswer[]) => {
    setErrorMsg(null);
    setStep('building');
    try {
      const res = await createDashboard(workspaceId, {
        persona: persona.trim(),
        objective: objective.trim(),
        scope_notes: scopeNotes.trim() || undefined,
        title: titleHint.trim() || undefined,
        refresh_interval_minutes: refreshMinutes,
        clarifications,
      });
      dashboardIdRef.current = res.dashboard_id;
      setPlanTitle(res.title);
      setPlanTabCount(res.tabs);
      setTotalBlocks(res.blocks);

      // Open SSE
      esRef.current?.close();
      const es = new EventSource(dashboardRunStreamUrl(res.run_id));
      esRef.current = es;

      es.addEventListener('plan_ready', (e) => {
        try {
          const d = JSON.parse((e as MessageEvent).data);
          setPlanTitle(d.title || '');
          setPlanTabCount(d.tabs || 0);
        } catch {
          /* ignore */
        }
      });

      es.addEventListener('block_done', (e) => {
        try {
          const d = JSON.parse((e as MessageEvent).data);
          setCompleted(d.completed || 0);
          setTotalBlocks(d.total || 0);
          setProgressLog((prev) => [
            ...prev,
            {
              block_id: d.block_id,
              title: d.title,
              type: d.type,
              row_count: d.row_count,
              duration_ms: d.duration_ms,
              error: d.error,
              done: true,
            },
          ]);
        } catch {
          /* ignore */
        }
      });

      es.addEventListener('done', () => {
        es.close();
        esRef.current = null;
        setStep('done');
      });

      es.addEventListener('error', (e) => {
        try {
          const d = JSON.parse((e as MessageEvent).data);
          setErrorMsg(d.message || 'Build failed');
        } catch {
          /* ignore */
        }
        es.close();
        esRef.current = null;
        setStep('failed');
      });

      es.onerror = () => {
        // Stream errors are common after `done` — only treat as failure
        // if we never reached the success state.
        if (esRef.current) {
          esRef.current.close();
          esRef.current = null;
        }
      };
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Failed to start build');
      setStep('failed');
    }
  };

  const handleClose = () => {
    esRef.current?.close();
    esRef.current = null;
    onClose();
  };

  const openDashboard = () => {
    if (dashboardIdRef.current) {
      onCreated(dashboardIdRef.current);
    } else {
      handleClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/50 px-4 backdrop-blur-sm animate-fade-in">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl animate-fade-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-navy-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent-500 text-white shadow-sm">
              <Sparkles className="h-4 w-4" />
            </span>
            <h2 className="text-[17px] font-semibold tracking-tight text-navy-900">
              {step === 'brief' && 'Create dashboard'}
              {step === 'refining' && 'Reading your brief…'}
              {step === 'interview' && 'A few clarifications'}
              {step === 'building' && 'Building dashboard…'}
              {step === 'done' && 'Dashboard ready'}
              {step === 'failed' && 'Build failed'}
            </h2>
          </div>
          {step !== 'building' && step !== 'refining' && (
            <button
              type="button"
              onClick={handleClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-navy-400 transition-colors hover:bg-navy-50 hover:text-navy-700"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="custom-scrollbar flex-1 overflow-y-auto p-6">
          {step === 'brief' && (
            <BriefStep
              persona={persona}
              objective={objective}
              scopeNotes={scopeNotes}
              titleHint={titleHint}
              refreshMinutes={refreshMinutes}
              onPersona={setPersona}
              onObjective={setObjective}
              onScope={setScopeNotes}
              onTitle={setTitleHint}
              onRefresh={setRefreshMinutes}
            />
          )}
          {step === 'refining' && (
            <div className="flex flex-col items-center py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-50 text-accent-600 ring-1 ring-inset ring-accent-200">
                <Brain className="h-6 w-6 animate-pulse" />
              </div>
              <h3 className="mt-3 text-[15px] font-semibold text-navy-900">
                Reading your brief…
              </h3>
              <p className="mt-1 max-w-md text-[13px] leading-relaxed text-navy-500">
                The agent is reading your data profile and figuring out what it
                needs to clarify with you before designing the dashboard.
              </p>
              <Loader2 className="mt-4 h-4 w-4 animate-spin text-accent-500" />
            </div>
          )}
          {step === 'interview' && (
            <InterviewStep
              understanding={understanding}
              questions={questions}
              answers={answers}
              onAnswerChange={(id, val) =>
                setAnswers((prev) => ({ ...prev, [id]: val }))
              }
            />
          )}
          {(step === 'building' || step === 'done') && (
            <BuildProgress
              title={planTitle}
              tabs={planTabCount}
              completed={completed}
              total={totalBlocks}
              log={progressLog}
              done={step === 'done'}
            />
          )}
          {step === 'failed' && (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-danger-50 text-danger-600 ring-1 ring-inset ring-danger-500/20">
                <AlertCircle className="h-6 w-6" />
              </div>
              <h3 className="mt-3 text-[15px] font-semibold text-navy-900">Build failed</h3>
              <p className="mt-1 max-w-md text-[13px] text-navy-500">
                {errorMsg || 'The agent couldn\'t produce a dashboard for this brief.'}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-navy-100 bg-navy-50/50 px-6 py-4">
          {step === 'brief' && (
            <>
              <button type="button" onClick={handleClose} className={SECONDARY_BTN}>
                Cancel
              </button>
              <button type="button" onClick={goToInterview} disabled={!canSubmit} className={PRIMARY_BTN}>
                <Brain className="h-4 w-4" />
                Continue
              </button>
            </>
          )}
          {step === 'refining' && (
            <>
              <span className="text-[12px] text-navy-500">
                The agent is interviewing your brief…
              </span>
              <button type="button" disabled className={PRIMARY_BTN}>
                <Loader2 className="is-spinner h-4 w-4" />
                Reading…
              </button>
            </>
          )}
          {step === 'interview' && (
            <>
              <button
                type="button"
                onClick={() => setStep('brief')}
                className={SECONDARY_BTN}
              >
                <ArrowLeft className="h-4 w-4" />
                Back to brief
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void build([])}
                  className={SECONDARY_BTN}
                  title="Skip the questions and let the agent decide"
                >
                  Skip
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void build(
                      questions.map((q) => ({
                        id: q.id,
                        question: q.question,
                        answer: (answers[q.id] || '').trim(),
                      })),
                    )
                  }
                  className={PRIMARY_BTN}
                >
                  <Brain className="h-4 w-4" />
                  Build dashboard
                </button>
              </div>
            </>
          )}
          {step === 'building' && (
            <>
              <span className="text-[12px] text-navy-500">
                Don't close this window — the agent is running queries.
              </span>
              <button type="button" disabled className={PRIMARY_BTN}>
                <Loader2 className="is-spinner h-4 w-4" />
                Building…
              </button>
            </>
          )}
          {step === 'done' && (
            <>
              <button type="button" onClick={handleClose} className={SECONDARY_BTN}>
                Close
              </button>
              <button type="button" onClick={openDashboard} className={PRIMARY_BTN}>
                Open dashboard
                <ArrowRight className="h-4 w-4" />
              </button>
            </>
          )}
          {step === 'failed' && (
            <>
              <button type="button" onClick={handleClose} className={SECONDARY_BTN}>
                Close
              </button>
              <button type="button" onClick={() => setStep('brief')} className={PRIMARY_BTN}>
                Try again
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Step 1: Brief ─── */
/* ─── Step 1.5: Interview (clarifying Q&A) ─── */
function InterviewStep(p: {
  understanding: string;
  questions: RefineBriefQuestion[];
  answers: Record<string, string>;
  onAnswerChange: (id: string, value: string) => void;
}) {
  return (
    <div className="space-y-5">
      {p.understanding && (
        <div className="rounded-xl border border-accent-200 bg-accent-50/40 px-4 py-3">
          <div className="flex items-start gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-accent-700 ring-1 ring-inset ring-accent-200">
              <Brain className="h-3.5 w-3.5" />
            </span>
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-accent-700">
                What I understood
              </p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-navy-800">
                {p.understanding}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-1">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-navy-500">
          A few things I'd like to clarify
        </p>
        <p className="text-[12px] text-navy-500">
          Answer what you can — anything you skip, the agent will infer from the
          data. Suggested answers are pre-filled where it has a sensible default.
        </p>
      </div>

      <div className="space-y-3">
        {p.questions.map((q, i) => (
          <div
            key={q.id}
            className="rounded-xl border border-navy-100 bg-white p-3.5 shadow-sm"
          >
            <div className="flex items-start gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-50 text-[10.5px] font-bold text-accent-700 ring-1 ring-inset ring-accent-200">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-semibold leading-snug text-navy-900">
                  {q.question}
                </p>
                {q.why_we_ask && (
                  <p className="mt-0.5 flex items-start gap-1 text-[11.5px] italic text-navy-500">
                    <Lightbulb className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                    {q.why_we_ask}
                  </p>
                )}
              </div>
            </div>
            <textarea
              value={p.answers[q.id] || ''}
              onChange={(e) => p.onAnswerChange(q.id, e.target.value)}
              placeholder={
                q.suggested_answer
                  ? `Suggested: ${q.suggested_answer}`
                  : 'Your answer (one sentence is fine)'
              }
              rows={2}
              className="mt-2 w-full resize-none rounded-lg border border-navy-200 bg-white px-3 py-2 text-[13px] text-navy-800 placeholder:text-navy-400 focus:border-accent-400 focus:ring-2 focus:ring-accent-100 focus:outline-none transition-colors"
            />
          </div>
        ))}
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-navy-100 bg-navy-50/40 px-3 py-2.5 text-[11.5px] text-navy-600">
        <HelpCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-navy-400" />
        <span>
          Click <strong>Build dashboard</strong> when you're ready — your answers
          go into the planner as additional context. Click <strong>Skip</strong>{' '}
          to let the agent build with just your original brief.
        </span>
      </div>
    </div>
  );
}

/* ─── Step 1: Brief ─── */
function BriefStep(p: {
  persona: string;
  objective: string;
  scopeNotes: string;
  titleHint: string;
  refreshMinutes: number;
  onPersona: (v: string) => void;
  onObjective: (v: string) => void;
  onScope: (v: string) => void;
  onTitle: (v: string) => void;
  onRefresh: (v: number) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <label className={LABEL_CLASS}>Audience (free text)</label>
        <input
          value={p.persona}
          onChange={(e) => p.onPersona(e.target.value)}
          placeholder="e.g. CFO of a textile distributor, head of sales for the EMEA region…"
          className={INPUT_CLASS}
        />
        <p className="mt-1 text-[11.5px] text-navy-400">
          Be as specific as you can — the agent tunes KPIs and tabs to this audience.
        </p>
      </div>

      <div>
        <label className={LABEL_CLASS}>Objective / decision the dashboard supports</label>
        <textarea
          value={p.objective}
          onChange={(e) => p.onObjective(e.target.value)}
          rows={3}
          placeholder="e.g. Track quarterly revenue health, surface customer concentration risk, monitor inventory turnover by collection."
          className={INPUT_CLASS}
        />
      </div>

      <div>
        <label className={LABEL_CLASS}>Scope notes (optional)</label>
        <textarea
          value={p.scopeNotes}
          onChange={(e) => p.onScope(e.target.value)}
          rows={2}
          placeholder="Time range, regions, filters to apply, metrics that matter most…"
          className={INPUT_CLASS}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={LABEL_CLASS}>Title hint (optional)</label>
          <input
            value={p.titleHint}
            onChange={(e) => p.onTitle(e.target.value)}
            placeholder="Auto-generated if blank"
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className={LABEL_CLASS}>Auto-refresh</label>
          <select
            value={p.refreshMinutes}
            onChange={(e) => p.onRefresh(Number(e.target.value))}
            className={INPUT_CLASS}
          >
            {REFRESH_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

/* ─── Step 2/3: Build progress ─── */
function BuildProgress(p: {
  title: string;
  tabs: number;
  completed: number;
  total: number;
  log: BlockProgress[];
  done: boolean;
}) {
  const pct = p.total > 0 ? Math.min(100, Math.round((p.completed / p.total) * 100)) : 0;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-accent-200 bg-gradient-to-br from-accent-50 via-white to-white p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-500 text-white shadow-sm">
            {p.done ? <CheckCircle2 className="h-5 w-5" /> : <Brain className="h-5 w-5 animate-pulse" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-accent-700">
              {p.done ? 'Dashboard ready' : 'Building dashboard'}
            </p>
            <h3 className="text-[15px] font-semibold leading-tight text-navy-900">
              {p.title || 'Planning…'}
            </h3>
            <p className="mt-0.5 text-[11.5px] text-navy-500">
              <Layers className="mr-1 inline h-3 w-3 align-[-2px]" />
              {p.tabs} tab{p.tabs !== 1 ? 's' : ''} ·{' '}
              {p.completed} / {p.total} block{p.total !== 1 ? 's' : ''} completed
            </p>
          </div>
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-navy-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-accent-500 to-accent-600 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div>
        <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-navy-500">
          Build log
        </p>
        <div className="custom-scrollbar max-h-72 space-y-1 overflow-y-auto rounded-xl border border-navy-100 bg-white p-2">
          {p.log.length === 0 ? (
            <p className="px-2 py-3 text-[12.5px] italic text-navy-400">
              Reviewing your data and planning queries…
            </p>
          ) : (
            p.log.map((step, i) => <BuildLogRow key={`${step.block_id}-${i}`} step={step} />)
          )}
        </div>
      </div>
    </div>
  );
}

function BuildLogRow({ step }: { step: BlockProgress }) {
  const Icon = step.type === 'kpi' ? Sparkles : step.type === 'chart' ? BarChart3 : Database;
  const isError = !!step.error;
  return (
    <div className="flex items-start gap-2.5 rounded-md px-2 py-1.5">
      <div
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
          isError ? 'bg-danger-50 text-danger-600' : 'bg-emerald-50 text-emerald-600'
        }`}
      >
        {isError ? <AlertCircle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] leading-snug text-navy-700">
          <Icon className="mr-1 inline h-3 w-3 align-[-2px] text-navy-400" />
          <span className="font-medium">{step.title}</span>
        </p>
        {!isError ? (
          <p className="mt-0.5 text-[11px] text-navy-400">
            {step.row_count ?? 0} rows
            {step.duration_ms != null && (
              <>
                {' · '}
                <Clock className="inline h-3 w-3 align-[-2px]" /> {Math.round(step.duration_ms)}ms
              </>
            )}
          </p>
        ) : (
          <p className="mt-0.5 line-clamp-2 text-[11px] italic text-danger-600">{step.error}</p>
        )}
      </div>
    </div>
  );
}
