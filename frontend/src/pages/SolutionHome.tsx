import { useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Boxes,
  Check,
  Loader2,
  Play,
  Rocket,
  ArrowRight,
  Lock,
  Building2,
  Layers,
  Cpu,
  ShieldCheck,
  Copy,
  GitBranch,
  BadgeCheck,
  type LucideIcon,
} from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import { useAcceleratorStore } from '../store/acceleratorStore';
import { INDUSTRY_LABELS, BACKEND_LABELS, type Accelerator } from '../types/accelerator';

/* ── Models each accelerator uses ── */

interface ModelCard {
  name: string;
  kind: string;
  purpose: string;
}

const MODELS_BY_SLUG: Record<string, ModelCard[]> = {
  'inventory-optimization': [
    { name: 'demand-forecast', kind: 'Forecasting', purpose: 'Projects 14-day demand for every SKU and warehouse.' },
    { name: 'abc-fsn-xyz-classifier', kind: 'Classification', purpose: 'Segments SKUs by value, movement, and variability.' },
    { name: 'safety-stock-optimizer', kind: 'Optimization', purpose: 'Sizes buffer stock to meet the target service level.' },
    { name: 'stockout-risk-detector', kind: 'Anomaly detection', purpose: 'Surfaces items projected to breach their reorder point.' },
    { name: 'replenishment-recommender', kind: 'Recommendation', purpose: 'Advises order quantities and timing per location.' },
  ],
  'procurement-analytics': [
    { name: 'spend-anomaly-detector', kind: 'Anomaly detection', purpose: 'Identifies leakage and off-contract expenditure.' },
    { name: 'supplier-scorecard', kind: 'Classification', purpose: 'Rates vendors on price, reliability, and compliance.' },
    { name: 'po-cycle-time-model', kind: 'Forecasting', purpose: 'Estimates purchase-order cycle time and delays.' },
  ],
  'credit-risk': [
    { name: 'probability-of-default', kind: 'Classification', purpose: 'Scores default likelihood per obligor.' },
    { name: 'lgd-ead-estimator', kind: 'Regression', purpose: 'Quantifies loss given default and exposure at default.' },
    { name: 'ifrs9-staging-engine', kind: 'Rules', purpose: 'Assigns accounts to expected-credit-loss stages 1–3.' },
  ],
  'hr-attrition': [
    { name: 'attrition-risk-model', kind: 'Classification', purpose: 'Scores flight risk at the individual employee level.' },
    { name: 'engagement-driver-analysis', kind: 'Regression', purpose: 'Quantifies which factors move engagement most.' },
    { name: 'skills-gap-detector', kind: 'Clustering', purpose: 'Maps capability gaps against role requirements.' },
    { name: 'compensation-benchmark', kind: 'Statistical', purpose: 'Benchmarks pay against internal and market references.' },
  ],
  'supply-chain-tower': [
    { name: 'otif-predictor', kind: 'Forecasting', purpose: 'Forecasts on-time-in-full delivery performance.' },
    { name: 'transit-anomaly-detector', kind: 'Anomaly detection', purpose: 'Flags shipments deviating from expected transit.' },
    { name: 'disruption-early-warning', kind: 'Classification', purpose: 'Predicts supply disruptions before they land.' },
  ],
  'working-capital': [
    { name: 'dpo-dso-forecaster', kind: 'Forecasting', purpose: 'Projects payable and receivable cycle days.' },
    { name: 'discount-capture-optimizer', kind: 'Optimization', purpose: 'Prioritizes early-payment discount opportunities.' },
  ],
  'customer-360': [
    { name: 'identity-resolution', kind: 'Clustering', purpose: 'Stitches records into unified customer profiles.' },
    { name: 'rfm-segmentation', kind: 'Classification', purpose: 'Segments customers by recency, frequency, monetary value.' },
    { name: 'churn-propensity', kind: 'Classification', purpose: 'Scores likelihood of customer churn.' },
    { name: 'next-best-action', kind: 'Recommendation', purpose: 'Recommends the highest-impact next engagement.' },
  ],
  'clinical-ops': [
    { name: 'enrolment-forecaster', kind: 'Forecasting', purpose: 'Projects trial-site enrolment trajectories.' },
    { name: 'protocol-deviation-detector', kind: 'Anomaly detection', purpose: 'Identifies deviations from study protocol.' },
    { name: 'site-performance-model', kind: 'Classification', purpose: 'Benchmarks and ranks investigator sites.' },
  ],
};

