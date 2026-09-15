import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Boxes,
  Check,
  Loader2,
  Rocket,
  Folder,
  Database,
  Workflow,
  FileCode,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import { useAcceleratorStore } from '../store/acceleratorStore';
import {
  INDUSTRY_LABELS,
  BACKEND_LABELS,
  type Accelerator,
  type AcceleratorIndustry,
  type AcceleratorBackend,
} from '../types/accelerator';

const INDUSTRIES: AcceleratorIndustry[] = ['retail', 'manufacturing', 'bfsi', 'healthcare', 'cross'];
const BACKENDS: AcceleratorBackend[] = ['fabric', 'databricks', 'open'];

type Phase = 'form' | 'scaffolding' | 'done';

interface ScaffoldStep {
  id: string;
  label: string;
  detail: string;
  icon: LucideIcon;
}

const SCAFFOLD_STEPS: ScaffoldStep[] = [
  { id: 'meta', label: 'Register accelerator', detail: 'catalog entry · draft version', icon: Boxes },
  { id: 'folder', label: 'Scaffold Databricks folder', detail: '/Workspace/DataLens/<slug>-dev/', icon: Folder },
  { id: 'schema', label: 'Create dev Unity Catalog schema', detail: 'datalens_<slug>_dev', icon: Database },
  { id: 'dlt', label: 'Stub DLT pipeline', detail: 'empty Bronze / Silver / Gold', icon: Workflow },
  { id: 'nb', label: 'Seed starter notebooks', detail: 'contract stubs · run(spark, silver, params)', icon: FileCode },
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export default function NewAccelerator() {
  const navigate = useNavigate();
  const addAccelerator = useAcceleratorStore((s) => s.addAccelerator);
  const existing = useAcceleratorStore((s) => s.accelerators);

  const [name, setName] = useState('');
  const [industry, setIndustry] = useState<AcceleratorIndustry>('retail');
  const [functionalArea, setFunctionalArea] = useState('');
  const [coe, setCoe] = useState('Retail CoE');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [backends, setBackends] = useState<AcceleratorBackend[]>(['databricks']);
  const [version, setVersion] = useState('0.1.0');

  const [phase, setPhase] = useState<Phase>('form');
  const [stepIdx, setStepIdx] = useState(-1);

  const slug = useMemo(() => slugify(name), [name]);
  const slugTaken = useMemo(
    () => !!slug && existing.some((a) => a.slug === slug),
    [slug, existing],
  );

  const canSubmit = name.trim().length >= 3 && !slugTaken && backends.length > 0;

  const toggleBackend = (b: AcceleratorBackend) =>
    setBackends((cur) => (cur.includes(b) ? cur.filter((x) => x !== b) : [...cur, b]));

  const handleCreate = async () => {
    setPhase('scaffolding');
    for (let i = 0; i < SCAFFOLD_STEPS.length; i++) {
      setStepIdx(i);
      await new Promise((r) => setTimeout(r, 600 + Math.random() * 400));
    }
    setStepIdx(SCAFFOLD_STEPS.length);

    const now = '2026-08-04T00:00:00Z';
    const accel: Accelerator = {
      id: `acc-${slug}`,
      slug,
      name: name.trim(),
      tagline: tagline.trim() || 'New accelerator — draft.',
      description: description.trim() || 'Authored in DataLens Studio. Draft — not yet published.',
      industry,
      functional_area: functionalArea.trim() || 'General',
      coe: coe.trim() || 'CoE',
      version,
      status: 'preview',
      backends,
      installed: false,
      install_count: 0,
      pipeline_success_pct: 0,
      updated_at: now,
      contents: {
        entities: 0,
        pipeline_tasks: 0,
        models: 0,
        dashboards: 0,
        agent_tools: 0,
        config_params: 0,
      },
      repo: `infosys-cobalt/${slug}@${version}`,
      signed_by: coe.trim() || 'CoE',
    };
    addAccelerator(accel);
    setPhase('done');
  };

  const databricksUrl = `https://acme-dev.cloud.databricks.com/#workspace/DataLens/${slug}-dev`;

  return (
    <AppLayout title="New accelerator" fluid>
      <div className="flex h-full flex-col bg-navy-50/40">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-navy-100 bg-white px-5 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/accelerators')}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-navy-200 text-navy-600 hover:bg-navy-50"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h1 className="text-[15px] font-bold tracking-tight text-navy-900">New accelerator from scratch</h1>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-success-500/25 bg-success-50 px-2.5 py-1 text-[10.5px] font-semibold text-success-700">
            <span className="h-1.5 w-1.5 rounded-full bg-success-600"></span>
            Databricks · acme-dev
          </div>
        </header>

        <div className="custom-scrollbar flex-1 overflow-y-auto px-6 py-8">
          <div className="mx-auto max-w-2xl">

            {phase === 'form' && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-navy-100 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                      <Boxes className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-[14px] font-bold text-navy-900">Define the accelerator</div>
                      <div className="text-[11.5px] text-navy-500">
                        DataLens scaffolds a dev workspace in Databricks so the CoE can build it.
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Field label="Name" required>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="DataLens"
                        className="w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-[13px] text-navy-800 outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
                      />
                      {slug && (
                        <p className={`mt-1 text-[11px] ${slugTaken ? 'text-danger-600' : 'text-navy-400'}`}>
                          slug: <span className="font-mono">{slug}</span>
                          {slugTaken && ' — already exists, pick another name'}
                        </p>
                      )}
                    </Field>

                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Industry">
                        <select
                          value={industry}
                          onChange={(e) => setIndustry(e.target.value as AcceleratorIndustry)}
                          className="w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-[13px] text-navy-800 outline-none focus:border-accent-500"
                        >
                          {INDUSTRIES.map((i) => (
                            <option key={i} value={i}>
                              {INDUSTRY_LABELS[i]}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Functional area">
                        <input
                          value={functionalArea}
                          onChange={(e) => setFunctionalArea(e.target.value)}
                          placeholder="Supply Chain"
                          className="w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-[13px] text-navy-800 outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
                        />
                      </Field>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Authoring CoE">
                        <input
                          value={coe}
                          onChange={(e) => setCoe(e.target.value)}
                          placeholder="Retail CoE"
                          className="w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-[13px] text-navy-800 outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
                        />
                      </Field>
                      <Field label="Version">
                        <input
                          value={version}
                          onChange={(e) => setVersion(e.target.value)}
                          className="w-full rounded-lg border border-navy-200 bg-white px-3 py-2 font-mono text-[13px] text-navy-800 outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
                        />
                      </Field>
                    </div>

                    <Field label="Tagline">
                      <input
                        value={tagline}
                        onChange={(e) => setTagline(e.target.value)}
                        placeholder="One line — what this solves."
                        className="w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-[13px] text-navy-800 outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
                      />
                    </Field>

                    <Field label="Description">
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={3}
                        placeholder="What it does, in a few sentences."
                        className="w-full resize-none rounded-lg border border-navy-200 bg-white px-3 py-2 text-[13px] text-navy-800 outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
                      />
                    </Field>

                    <Field label="Runs on" required>
                      <div className="flex gap-2">
                        {BACKENDS.map((b) => {
                          const on = backends.includes(b);
                          return (
                            <button
                              key={b}
                              type="button"
                              onClick={() => toggleBackend(b)}
                              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                                on
                                  ? 'border-accent-500 bg-accent-500/5 text-navy-900'
                                  : 'border-navy-200 bg-white text-navy-600 hover:bg-navy-50'
                              }`}
                            >
                              {on && <Check className="h-3.5 w-3.5 text-accent-600" />}
                              {BACKEND_LABELS[b].split(' ')[0]}
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-1 text-[11px] text-navy-400">
                        Databricks is the primary executor. Others are compatibility metadata.
                      </p>
                    </Field>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!canSubmit}
                  onClick={handleCreate}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-accent-500 px-5 py-3 text-[13.5px] font-semibold text-white shadow-sm transition-colors hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Rocket className="h-4 w-4" />
                  Create &amp; scaffold in Databricks
                </button>
              </div>
            )}

            {phase !== 'form' && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-navy-100 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                      <Boxes className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-[14px] font-bold text-navy-900">{name}</div>
                      <div className="text-[11.5px] text-navy-500">
                        v{version} · {coe} · {INDUSTRY_LABELS[industry]}
                      </div>
                    </div>
                  </div>

                  <ul className="space-y-2">
                    {SCAFFOLD_STEPS.map((s, i) => {
                      const isDone = phase === 'done' || i < stepIdx;
                      const isActive = phase === 'scaffolding' && i === stepIdx;
                      const Icon = s.icon;
                      return (
                        <li
                          key={s.id}
                          className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                            isActive
                              ? 'border-accent-500/40 bg-accent-500/5'
                              : isDone
                              ? 'border-success-500/30 bg-success-50/60'
                              : 'border-navy-100 bg-navy-50/40'
                          }`}
                        >
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                              isDone
                                ? 'bg-success-100 text-success-700'
                                : isActive
                                ? 'bg-accent-500/15 text-accent-700'
                                : 'bg-navy-100 text-navy-500'
                            }`}
                          >
                            {isDone ? (
                              <Check className="h-4 w-4" strokeWidth={2.5} />
                            ) : isActive ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Icon className="h-4 w-4" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[12.5px] font-semibold text-navy-900">{s.label}</div>
                            <div className="truncate font-mono text-[10.5px] text-navy-500">{s.detail}</div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {phase === 'done' && (
                  <div className="rounded-2xl border border-success-500/30 bg-success-50 p-5">
                    <div className="mb-3 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success-100 text-success-700">
                        <Check className="h-5 w-5" strokeWidth={2.5} />
                      </div>
                      <div>
                        <div className="text-[14px] font-bold text-navy-900">Accelerator created</div>
                        <div className="text-[11.5px] text-navy-600">
                          Added to the catalog as a <span className="font-semibold">Preview</span> draft. Dev workspace scaffolded in Databricks.
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <a
                        href={databricksUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-navy-900 px-3 py-2 text-[12.5px] font-semibold text-white hover:bg-navy-800"
                      >
                        <Sparkles className="h-4 w-4" />
                        Open dev workspace in Databricks
                      </a>
                      <button
                        type="button"
                        onClick={() => navigate('/accelerators')}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-navy-200 bg-white px-3 py-2 text-[12.5px] font-semibold text-navy-700 hover:bg-navy-50"
                      >
                        Back to catalog
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11.5px] font-semibold text-navy-700">
        {label}
        {required && <span className="ml-0.5 text-danger-500">*</span>}
      </label>
      {children}
    </div>
  );
}
