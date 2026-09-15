import { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
  Loader2,
  RefreshCw,
  Brain,
  AlertTriangle,
  MoreVertical,
  Trash2,
  Play,
  X,
  Sparkles,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Layers,
  Activity,
  MessageSquare,
  Cpu,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import ModelDetailDrawer from '../components/workspace/ModelDetailDrawer';
import {
  listModels,
  registerModel,
  deleteModel,
  testModel,
} from '../services/modelRegistry';
import {
  PROVIDER_LABELS,
  TAG_SUGGESTIONS,
  type RegisteredModel,
  type ModelProvider,
  type ModelStatus,
  type RegisterModelInput,
  type HttpMethod,
} from '../types/modelRegistry';

const STATUS_TONE: Record<ModelStatus, string> = {
  active: 'bg-success-50 text-success-700 ring-success-500/25',
  inactive: 'bg-navy-100 text-navy-600 ring-navy-200',
  drift: 'bg-warn-50 text-warn-700 ring-warn-500/25',
  error: 'bg-danger-50 text-danger-700 ring-danger-500/25',
  training: 'bg-accent-50 text-accent-700 ring-accent-200',
  deprecated: 'bg-navy-100 text-navy-500 ring-navy-200',
};

const STATUS_LABEL: Record<ModelStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  drift: 'Drift',
  error: 'Error',
  training: 'Training',
  deprecated: 'Deprecated',
};

/* Model type derived from tags — drives the row icon + Type column + facet. */
interface TypeMeta { label: string; icon: LucideIcon; bg: string; fg: string }
const TYPE_META: Record<string, TypeMeta> = {
  forecasting: { label: 'Forecasting', icon: TrendingUp, bg: 'bg-sky-50', fg: 'text-sky-600' },
  classification: { label: 'Classification', icon: Layers, bg: 'bg-violet-50', fg: 'text-violet-600' },
  regression: { label: 'Regression', icon: Activity, bg: 'bg-indigo-50', fg: 'text-indigo-600' },
  'anomaly-detection': { label: 'Anomaly detection', icon: AlertTriangle, bg: 'bg-rose-50', fg: 'text-rose-600' },
  clustering: { label: 'Clustering', icon: Layers, bg: 'bg-fuchsia-50', fg: 'text-fuchsia-600' },
  recommendation: { label: 'Recommendation', icon: Sparkles, bg: 'bg-teal-50', fg: 'text-teal-600' },
  nlp: { label: 'NLP', icon: MessageSquare, bg: 'bg-green-50', fg: 'text-green-600' },
  llm: { label: 'Gen-AI / LLM', icon: MessageSquare, bg: 'bg-emerald-50', fg: 'text-emerald-600' },
  agent: { label: 'Agent', icon: Cpu, bg: 'bg-purple-50', fg: 'text-purple-600' },
  statistical: { label: 'Statistical', icon: Activity, bg: 'bg-cyan-50', fg: 'text-cyan-600' },
  rules: { label: 'Rules', icon: ShieldCheck, bg: 'bg-slate-100', fg: 'text-slate-600' },
};
const DEFAULT_TYPE: TypeMeta = { label: 'Model', icon: Brain, bg: 'bg-navy-100', fg: 'text-navy-600' };

function typeMetaFor(model: RegisteredModel): TypeMeta {
  for (const t of model.tags) {
    if (TYPE_META[t]) return TYPE_META[t];
  }
  return DEFAULT_TYPE;
}

const PREFERRED_METRICS = ['mape', 'rmse', 'mae', 'auc', 'f1', 'accuracy', 'precision', 'recall', 'r2', 'silhouette'];
function primaryMetric(model: RegisteredModel): { key: string; value: string } | null {
  const entries = Object.entries(model.metrics || {});
  if (!entries.length) return null;
  for (const pk of PREFERRED_METRICS) {
    const hit = entries.find(([k]) => k.toLowerCase() === pk);
    if (hit) return { key: hit[0], value: typeof hit[1] === 'number' ? formatMetric(hit[0], hit[1]) : String(hit[1]) };
  }
  const [k, v] = entries[0];
  return { key: k, value: typeof v === 'number' ? formatMetric(k, v) : String(v) };
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const diff = Date.now() - then;
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  return `${mo}mo ago`;
}

/* ── Page ───────────────────────────────────────────────────────── */