function modelsFor(a: Accelerator): ModelCard[] {
  if (MODELS_BY_SLUG[a.slug]) return MODELS_BY_SLUG[a.slug];
  const kinds = ['Forecasting', 'Classification', 'Anomaly detection', 'Recommendation', 'Regression'];
  const n = Math.max(1, a.contents?.models || 3);
  return Array.from({ length: n }, (_, i) => ({
    name: `${a.slug}-model-${i + 1}`,
    kind: kinds[i % kinds.length],
    purpose: 'Registered model bound to this solution’s pipeline.',
  }));
}

/* ── Deploy lifecycle (mirrors backend build_status gate) ── */

type DeployState = 'not_installed' | 'installed_no_run' | 'ran';
interface JobRun { id: number; state: 'success' | 'failed'; rows: number; when: string; durationS: number }

function seedRuns(): JobRun[] {
  return [
    { id: 3, state: 'success', rows: 15_684_339, when: '2h ago', durationS: 42 },
    { id: 2, state: 'success', rows: 15_540_112, when: 'yesterday', durationS: 45 },
    { id: 1, state: 'success', rows: 15_402_880, when: '2 days ago', durationS: 44 },
  ];
}

const TABS = ['Solution card', 'Models', 'Pipeline', 'Activity'] as const;

