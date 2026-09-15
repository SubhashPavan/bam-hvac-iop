import { useEffect, useMemo, useState } from 'react';
import {
  X,
  Brain,
  Loader2,
  Play,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Activity,
  Users,
  Clock,
  Database,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { getModelStats, testModel, deleteModel, saveSample } from '../../services/modelRegistry';
import {
  PROVIDER_LABELS,
  AUTH_LABELS,
  type RegisteredModel,
  type ModelStats,
  type TestResult,
  type ModelStatus,
} from '../../types/modelRegistry';

const STATUS_TONE: Record<ModelStatus, string> = {
  active: 'bg-success-50 text-success-700 ring-success-500/25',
  inactive: 'bg-navy-100 text-navy-600 ring-navy-200',
  drift: 'bg-warn-50 text-warn-700 ring-warn-500/25',
  error: 'bg-danger-50 text-danger-700 ring-danger-500/25',
  training: 'bg-accent-50 text-accent-700 ring-accent-200',
  deprecated: 'bg-navy-100 text-navy-500 ring-navy-200',
};

type Tab = 'overview' | 'stats' | 'test' | 'training' | 'history';

interface Props {
  model: RegisteredModel;
  onClose: () => void;
  onDeleted: () => void;
}

export default function ModelDetailDrawer({ model, onClose, onDeleted }: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<ModelStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  // Test tab state — default the payload from the model's sample_payload
  // when one has been registered; otherwise a bare skeleton.
  const initialPayload = useMemo(() => {
    if (model.sample_payload && Object.keys(model.sample_payload).length > 0) {
      return JSON.stringify(model.sample_payload, null, 2);
    }
    return '{\n  "example": "value"\n}';
  }, [model.sample_payload]);
  const [payloadText, setPayloadText] = useState(initialPayload);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testErr, setTestErr] = useState<string | null>(null);
  const [saveSampleState, setSaveSampleState] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    // Close on Escape
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (tab !== 'stats' && tab !== 'history') return;
    if (stats) return; // cached for the session of this drawer
    setLoadingStats(true);
    setStatsError(null);
    getModelStats(model.id)
      .then(setStats)
      .catch((e) => setStatsError(e instanceof Error ? e.message : 'Failed to load stats'))
      .finally(() => setLoadingStats(false));
  }, [tab, model.id, stats]);

  const handleTest = async () => {
    setTesting(true);
    setTestErr(null);
    setTestResult(null);
    let payload: Record<string, unknown> | undefined;
    if (payloadText.trim()) {
      try {
        payload = JSON.parse(payloadText);
      } catch {
        setTestErr('Payload isn’t valid JSON');
        setTesting(false);
        return;
      }
    }
    try {
      const r = await testModel(model.id, payload);
      setTestResult(r);
      // Invalidate cached stats so next visit refreshes
      setStats(null);
    } catch (e) {
      setTestErr(e instanceof Error ? e.message : 'Test failed');
    } finally {
      setTesting(false);
    }
  };

  const handleSaveSample = async () => {
    if (!testResult) return;
    let payloadJson: unknown = payloadText;
    try {
      payloadJson = JSON.parse(payloadText);
    } catch {
      /* keep as string — backend will wrap it */
    }
    let responseJson: unknown = testResult.response_preview;
    if (testResult.response_preview) {
      try {
        responseJson = JSON.parse(testResult.response_preview);
      } catch {
        /* keep string, backend wraps */
      }
    }
    setSaveSampleState('saving');
    try {
      await saveSample(model.id, payloadJson, responseJson);
      // Reflect on the in-memory model so subsequent opens see it
      (model as { sample_payload: unknown; sample_response: unknown }).sample_payload =
        (payloadJson as Record<string, unknown>) ?? {};
      (model as { sample_payload: unknown; sample_response: unknown }).sample_response =
        (responseJson as Record<string, unknown>) ?? {};
      setSaveSampleState('saved');
      setTimeout(() => setSaveSampleState('idle'), 2000);
    } catch (e) {
      setTestErr(e instanceof Error ? e.message : 'Save failed');
      setSaveSampleState('idle');
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${model.display_name}"?`)) return;
    try {
      await deleteModel(model.id);
      onDeleted();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
  };

  return (
    <div className="fixed inset-0 z-40 flex bg-navy-900/40 backdrop-blur-sm animate-fade-in">
      <div className="flex-1" onClick={onClose} />
      <div className="flex h-full w-full max-w-3xl flex-col bg-white shadow-2xl">
        {/* Header */}
        <header className="flex shrink-0 items-start gap-3 border-b border-navy-100 px-6 py-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-navy-100 text-navy-600">
            <Brain className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h2 className="text-[17px] font-bold tracking-tight text-navy-900">
                {model.display_name}
              </h2>
              <span
                className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider ring-1 ring-inset ${STATUS_TONE[model.status]}`}
              >
                {model.status}
              </span>
            </div>
            <p className="mt-0.5 font-mono text-[11.5px] text-navy-500">
              {model.name} · v{model.version} · hosted on {PROVIDER_LABELS[model.provider]}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleDelete}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-navy-400 hover:bg-danger-50 hover:text-danger-600"
              title="Delete model"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-navy-400 hover:bg-navy-50 hover:text-navy-700"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Tabs */}
        <div className="flex shrink-0 border-b border-navy-100 bg-navy-50/40 px-4">
          {(
            [
              { id: 'overview', label: 'Overview' },
              { id: 'stats', label: 'Stats' },
              { id: 'test', label: 'Test' },
              { id: 'training', label: 'Training data' },
              { id: 'history', label: 'History' },
            ] as { id: Tab; label: string }[]
          ).map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`border-b-2 px-3 py-2.5 text-[12.5px] font-semibold transition-colors ${
                  active
                    ? 'border-accent-500 text-navy-900'
                    : 'border-transparent text-navy-500 hover:text-navy-700'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="custom-scrollbar flex-1 overflow-y-auto px-6 py-5">
          {tab === 'overview' && (
            <OverviewTab model={model} onCopy={copy} />
          )}
          {tab === 'stats' && (
            <StatsTab stats={stats} loading={loadingStats} error={statsError} />
          )}
          {tab === 'test' && (
            <TestTab
              method={model.http_method || 'POST'}
              endpoint={model.endpoint_url}
              payloadText={payloadText}
              setPayloadText={setPayloadText}
              onTest={handleTest}
              testing={testing}
              result={testResult}
              err={testErr}
              onSaveSample={handleSaveSample}
              saveState={saveSampleState}
              hasSample={!!(model.sample_payload && Object.keys(model.sample_payload).length > 0)}
            />
          )}
          {tab === 'training' && (
            <TrainingTab model={model} onCopy={copy} />
          )}
          {tab === 'history' && (
            <HistoryTab stats={stats} loading={loadingStats} error={statsError} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Overview ─────────────────────────────────────────────────── */

function OverviewTab({ model, onCopy }: { model: RegisteredModel; onCopy: (s: string) => void }) {
  return (
    <div className="space-y-5">
      {model.description && (
        <p className="text-[13.5px] leading-relaxed text-navy-700">{model.description}</p>
      )}

      <MetadataGrid
        rows={[
          { label: 'Algorithm', value: model.algorithm || '—' },
          { label: 'Framework', value: model.framework || '—' },
          { label: 'Provider', value: PROVIDER_LABELS[model.provider] },
          { label: 'Serving mode', value: model.serving_mode },
          { label: 'Auth method', value: AUTH_LABELS[model.auth_method] },
          {
            label: 'Cost hint',
            value: model.cost_hint_usd > 0 ? `$${model.cost_hint_usd.toFixed(4)} / call` : '—',
          },
        ]}
      />

      <section>
        <SectionLabel>Endpoint</SectionLabel>
        <div className="flex items-center gap-2 rounded-lg border border-navy-200 bg-navy-50/60 px-3 py-2">
          <span className="shrink-0 rounded bg-navy-800 px-1.5 py-0.5 font-mono text-[10.5px] font-bold text-white">
            {model.http_method || 'POST'}
          </span>
          <code className="flex-1 truncate font-mono text-[12px] text-navy-800">
            {model.endpoint_url}
          </code>
          <button
            type="button"
            onClick={() => onCopy(model.endpoint_url)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-navy-400 hover:bg-navy-100 hover:text-navy-700"
            title="Copy"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
        {model.credentials_ref && (
          <p className="mt-1 text-[11px] text-navy-500">
            Credentials via <code className="font-mono text-[11px]">{model.credentials_ref}</code>
          </p>
        )}
        {model.custom_headers && Object.keys(model.custom_headers).length > 0 && (
          <div className="mt-2">
            <SectionLabel>Custom headers</SectionLabel>
            <div className="rounded-lg border border-navy-100 bg-white p-2 font-mono text-[11px] text-navy-700">
              {Object.entries(model.custom_headers).map(([k, v]) => (
                <div key={k}>
                  <span className="text-navy-500">{k}:</span> {v}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {(model.sample_payload && Object.keys(model.sample_payload).length > 0) ||
      (model.sample_response && Object.keys(model.sample_response).length > 0) ? (
        <section>
          <SectionLabel>How to invoke — sample contract</SectionLabel>
          <div className="grid gap-3 md:grid-cols-2">
            {model.sample_payload && Object.keys(model.sample_payload).length > 0 && (
              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-navy-400">
                  Request payload
                </div>
                <pre className="max-h-52 overflow-auto rounded-lg border border-navy-100 bg-navy-50/40 px-3 py-2 font-mono text-[11px] text-navy-800">
{JSON.stringify(model.sample_payload, null, 2)}
                </pre>
              </div>
            )}
            {model.sample_response && Object.keys(model.sample_response).length > 0 && (
              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-navy-400">
                  Response
                </div>
                <pre className="max-h-52 overflow-auto rounded-lg border border-navy-100 bg-navy-50/40 px-3 py-2 font-mono text-[11px] text-navy-800">
{JSON.stringify(model.sample_response, null, 2)}
                </pre>
              </div>
            )}
          </div>
          <p className="mt-1 text-[10.5px] italic text-navy-500">
            Pipeline nodes use this as the reference contract when binding their inputs and outputs.
          </p>
        </section>
      ) : (
        <section>
          <SectionLabel>How to invoke</SectionLabel>
          <div className="rounded-lg border border-dashed border-navy-200 bg-navy-50/40 px-4 py-3 text-[12px] text-navy-600">
            No sample payload / response registered yet. Fire an invocation from the <em>Test</em> tab and click <em>Save as sample</em> to capture the contract.
          </div>
        </section>
      )}

      {model.tags.length > 0 && (
        <section>
          <SectionLabel>Tags</SectionLabel>
          <div className="flex flex-wrap gap-1">
            {model.tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center rounded-md bg-navy-100 px-1.5 py-0.5 text-[11px] text-navy-700"
              >
                #{t}
              </span>
            ))}
          </div>
        </section>
      )}

      {Object.keys(model.metrics || {}).length > 0 && (
        <section>
          <SectionLabel>Reported metrics (from registration)</SectionLabel>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {Object.entries(model.metrics).map(([k, v]) => (
              <div key={k} className="rounded-lg border border-navy-100 bg-white p-2.5">
                <div className="text-[9.5px] uppercase tracking-wider text-navy-500">{k}</div>
                <div className="text-[16px] font-bold tabular-nums text-navy-900">
                  {typeof v === 'number' ? formatMetric(k, v) : String(v)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionLabel>Provenance</SectionLabel>
        <MetadataGrid
          rows={[
            { label: 'Registered', value: fmtDate(model.created_at) },
            { label: 'Updated', value: fmtDate(model.updated_at) },
            { label: 'Last invoked', value: fmtDate(model.last_invoked_at) },
            { label: 'Usage count', value: model.usage_count.toLocaleString() },
          ]}
        />
      </section>
    </div>
  );
}

/* ── Stats ────────────────────────────────────────────────────── */

function StatsTab({
  stats,
  loading,
  error,
}: {
  stats: ModelStats | null;
  loading: boolean;
  error: string | null;
}) {
  if (loading && !stats) return <LoadingBox label="Loading stats…" />;
  if (error) return <ErrorBox message={error} />;
  if (!stats || stats.total === 0) return <EmptyBox message="No invocations recorded yet. Use the Test tab to fire one." />;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total calls" value={stats.total.toLocaleString()} tone="navy" icon={Activity} />
        <StatCard
          label="Success rate"
          value={`${stats.success_rate}%`}
          tone={stats.success_rate >= 95 ? 'success' : stats.success_rate >= 80 ? 'warn' : 'danger'}
          icon={CheckCircle2}
        />
        <StatCard label="Avg latency" value={`${stats.avg_duration_ms} ms`} tone="navy" icon={Clock} />
        <StatCard label="p95 latency" value={`${stats.p95_duration_ms} ms`} tone="navy" icon={Clock} />
      </div>

      {stats.by_workspace.length > 0 && (
        <section>
          <SectionLabel>Which workspaces call this model</SectionLabel>
          <div className="rounded-xl border border-navy-100 bg-white">
            {stats.by_workspace.map((w, i) => {
              const maxCalls = Math.max(...stats.by_workspace.map((x) => x.calls), 1);
              const pct = Math.round((w.calls / maxCalls) * 100);
              return (
                <div
                  key={w.workspace_id + i}
                  className={`relative overflow-hidden px-4 py-3 ${
                    i > 0 ? 'border-t border-navy-100' : ''
                  }`}
                >
                  <div
                    className="absolute inset-y-0 left-0 bg-accent-50"
                    style={{ width: `${pct}%` }}
                    aria-hidden
                  />
                  <div className="relative flex items-center gap-3">
                    <Users className="h-3.5 w-3.5 shrink-0 text-navy-400" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-navy-800">
                        {w.workspace_name}
                      </p>
                      <p className="truncate text-[11px] text-navy-500">
                        {w.calls.toLocaleString()} calls · {w.success_rate}% ok · {w.avg_ms} ms avg
                      </p>
                    </div>
                    <div className="text-[12px] font-bold tabular-nums text-navy-900">
                      {w.calls.toLocaleString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {stats.by_day.length > 0 && (
        <section>
          <SectionLabel>Calls per day (last 14 days)</SectionLabel>
          <MiniBarChart data={stats.by_day} />
        </section>
      )}
    </div>
  );
}

/* ── Test ─────────────────────────────────────────────────────── */

function TestTab({
  method,
  endpoint,
  payloadText,
  setPayloadText,
  onTest,
  testing,
  result,
  err,
  onSaveSample,
  saveState,
  hasSample,
}: {
  method: string;
  endpoint: string;
  payloadText: string;
  setPayloadText: (s: string) => void;
  onTest: () => void;
  testing: boolean;
  result: TestResult | null;
  err: string | null;
  onSaveSample: () => void;
  saveState: 'idle' | 'saving' | 'saved';
  hasSample: boolean;
}) {
  return (
    <div className="space-y-4">
      <div>
        <SectionLabel>Endpoint being called</SectionLabel>
        <code className="block truncate rounded-lg border border-navy-200 bg-navy-50/60 px-3 py-2 font-mono text-[12px] text-navy-800">
          {method} {endpoint}
        </code>
        {!hasSample && (
          <p className="mt-1 text-[11px] text-navy-500">
            No sample payload registered — using a placeholder. Run a successful invoke, then click <em>Save as sample</em> so future users get the right default.
          </p>
        )}
      </div>

      <div>
        <SectionLabel>Request payload (JSON)</SectionLabel>
        <textarea
          value={payloadText}
          onChange={(e) => setPayloadText(e.target.value)}
          rows={8}
          spellCheck={false}
          className="w-full resize-none rounded-lg border border-navy-200 bg-white px-3 py-2 font-mono text-[12px] text-navy-900 focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-100"
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onTest}
          disabled={testing}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent-500 px-4 py-1.5 text-[12.5px] font-semibold text-white shadow-sm hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {testing ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Invoking…
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5" />
              Invoke endpoint
            </>
          )}
        </button>
        {result && result.ok && (
          <button
            type="button"
            onClick={onSaveSample}
            disabled={saveState === 'saving'}
            className="inline-flex items-center gap-1.5 rounded-lg border border-navy-200 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-navy-700 hover:bg-navy-50 disabled:opacity-60"
          >
            {saveState === 'saving' ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
              </>
            ) : saveState === 'saved' ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-success-600" /> Saved
              </>
            ) : (
              <>
                <Database className="h-3.5 w-3.5" /> Save as sample
              </>
            )}
          </button>
        )}
        <p className="text-[11px] text-navy-500">Recorded as an invocation for stats tracking.</p>
      </div>

      {err && <ErrorBox message={err} />}

      {result && (
        <div className={`space-y-2 rounded-xl border p-3 ${result.ok ? 'border-success-500/25 bg-success-50' : 'border-danger-500/25 bg-danger-50'}`}>
          <div className="flex items-center gap-3 text-[13px] font-semibold">
            {result.ok ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-success-600" />
                <span className="text-success-800">
                  {result.status_code} · {result.duration_ms} ms
                </span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4 text-danger-600" />
                <span className="text-danger-800">
                  {result.status_code ? `HTTP ${result.status_code}` : 'Failed'} · {result.duration_ms} ms
                </span>
              </>
            )}
          </div>
          {result.error && (
            <p className="text-[11.5px] text-danger-700">
              <span className="font-semibold">Error:</span> {result.error}
            </p>
          )}
          {result.note && (
            <p className="text-[11.5px] italic text-navy-600">{result.note}</p>
          )}
          {result.response_preview && (
            <div>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-navy-500">
                Response
              </div>
              <pre className="max-h-52 overflow-auto rounded-md bg-white px-2 py-1.5 font-mono text-[11px] text-navy-800">
{result.response_preview}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Training data ────────────────────────────────────────────── */

function TrainingTab({ model, onCopy }: { model: RegisteredModel; onCopy: (s: string) => void }) {
  const ref = model.training_data_ref || '';
  const isCloud = ref.startsWith('s3://') || ref.startsWith('adls://') || ref.startsWith('gs://') || ref.startsWith('onelake://');

  if (!ref) {
    return (
      <EmptyBox
        message="No training data reference on file. Add one via the register / edit flow so downstream consumers know what this model was fit on."
      />
    );
  }

  return (
    <div className="space-y-4">
      <section>
        <SectionLabel>Training data reference</SectionLabel>
        <div className="flex items-center gap-2 rounded-lg border border-navy-200 bg-navy-50/60 px-3 py-2">
          <Database className="h-3.5 w-3.5 shrink-0 text-navy-400" />
          <code className="flex-1 truncate font-mono text-[12px] text-navy-800">{ref}</code>
          <button
            type="button"
            onClick={() => onCopy(ref)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-navy-400 hover:bg-navy-100 hover:text-navy-700"
            title="Copy"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-navy-500">
          {isCloud
            ? 'Deep-linked preview isn’t built yet — for now, copy the path and open in your lakehouse browser.'
            : 'Looks like a table reference. Preview isn’t built yet — copy and query it in your warehouse.'}
        </p>
      </section>

      {model.last_trained_at && (
        <MetadataGrid
          rows={[
            { label: 'Last trained', value: fmtDate(model.last_trained_at) },
          ]}
        />
      )}

      <div className="rounded-lg border border-dashed border-navy-200 bg-navy-50/40 px-4 py-3 text-[12px] leading-relaxed text-navy-600">
        <p className="font-semibold text-navy-700">Roadmap</p>
        <p className="mt-0.5">
          Row samples + column stats + feature-drift comparison against current serving data will land in a later
          iteration. For v1, this tab surfaces the reference + copy-to-clipboard so a data engineer can inspect it in
          whatever query tool they prefer.
        </p>
      </div>
    </div>
  );
}

/* ── History ──────────────────────────────────────────────────── */

function HistoryTab({
  stats,
  loading,
  error,
}: {
  stats: ModelStats | null;
  loading: boolean;
  error: string | null;
}) {
  if (loading && !stats) return <LoadingBox label="Loading history…" />;
  if (error) return <ErrorBox message={error} />;
  if (!stats || stats.recent.length === 0)
    return <EmptyBox message="No invocations recorded yet." />;

  return (
    <div className="space-y-3">
      <SectionLabel>Last 20 invocations</SectionLabel>
      <div className="rounded-xl border border-navy-100 bg-white">
        {stats.recent.map((inv, i) => (
          <div
            key={inv.id}
            className={`flex items-center gap-3 px-4 py-2.5 ${i > 0 ? 'border-t border-navy-100' : ''}`}
          >
            <span
              className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                inv.success ? 'bg-success-50 text-success-700' : 'bg-danger-50 text-danger-700'
              }`}
            >
              {inv.success ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[12px] font-semibold text-navy-800">
                <span>
                  {inv.status_code || '—'} · {inv.duration_ms} ms
                </span>
                <span className="rounded bg-navy-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-navy-500">
                  {inv.source}
                </span>
              </div>
              {inv.error && (
                <p className="mt-0.5 truncate text-[11px] text-danger-600" title={inv.error}>
                  {inv.error}
                </p>
              )}
              <p className="mt-0.5 text-[10.5px] text-navy-400">
                {inv.workspace_id ? `workspace: ${inv.workspace_id}` : '(unattributed)'}
                {inv.user_email && ` · by ${inv.user_email}`}
              </p>
            </div>
            <span className="shrink-0 text-[10.5px] text-navy-400" title={inv.timestamp}>
              {relativeTime(inv.timestamp)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Shared bits ─────────────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-navy-500">
      {children}
    </div>
  );
}

function MetadataGrid({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-xl border border-navy-100 bg-white px-4 py-3 md:grid-cols-3">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-navy-400">
            {r.label}
          </div>
          <div className="mt-0.5 truncate text-[12.5px] text-navy-800" title={r.value}>
            {r.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  tone: 'navy' | 'success' | 'warn' | 'danger';
  icon: typeof Activity;
}) {
  const toneClasses = {
    navy: 'bg-navy-50 text-navy-700 ring-navy-200',
    success: 'bg-success-50 text-success-700 ring-success-500/25',
    warn: 'bg-warn-50 text-warn-700 ring-warn-500/25',
    danger: 'bg-danger-50 text-danger-700 ring-danger-500/25',
  }[tone];
  return (
    <div className="rounded-xl border border-navy-100 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10.5px] font-semibold uppercase tracking-wider text-navy-500">{label}</div>
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${toneClasses}`}
        >
          <Icon className="h-3 w-3" />
        </span>
      </div>
      <div className="mt-1 text-[18px] font-bold tabular-nums text-navy-900">{value}</div>
    </div>
  );
}

function MiniBarChart({ data }: { data: { date: string; calls: number; success_rate: number }[] }) {
  const max = useMemo(() => Math.max(...data.map((d) => d.calls), 1), [data]);
  return (
    <div className="rounded-xl border border-navy-100 bg-white p-3">
      <div className="flex h-32 items-end gap-1">
        {data.map((d) => {
          const h = Math.max(4, Math.round((d.calls / max) * 100));
          const err = d.success_rate < 95;
          return (
            <div key={d.date} className="group flex flex-1 flex-col items-center gap-1">
              <div className="relative flex-1 w-full">
                <div
                  className={`absolute bottom-0 left-0 right-0 rounded-t ${err ? 'bg-warn-500' : 'bg-accent-500'}`}
                  style={{ height: `${h}%` }}
                  title={`${d.date} · ${d.calls} calls · ${d.success_rate}%`}
                />
              </div>
              <div className="w-full truncate text-center text-[9px] text-navy-400">
                {d.date.slice(5)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LoadingBox({ label }: { label: string }) {
  return (
    <div className="flex h-40 items-center justify-center gap-2 text-navy-500">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="text-[13px]">{label}</span>
    </div>
  );
}

function EmptyBox({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-navy-200 bg-navy-50/40 px-6 py-12 text-center">
      <ExternalLink className="h-4 w-4 text-navy-400" />
      <p className="text-[12.5px] text-navy-500">{message}</p>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-danger-500/20 bg-danger-50 px-3 py-2 text-[12.5px] text-danger-700">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

/* ── Formatting helpers ──────────────────────────────────────── */

function formatMetric(key: string, v: number): string {
  const k = key.toLowerCase();
  if (['mape', 'mae', 'r2', 'auc', 'precision', 'recall', 'f1', 'silhouette', 'precision_at_k'].includes(k)) {
    return v.toFixed(3);
  }
  if (Math.abs(v) >= 1000) return v.toLocaleString();
  return v.toString();
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function relativeTime(iso: string): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}