export default function ModelRegistry() {
  const [models, setModels] = useState<RegisteredModel[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRegister, setShowRegister] = useState(false);
  const [search, setSearch] = useState('');
  const [openModel, setOpenModel] = useState<RegisteredModel | null>(null);
  const [selTypes, setSelTypes] = useState<Set<string>>(new Set());
  const [selStatuses, setSelStatuses] = useState<Set<ModelStatus>>(new Set());
  const [selProviders, setSelProviders] = useState<Set<ModelProvider>>(new Set());

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listModels();
      setModels(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load models');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const all = models || [];

  const typeFacets = useMemo(() => {
    const c = new Map<string, number>();
    all.forEach((m) => {
      const t = typeMetaFor(m).label;
      c.set(t, (c.get(t) || 0) + 1);
    });
    return Array.from(c.entries()).sort((a, b) => b[1] - a[1]);
  }, [all]);
  const statusFacets = useMemo(() => {
    const c = new Map<ModelStatus, number>();
    all.forEach((m) => c.set(m.status, (c.get(m.status) || 0) + 1));
    return Array.from(c.entries()).sort((a, b) => b[1] - a[1]);
  }, [all]);
  const providerFacets = useMemo(() => {
    const c = new Map<ModelProvider, number>();
    all.forEach((m) => c.set(m.provider, (c.get(m.provider) || 0) + 1));
    return Array.from(c.entries()).sort((a, b) => b[1] - a[1]);
  }, [all]);

  const filtered = useMemo(() => {
    return all.filter((m) => {
      if (selTypes.size && !selTypes.has(typeMetaFor(m).label)) return false;
      if (selStatuses.size && !selStatuses.has(m.status)) return false;
      if (selProviders.size && !selProviders.has(m.provider)) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          m.name.toLowerCase().includes(s) ||
          m.display_name.toLowerCase().includes(s) ||
          m.description.toLowerCase().includes(s) ||
          m.algorithm.toLowerCase().includes(s) ||
          m.framework.toLowerCase().includes(s) ||
          m.tags.some((t) => t.toLowerCase().includes(s))
        );
      }
      return true;
    });
  }, [all, search, selTypes, selStatuses, selProviders]);

  const activeCount = all.filter((m) => m.status === 'active').length;
  const alertCount = all.filter((m) => m.status === 'drift' || m.status === 'error').length;
  const providerCount = new Set(all.map((m) => m.provider)).size;

  const handleRegister = async (input: RegisterModelInput) => {
    await registerModel(input);
    setShowRegister(false);
    await load();
  };
  const handleDelete = async (m: RegisteredModel) => {
    if (!confirm(`Delete "${m.display_name}"? Pipelines that reference it will break until re-bound.`)) return;
    try {
      await deleteModel(m.id);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed');
    }
  };
  const handleTest = async (m: RegisteredModel) => {
    try {
      const r = await testModel(m.id);
      alert(`${r.ok ? 'OK' : 'Failed'} — ${r.note}\n\nEndpoint: ${r.endpoint}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Test failed');
    }
  };

  function toggle<T>(set: Set<T>, val: T, setter: (s: Set<T>) => void) {
    const next = new Set(set);
    if (next.has(val)) next.delete(val);
    else next.add(val);
    setter(next);
  }
  const anyFacet = selTypes.size || selStatuses.size || selProviders.size;
  const clearFacets = () => {
    setSelTypes(new Set());
    setSelStatuses(new Set());
    setSelProviders(new Set());
  };

  return (
    <AppLayout
      title="Model Registry"
      subtitle="Every model a pipeline or agent can call — analytical, ML, statistical, or gen-AI."
      fluid
      actions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-navy-200 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-navy-700 hover:bg-navy-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowRegister(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent-500 px-3.5 py-1.5 text-[12.5px] font-semibold text-white shadow-sm hover:bg-accent-600"
          >
            <Plus className="h-3.5 w-3.5" />
            Register model
          </button>
        </div>
      }
    >
      <div className="custom-scrollbar flex h-full flex-col overflow-y-auto bg-navy-50/40">
        <div className="flex-1 px-6 py-5">
          <div className="mx-auto max-w-7xl space-y-5">
            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-danger-500/20 bg-danger-50 px-4 py-3 text-[13px] text-danger-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Tile value={String(all.length)} label="Registered models" />
              <Tile value={String(activeCount)} label="Active" tone="success" />
              <Tile value={String(providerCount)} label="Providers" />
              <Tile value={String(alertCount)} label="Needs attention" tone={alertCount ? 'warn' : undefined} />
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[184px_minmax(0,1fr)]">
              <aside className="space-y-5">
                <FacetGroup
                  title="Type"
                  options={typeFacets.map(([v, n]) => ({ value: v, label: v, count: n }))}
                  selected={selTypes}
                  onToggle={(v) => toggle(selTypes, v, setSelTypes)}
                />
                <FacetGroup
                  title="Status"
                  options={statusFacets.map(([v, n]) => ({ value: v, label: STATUS_LABEL[v], count: n }))}
                  selected={selStatuses}
                  onToggle={(v) => toggle(selStatuses, v as ModelStatus, setSelStatuses)}
                />
                <FacetGroup
                  title="Provider"
                  options={providerFacets.map(([v, n]) => ({ value: v, label: PROVIDER_LABELS[v], count: n }))}
                  selected={selProviders}
                  onToggle={(v) => toggle(selProviders, v as ModelProvider, setSelProviders)}
                />
                {anyFacet ? (
                  <button onClick={clearFacets} className="text-[11.5px] font-medium text-accent-600 hover:underline">
                    Clear filters
                  </button>
                ) : null}
              </aside>

              <div className="min-w-0">
                <div className="mb-3 flex items-center gap-2 rounded-lg border border-navy-200 bg-white px-3 py-2">
                  <Search className="h-4 w-4 text-navy-400" />
                  <input
                    type="text"
                    placeholder="Search models by name, tag, algorithm…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="flex-1 border-none bg-transparent text-[13px] text-navy-800 outline-none placeholder:text-navy-400"
                  />
                  {search && (
                    <button onClick={() => setSearch('')} className="text-navy-400 hover:text-navy-700">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {loading && !models ? (
                  <div className="flex h-56 items-center justify-center rounded-xl border border-navy-100 bg-white text-navy-500">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    <span className="text-[13px]">Loading models…</span>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-navy-200 bg-white px-6 py-16 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-navy-100 text-navy-500">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[14px] font-semibold text-navy-800">
                        {all.length ? 'No matches' : 'No models registered yet'}
                      </p>
                      <p className="mt-1 text-[12.5px] text-navy-500">
                        {all.length
                          ? 'Clear filters or search a different term.'
                          : 'Register any inference endpoint — a trained model, an LLM, a rule set.'}
                      </p>
                    </div>
                    {!all.length && (
                      <button
                        type="button"
                        onClick={() => setShowRegister(true)}
                        className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-accent-500 px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-accent-600"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Register model
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filtered.map((m) => (
                      <RowCard
                        key={m.id}
                        model={m}
                        onOpen={() => setOpenModel(m)}
                        onTest={() => handleTest(m)}
                        onDelete={() => handleDelete(m)}
                      />
                    ))}
                  </div>
                )}
                {filtered.length > 0 && (
                  <p className="mt-2 text-[11px] text-navy-400">
                    Showing {filtered.length} of {all.length} · click a row to open the model card
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {showRegister && (
          <RegisterModelDialog onClose={() => setShowRegister(false)} onSubmit={handleRegister} />
        )}
        {openModel && (
          <ModelDetailDrawer
            model={openModel}
            onClose={() => setOpenModel(null)}
            onDeleted={() => {
              setOpenModel(null);
              void load();
            }}
          />
        )}
      </div>
    </AppLayout>
  );
}

/* ── Tiles · facets · table row ─────────────────────────────────── */

function Tile({ value, label, tone }: { value: string; label: string; tone?: 'success' | 'warn' }) {
  const color = tone === 'success' ? 'text-success-600' : tone === 'warn' ? 'text-warn-600' : 'text-navy-900';
  return (
    <div className="rounded-xl border border-navy-100 bg-white p-4">
      <div className={`text-[22px] font-bold leading-none ${color}`}>{value}</div>
      <div className="mt-1.5 text-[11px] text-navy-400">{label}</div>
    </div>
  );
}

interface FacetOption {
  value: string;
  label: string;
  count: number;
}
function FacetGroup({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: FacetOption[];
  selected: Set<string>;
  onToggle: (v: string) => void;
}) {
  if (!options.length) return null;
  return (
    <div>
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-navy-400">{title}</div>
      <div className="space-y-1">
        {options.map((o) => (
          <label
            key={o.value}
            className="flex cursor-pointer items-center gap-2 text-[12px] text-navy-600 hover:text-navy-900"
          >
            <input
              type="checkbox"
              checked={selected.has(o.value)}
              onChange={() => onToggle(o.value)}
              className="h-3.5 w-3.5 rounded border-navy-300 accent-accent-500"
            />
            <span className="truncate">{o.label}</span>
            <span className="ml-auto tabular-nums text-navy-400">{o.count}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md border border-navy-100 bg-navy-50/60 px-1.5 py-0.5 text-[9.5px] text-navy-600">
      {children}
    </span>
  );
}

function RowCard({
  model,
  onOpen,
  onTest,
  onDelete,
}: {
  model: RegisteredModel;
  onOpen: () => void;
  onTest: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const tm = typeMetaFor(model);
  const Icon = tm.icon;
  const metric = primaryMetric(model);
  // Bar only for 0–1 "higher-is-better" scores; otherwise show the number alone.
  const scoreKeys = ['auc', 'f1', 'accuracy', 'precision', 'recall', 'r2', 'silhouette'];
  const isScore = metric ? scoreKeys.includes(metric.key.toLowerCase()) : false;
  const scoreVal = isScore ? Math.max(0, Math.min(1, Number(metric!.value) || 0)) : 0;
  const isAlert = model.status === 'drift' || model.status === 'error';

  return (
    <div
      onClick={onOpen}
      className={`group relative flex cursor-pointer items-center gap-3.5 rounded-xl border bg-white px-4 py-3 transition-all hover:shadow-md ${
        isAlert ? 'border-warn-500/40' : 'border-navy-100 hover:border-navy-200'
      }`}
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] ${tm.bg} ${tm.fg}`}>
        <Icon style={{ width: 20, height: 20 }} />
      </div>

      <div className="w-56 shrink-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-[14px] font-semibold text-navy-900">{model.display_name}</span>
          <span
            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ring-1 ring-inset ${STATUS_TONE[model.status]}`}
          >
            {STATUS_LABEL[model.status]}
          </span>
        </div>
        <div className="mt-0.5 truncate font-mono text-[10.5px] text-navy-400">
          {model.name} · v{model.version}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {model.framework && <Chip>{model.framework}</Chip>}
          <Chip>{tm.label}</Chip>
        </div>
      </div>

      <div className="min-w-0 flex-1">
        {metric ? (
          <>
            <div className="text-[9.5px] uppercase tracking-[0.08em] text-navy-400">{metric.key}</div>
            <div className="mt-1 flex items-center gap-2.5">
              {isScore && (
                <div className="h-[5px] max-w-[120px] flex-1 overflow-hidden rounded-full bg-navy-100">
                  <div className="h-full rounded-full bg-success-500" style={{ width: `${Math.round(scoreVal * 100)}%` }} />
                </div>
              )}
              <span className="text-[13px] font-semibold tabular-nums text-navy-900">{metric.value}</span>
            </div>
          </>
        ) : (
          <span className="text-[12px] text-navy-400">No metric reported</span>
        )}
      </div>

      <div className="hidden shrink-0 text-right sm:block">
        <div className="text-[11.5px] text-navy-600">{PROVIDER_LABELS[model.provider]}</div>
        <div className="text-[10.5px] text-navy-400">updated {relativeTime(model.updated_at)}</div>
      </div>

      <div className="relative shrink-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((v) => !v);
          }}
          className="flex h-7 w-7 items-center justify-center rounded-md text-navy-400 opacity-0 hover:bg-navy-100 hover:text-navy-700 group-hover:opacity-100"
          aria-label="Actions"
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </button>
        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
              }}
            />
            <div
              className="absolute right-0 top-8 z-20 w-40 rounded-lg border border-navy-100 bg-white p-1 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onTest();
                }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12px] text-navy-700 hover:bg-navy-50"
              >
                <Play className="h-3 w-3" /> Test endpoint
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onDelete();
                }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12px] text-danger-600 hover:bg-danger-50"
              >
                <Trash2 className="h-3 w-3" /> Delete
              </button>
            </div>
          </>
        )}
      </div>

      <ChevronRight className="h-4 w-4 shrink-0 text-navy-300" />
    </div>
  );
}

function formatMetric(key: string, v: number): string {
  const k = key.toLowerCase();
  if (['mape', 'mae', 'r2', 'auc', 'precision', 'recall', 'f1', 'silhouette', 'precision_at_k'].includes(k)) {
    return v.toFixed(3);
  }
  if (Math.abs(v) >= 1000) return v.toLocaleString();
  return v.toString();
}

/* ── Register dialog ────────────────────────────────────────────── */

function RegisterModelDialog({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (input: RegisterModelInput) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [algorithm, setAlgorithm] = useState('');
  const [framework, setFramework] = useState('');
  const [provider, setProvider] = useState<ModelProvider>('mlflow');
  const [endpointUrl, setEndpointUrl] = useState('');
  const [version, setVersion] = useState('1.0.0');
  const [trainingDataRef, setTrainingDataRef] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [metricsText, setMetricsText] = useState('');

  // ── Advanced: how to invoke ───────────────────────────────────
  const [advOpen, setAdvOpen] = useState(false);
  const [httpMethod, setHttpMethod] = useState<HttpMethod>('POST');
  const [headersText, setHeadersText] = useState(''); // "Key: Value" per line
  const [samplePayloadText, setSamplePayloadText] = useState('');
  const [sampleResponseText, setSampleResponseText] = useState('');
  const [payloadErr, setPayloadErr] = useState<string | null>(null);
  const [responseErr, setResponseErr] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canSubmit = name.trim() && displayName.trim() && endpointUrl.trim() && !submitting;

  const addTag = (raw: string) => {
    const t = raw.trim().toLowerCase().replace(/[^\w-]/g, '-');
    if (!t) return;
    if (tags.includes(t)) return;
    setTags((prev) => [...prev, t]);
    setTagInput('');
  };

  const removeTag = (t: string) => setTags((prev) => prev.filter((x) => x !== t));

  const submit = async () => {
    if (!canSubmit) return;

    // Metrics — key=value pairs
    const metrics: Record<string, number | string> = {};
    metricsText.split(/[,;\n]/).forEach((pair) => {
      const [k, v] = pair.split('=').map((s) => s.trim());
      if (!k || v === undefined) return;
      const num = Number(v);
      metrics[k] = Number.isFinite(num) ? num : v;
    });

    // Custom headers — one "Key: Value" per line
    const custom_headers: Record<string, string> = {};
    headersText.split(/\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      const idx = trimmed.indexOf(':');
      if (idx < 0) return;
      const k = trimmed.slice(0, idx).trim();
      const v = trimmed.slice(idx + 1).trim();
      if (k) custom_headers[k] = v;
    });

    // Parse sample payload / response — both optional but must be valid JSON if provided
    let sample_payload: Record<string, unknown> = {};
    if (samplePayloadText.trim()) {
      try {
        const parsed = JSON.parse(samplePayloadText);
        sample_payload = typeof parsed === 'object' && parsed !== null ? parsed : { value: parsed };
        setPayloadErr(null);
      } catch {
        setPayloadErr('Sample payload isn’t valid JSON');
        return;
      }
    }
    let sample_response: Record<string, unknown> = {};
    if (sampleResponseText.trim()) {
      try {
        const parsed = JSON.parse(sampleResponseText);
        sample_response = typeof parsed === 'object' && parsed !== null ? parsed : { value: parsed };
        setResponseErr(null);
      } catch {
        setResponseErr('Sample response isn’t valid JSON');
        return;
      }
    }

    setSubmitting(true);
    setErr(null);
    try {
      await onSubmit({
        name: name.trim().toLowerCase().replace(/\s+/g, '-'),
        display_name: displayName.trim(),
        description: description.trim(),
        algorithm: algorithm.trim(),
        framework: framework.trim(),
        provider,
        endpoint_url: endpointUrl.trim(),
        http_method: httpMethod,
        custom_headers,
        version: version.trim() || '1.0.0',
        training_data_ref: trainingDataRef.trim(),
        metrics,
        tags,
        sample_payload,
        sample_response,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Register failed');
    } finally {
      setSubmitting(false);
    }
  };

  const suggestedTags = TAG_SUGGESTIONS.filter((t) => !tags.includes(t)).slice(0, 10);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/40 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-navy-100 bg-white shadow-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-navy-100 px-5 py-3">
          <div>
            <h2 className="text-[15px] font-bold tracking-tight text-navy-900">Register model</h2>
            <p className="text-[11.5px] text-navy-500">
              Point at any inference endpoint. Add tags so pipelines can find it.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-navy-400 hover:bg-navy-50 hover:text-navy-700"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="max-h-[72vh] space-y-3 overflow-y-auto px-5 py-4">
          {err && (
            <div className="rounded-lg border border-danger-500/20 bg-danger-50 px-3 py-2 text-[12.5px] text-danger-700">
              {err}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Slug (unique)">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="demand-forecast-prophet"
                className="w-full rounded-lg border border-navy-200 bg-white px-3 py-2 font-mono text-[12px] text-navy-900 focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-100"
              />
            </Field>
            <Field label="Display name">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Demand forecast (Prophet)"
                className="w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-[13px] text-navy-900 focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-100"
              />
            </Field>
          </div>

          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="What does this model do? What data does it use?"
              className="w-full resize-none rounded-lg border border-navy-200 bg-white px-3 py-2 text-[13px] text-navy-900 focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-100"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Algorithm">
              <input
                type="text"
                value={algorithm}
                onChange={(e) => setAlgorithm(e.target.value)}
                placeholder="Prophet · XGBoost · anything"
                className="w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-[13px] text-navy-900 focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-100"
              />
            </Field>
            <Field label="Framework">
              <input
                type="text"
                value={framework}
                onChange={(e) => setFramework(e.target.value)}
                placeholder="scikit-learn · statsforecast · pytorch"
                className="w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-[13px] text-navy-900 focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-100"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Hosted on">
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as ModelProvider)}
                className="w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-[13px] text-navy-900 focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-100"
              >
                {(Object.keys(PROVIDER_LABELS) as ModelProvider[]).map((p) => (
                  <option key={p} value={p}>
                    {PROVIDER_LABELS[p]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Version">
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="1.0.0"
                className="w-full rounded-lg border border-navy-200 bg-white px-3 py-2 font-mono text-[12px] text-navy-900 focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-100"
              />
            </Field>
          </div>

          <Field label="Endpoint URL">
            <input
              type="text"
              value={endpointUrl}
              onChange={(e) => setEndpointUrl(e.target.value)}
              placeholder="https://<host>/predict"
              className="w-full rounded-lg border border-navy-200 bg-white px-3 py-2 font-mono text-[12px] text-navy-900 focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-100"
            />
          </Field>

          {/* Advanced: how to invoke — collapsed by default */}
          <div className="rounded-lg border border-navy-200 bg-navy-50/50">
            <button
              type="button"
              onClick={() => setAdvOpen((v) => !v)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left"
            >
              {advOpen ? (
                <ChevronDown className="h-3.5 w-3.5 text-navy-500" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-navy-500" />
              )}
              <span className="text-[12.5px] font-semibold text-navy-800">
                How to invoke this endpoint
              </span>
              <span className="text-[11px] text-navy-500">
                {advOpen ? '' : '— method, headers, sample payload + response (optional but recommended)'}
              </span>
            </button>
            {advOpen && (
              <div className="space-y-3 border-t border-navy-200 px-3 py-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="HTTP method">
                    <select
                      value={httpMethod}
                      onChange={(e) => setHttpMethod(e.target.value as HttpMethod)}
                      className="w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-[13px] text-navy-900 focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-100"
                    >
                      {(['POST', 'GET', 'PUT', 'PATCH', 'DELETE'] as HttpMethod[]).map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Custom headers (one per line, Key: Value)">
                    <textarea
                      value={headersText}
                      onChange={(e) => setHeadersText(e.target.value)}
                      rows={2}
                      spellCheck={false}
                      placeholder={'x-api-version: 2024-08-01\nx-deployment: prod'}
                      className="w-full resize-none rounded-lg border border-navy-200 bg-white px-3 py-2 font-mono text-[11.5px] text-navy-900 focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-100"
                    />
                  </Field>
                </div>

                <Field label="Sample request payload (JSON) — used by the Test tab + pipelines">
                  <textarea
                    value={samplePayloadText}
                    onChange={(e) => {
                      setSamplePayloadText(e.target.value);
                      setPayloadErr(null);
                    }}
                    rows={4}
                    spellCheck={false}
                    placeholder={'{\n  "sku_id": "SKU-001",\n  "features": {\n    "velocity": 12.4,\n    "cv": 0.32\n  }\n}'}
                    className="w-full resize-none rounded-lg border border-navy-200 bg-white px-3 py-2 font-mono text-[11.5px] text-navy-900 focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-100"
                  />
                  {payloadErr && (
                    <p className="mt-1 text-[11px] text-danger-600">{payloadErr}</p>
                  )}
                </Field>

                <Field label="Sample response (JSON) — reference for pipeline authors">
                  <textarea
                    value={sampleResponseText}
                    onChange={(e) => {
                      setSampleResponseText(e.target.value);
                      setResponseErr(null);
                    }}
                    rows={4}
                    spellCheck={false}
                    placeholder={'{\n  "predictions": [{\n    "date": "2026-08-04",\n    "forecast": 145.2,\n    "lower_ci": 128.4,\n    "upper_ci": 162.1\n  }]\n}'}
                    className="w-full resize-none rounded-lg border border-navy-200 bg-white px-3 py-2 font-mono text-[11.5px] text-navy-900 focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-100"
                  />
                  {responseErr && (
                    <p className="mt-1 text-[11px] text-danger-600">{responseErr}</p>
                  )}
                </Field>

                <p className="text-[10.5px] italic text-navy-500">
                  You can also leave these blank and fill them in later from the Test tab — successful test invocations get a “Save as sample” button.
                </p>
              </div>
            )}
          </div>

          <Field label="Tags — anything you'd want to search on">
            <div className="rounded-lg border border-navy-200 bg-white px-2 py-1.5">
              <div className="flex flex-wrap items-center gap-1">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 rounded-md bg-accent-50 px-1.5 py-0.5 text-[11.5px] text-accent-800"
                  >
                    #{t}
                    <button
                      type="button"
                      onClick={() => removeTag(t)}
                      className="text-accent-600 hover:text-accent-800"
                      aria-label={`Remove ${t}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
                      e.preventDefault();
                      addTag(tagInput);
                    } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
                      setTags((prev) => prev.slice(0, -1));
                    }
                  }}
                  placeholder={tags.length ? 'Add another…' : 'Type + Enter'}
                  className="min-w-[100px] flex-1 border-none bg-transparent px-1 py-0.5 text-[12.5px] text-navy-900 outline-none placeholder:text-navy-400"
                />
              </div>
            </div>
            {suggestedTags.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                <span className="text-[10.5px] text-navy-400">Suggestions:</span>
                {suggestedTags.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => addTag(t)}
                    className="rounded-md border border-dashed border-navy-200 px-1.5 py-0 text-[10.5px] text-navy-500 hover:border-accent-300 hover:text-accent-700"
                  >
                    +{t}
                  </button>
                ))}
              </div>
            )}
          </Field>

          <Field label="Training data (optional)">
            <input
              type="text"
              value={trainingDataRef}
              onChange={(e) => setTrainingDataRef(e.target.value)}
              placeholder="gold.sku_features_v3 · s3://.../train.parquet"
              className="w-full rounded-lg border border-navy-200 bg-white px-3 py-2 font-mono text-[12px] text-navy-900 focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-100"
            />
          </Field>

          <Field label="Metrics (optional) — comma-separated key=value">
            <input
              type="text"
              value={metricsText}
              onChange={(e) => setMetricsText(e.target.value)}
              placeholder="mape=0.18, rmse=122.4, mae=87.1"
              className="w-full rounded-lg border border-navy-200 bg-white px-3 py-2 font-mono text-[12px] text-navy-900 focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-100"
            />
          </Field>

          <p className="text-[11px] italic text-navy-400">
            Credentials aren't stored here — set them via your platform secret store and reference by path.
          </p>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-navy-100 bg-navy-50/40 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-navy-200 bg-white px-4 py-1.5 text-[12.5px] font-semibold text-navy-700 hover:bg-navy-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent-500 px-4 py-1.5 text-[12.5px] font-semibold text-white shadow-sm hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Registering…
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" />
                Register
              </>
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wider text-navy-500">
        {label}
      </label>
      {children}
    </div>
  );
}