export default function SolutionHome() {
  const { workspaceId: slug } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const accelerator = useAcceleratorStore((s) => s.accelerators.find((a) => a.slug === slug));

  const [deploy, setDeploy] = useState<DeployState>(accelerator?.installed ? 'ran' : 'not_installed');
  const [runs, setRuns] = useState<JobRun[]>(accelerator?.installed ? seedRuns() : []);
  const [busy, setBusy] = useState<null | 'install' | 'run' | 'push'>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>('Solution card');
  const [copied, setCopied] = useState(false);

  const sections = {
    overview: useRef<HTMLDivElement>(null),
    models: useRef<HTMLDivElement>(null),
    pipeline: useRef<HTMLDivElement>(null),
    activity: useRef<HTMLDivElement>(null),
  };
  const models = useMemo(() => (accelerator ? modelsFor(accelerator) : []), [accelerator]);

  if (!accelerator) {
    return (
      <AppLayout title="Solution">
        <div className="mx-auto max-w-xl rounded-2xl border border-navy-100 bg-white p-8 text-center">
          <p className="text-[14px] font-semibold text-navy-800">Solution not found</p>
          <button onClick={() => navigate('/accelerators')} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-accent-500 px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-accent-600">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to catalog
          </button>
        </div>
      </AppLayout>
    );
  }

  const a = accelerator;
  const successRuns = runs.filter((r) => r.state === 'success').length;
  const hasSuccessfulRun = successRuns > 0;
  const repo = a.repo || `infosys-cobalt/${a.slug}`;
  const uc = `datalens_${a.slug.replace(/-/g, '_')}`;

  const doInstall = async () => { setBusy('install'); await sleep(1100); setBusy(null); setDeploy('installed_no_run'); };
  const doRun = async () => {
    setBusy('run'); await sleep(1500);
    setRuns((r) => [{ id: r.length + 1, state: 'success', rows: 15_684_339, when: 'just now', durationS: 42 }, ...r]);
    setBusy(null); setDeploy('ran');
  };
  const doPush = async () => { if (!hasSuccessfulRun) return; setBusy('push'); await sleep(1000); setBusy(null); navigate(`/solution/${a.slug}/agent`); };

  const goTab = (t: (typeof TABS)[number]) => {
    setTab(t);
    const map = { 'Solution card': 'overview', Models: 'models', Pipeline: 'pipeline', Activity: 'activity' } as const;
    sections[map[t]].current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const copyRepo = () => { navigator.clipboard?.writeText(repo); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  const codeSnippet = `-- Query the served gold table.
-- Row-level entitlement is applied automatically per user.
SELECT sku_id, warehouse_id, on_hand_qty, days_to_zero
FROM ${uc}.gold_stock_status
WHERE days_to_zero <= 14
ORDER BY days_to_zero ASC;`;

  return (
    <AppLayout title="Solution" fluid>
      <div className="custom-scrollbar h-full overflow-y-auto bg-white">
        {/* ── Identity header ── */}
        <div className="border-b border-navy-100 px-6 pt-5">
          <div className="mx-auto max-w-5xl">
            <button onClick={() => navigate('/accelerators')} className="mb-3 inline-flex items-center gap-1 text-[11.5px] text-navy-400 hover:text-navy-700">
              <ArrowLeft className="h-3 w-3" /> Accelerators
            </button>

            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-500/20">
                <Boxes className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[13px] text-navy-400">{a.coe}</span>
                  <span className="text-navy-300">/</span>
                  <h1 className="text-[19px] font-bold tracking-tight text-navy-900">{a.name}</h1>
                  <button onClick={copyRepo} className="ml-1 inline-flex items-center gap-1 rounded-md border border-navy-200 px-1.5 py-0.5 text-[10.5px] text-navy-500 hover:bg-navy-50" title="Copy repo">
                    {copied ? <Check className="h-3 w-3 text-success-600" /> : <Copy className="h-3 w-3" />}
                    <span className="font-mono">{repo}</span>
                  </button>
                </div>

                {/* Tag row (HF-style) */}
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <Tag icon={Building2} label={INDUSTRY_LABELS[a.industry]} />
                  <Tag icon={Layers} label={a.functional_area} />
                  {a.backends.map((b) => (
                    <Tag key={b} icon={Cpu} label={BACKEND_LABELS[b].split(' ')[0]} />
                  ))}
                  <Tag icon={Cpu} label={`${a.contents.models} models`} />
                  <Tag icon={ShieldCheck} label="Row-level access" />
                  <Tag label={`v${a.version}`} mono />
                  {a.status === 'ga' ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-[10.5px] font-medium text-success-700 ring-1 ring-inset ring-success-500/20">
                      <BadgeCheck className="h-3 w-3" /> Production
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-warn-50 px-2 py-0.5 text-[10.5px] font-medium capitalize text-warn-700 ring-1 ring-inset ring-warn-500/20">
                      {a.status}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Tab strip */}
            <div className="mt-4 flex gap-5 text-[12.5px]">
              {TABS.map((t) => (
                <button
                  key={t}
                  onClick={() => goTab(t)}
                  className={`-mb-px border-b-2 pb-2.5 font-medium transition-colors ${
                    tab === t ? 'border-amber-500 text-navy-900' : 'border-transparent text-navy-400 hover:text-navy-700'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 px-6 py-7 lg:grid-cols-[minmax(0,1fr)_308px]">
          {/* README */}
          <article className="min-w-0 space-y-8">
            <section ref={sections.overview}>
              <H2>Solution description</H2>
              <p className="text-[14px] leading-[1.75] text-navy-700">{a.description || a.tagline}</p>
              <p className="mt-3 text-[14px] leading-[1.75] text-navy-700">
                Packaged by the {a.coe} as a versioned Databricks Asset Bundle. It ingests raw source data into a
                Bronze → Silver → Gold medallion, applies {a.contents.models} analytical models, and serves curated
                Gold tables to {a.contents.dashboards} role-based dashboards and a domain-aware agent — all governed
                by row-level entitlement.
              </p>
            </section>

            <section ref={sections.models}>
              <H2>Analytical models</H2>
              <div className="overflow-hidden rounded-xl border border-navy-100">
                {models.map((m, i) => (
                  <div key={m.name} className={`flex items-start justify-between gap-4 px-4 py-3 ${i > 0 ? 'border-t border-navy-100' : ''}`}>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[12.5px] font-medium text-navy-900">{m.name}</span>
                        <span className="rounded-full bg-navy-100 px-1.5 py-0.5 text-[10px] font-medium text-navy-600">{m.kind}</span>
                      </div>
                      <p className="mt-1 text-[12.5px] leading-relaxed text-navy-500">{m.purpose}</p>
                    </div>
                    <button onClick={() => navigate('/model-registry')} className="mt-0.5 shrink-0 text-[11px] font-medium text-accent-600 hover:underline">
                      Registry ↗
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section ref={sections.pipeline}>
              <H2>How it works</H2>
              <ol className="space-y-2.5">
                {[
                  ['Ingest', 'Raw source tables land in the Bronze layer via CDC — immutable, as-is.'],
                  ['Transform', 'Silver cleans, conforms, and enforces the canonical entity contract.'],
                  ['Model', `The ${a.contents.models} registered models score and enrich the conformed data.`],
                  ['Serve', 'Curated Gold tables power dashboards, the agent, and ad-hoc queries.'],
                ].map(([step, desc], i) => (
                  <li key={step} className="flex gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-navy-900 text-[10px] font-bold text-white">{i + 1}</span>
                    <p className="text-[13.5px] leading-relaxed text-navy-700"><span className="font-semibold text-navy-900">{step}.</span> {desc}</p>
                  </li>
                ))}
              </ol>

              <p className="mb-2 mt-5 text-[12px] font-medium text-navy-500">Consume the served data</p>
              <pre className="overflow-x-auto rounded-xl bg-[#0B0F1E] p-4 text-[11.5px] leading-relaxed text-slate-200">
                <code className="font-mono whitespace-pre">{codeSnippet}</code>
              </pre>
            </section>

            <section ref={sections.activity}>
              <H2>Pipeline activity</H2>
              {runs.length === 0 ? (
                <p className="text-[13px] text-navy-500">No runs yet — the pipeline executes in Databricks once provisioned.</p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-navy-100">
                  <div className="grid grid-cols-3 divide-x divide-navy-100 border-b border-navy-100 bg-navy-50/40">
                    <Metric value={String(runs.length)} label="Total runs" />
                    <Metric value={`${Math.round((successRuns / runs.length) * 100)}%`} label="Success rate" tone="success" />
                    <Metric value={runs[0].when} label="Last run" />
                  </div>
                  {runs.slice(0, 4).map((r, i) => (
                    <div key={r.id} className={`flex items-center justify-between gap-3 px-4 py-2.5 text-[12px] ${i > 0 ? 'border-t border-navy-100' : ''}`}>
                      <span className="flex items-center gap-2.5">
                        <span className={`h-2 w-2 rounded-full ${r.state === 'success' ? 'bg-success-500' : 'bg-danger-500'}`} />
                        <span className="font-medium text-navy-700">Run #{r.id}</span>
                        <span className="capitalize text-navy-400">{r.state}</span>
                      </span>
                      <span className="text-navy-500">{r.rows.toLocaleString()} rows · {r.durationS}s · {r.when}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </article>

          {/* Sidebar */}
          <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            {/* Deploy */}
            <div className="rounded-xl border border-navy-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[12.5px] font-semibold text-navy-900">Deployment</h3>
                <DeployBadge deploy={deploy} />
              </div>

              <ol className="relative mb-3.5 space-y-3 pl-1">
                <span className="absolute left-[11px] top-1.5 bottom-1.5 w-px bg-navy-100" aria-hidden />
                <Step n={1} label="Provision to Databricks" done={deploy !== 'not_installed'} active={deploy === 'not_installed'} />
                <Step n={2} label="Initial validation run" done={deploy === 'ran'} active={deploy === 'installed_no_run'} />
                <Step n={3} label="Promote to workspace" done={false} active={deploy === 'ran'} locked={deploy !== 'ran'} />
              </ol>

              {deploy === 'not_installed' && <CTA onClick={doInstall} busy={busy === 'install'} idle="Provision to Databricks" running="Provisioning…" icon={Rocket} />}
              {deploy === 'installed_no_run' && <CTA onClick={doRun} busy={busy === 'run'} idle="Run validation job" running="Running validation…" icon={Play} />}
              {deploy === 'ran' && <CTA onClick={doPush} busy={busy === 'push'} idle="Promote to workspace" running="Promoting…" icon={ArrowRight} tone="success" />}

              {!hasSuccessfulRun ? (
                <p className="mt-2.5 flex items-start gap-1.5 text-[10.5px] leading-snug text-navy-400">
                  <Lock className="mt-0.5 h-3 w-3 shrink-0" />
                  Promotion unlocks after the initial run succeeds and writes the sink.
                </p>
              ) : deploy === 'ran' ? (
                <p className="mt-2.5 flex items-start gap-1.5 text-[10.5px] leading-snug text-success-600">
                  <Check className="mt-0.5 h-3 w-3 shrink-0" />
                  Validated. Ready to promote to a workspace.
                </p>
              ) : null}
            </div>

            {/* Metadata */}
            <div className="rounded-xl border border-navy-100 bg-white p-4">
              <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-navy-400">Solution details</h3>
              <dl className="space-y-2 text-[12px]">
                <Row label="Models" value={String(a.contents.models)} />
                <Row label="Data entities" value={String(a.contents.entities)} />
                <Row label="Dashboards" value={String(a.contents.dashboards)} />
                <Row label="Agent tools" value={String(a.contents.agent_tools)} />
                <Row label="Installs" value={String(a.install_count)} />
                <Row label="Runs on" value={a.backends.map((b) => BACKEND_LABELS[b].split(' ')[0]).join(', ')} />
                <Row label="Access" value="Row-level" />
              </dl>
            </div>

            {/* Provenance */}
            <div className="rounded-xl border border-navy-100 bg-navy-50/40 p-4 text-[10.5px] text-navy-500">
              <div className="flex items-center gap-1.5">
                <GitBranch className="h-3 w-3" />
                <span className="truncate font-mono">{repo}@{a.version}</span>
              </div>
              <div className="mt-1.5 flex items-center gap-1.5">
                <ShieldCheck className="h-3 w-3" />
                <span>Signed by {a.signed_by || a.coe}</span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </AppLayout>
  );
}

/* ── bits ── */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 border-b border-navy-100 pb-1.5 text-[15px] font-semibold text-navy-900">{children}</h2>;
}

function Tag({ icon: Icon, label, mono }: { icon?: LucideIcon; label: string; mono?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-navy-100 px-2 py-0.5 text-[10.5px] font-medium text-navy-600">
      {Icon && <Icon className="h-3 w-3 text-navy-400" />}
      <span className={mono ? 'font-mono' : ''}>{label}</span>
    </span>
  );
}

function Metric({ value, label, tone }: { value: string; label: string; tone?: 'success' }) {
  return (
    <div className="px-4 py-3">
      <div className={`text-[17px] font-bold leading-none ${tone === 'success' ? 'text-success-600' : 'text-navy-900'}`}>{value}</div>
      <div className="mt-1 text-[10px] font-medium uppercase tracking-wide text-navy-400">{label}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-navy-500">{label}</dt>
      <dd className="font-medium text-navy-800">{value}</dd>
    </div>
  );
}

function DeployBadge({ deploy }: { deploy: DeployState }) {
  const map = {
    not_installed: { t: 'Not deployed', c: 'bg-navy-100 text-navy-500' },
    installed_no_run: { t: 'Awaiting run', c: 'bg-warn-50 text-warn-700' },
    ran: { t: 'Validated', c: 'bg-success-50 text-success-700' },
  } as const;
  const s = map[deploy];
  return <span className={`rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold uppercase ${s.c}`}>{s.t}</span>;
}

function CTA({ onClick, busy, idle, running, icon: Icon, tone }: { onClick: () => void; busy: boolean; idle: string; running: string; icon: LucideIcon; tone?: 'success' }) {
  const base = tone === 'success' ? 'bg-success-600 hover:bg-success-700' : 'bg-navy-900 hover:bg-navy-800';
  return (
    <button onClick={onClick} disabled={busy} className={`flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-[12.5px] font-semibold text-white transition-colors disabled:opacity-60 ${base}`}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      {busy ? running : idle}
    </button>
  );
}

function Step({ n, label, done, active, locked }: { n: number; label: string; done: boolean; active: boolean; locked?: boolean }) {
  return (
    <li className="relative flex items-center gap-2.5">
      <span className={`relative z-10 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold ring-4 ring-white ${
        done ? 'bg-success-500 text-white' : active ? 'bg-navy-900 text-white' : 'bg-navy-100 text-navy-400'
      }`}>
        {done ? <Check className="h-3 w-3" /> : locked ? <Lock className="h-2.5 w-2.5" /> : n}
      </span>
      <span className={`text-[12px] ${active ? 'font-semibold text-navy-900' : done ? 'text-navy-700' : 'text-navy-400'}`}>{label}</span>
    </li>
  );
}
