import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Boxes,
  Check,
  Loader2,
  ExternalLink,
  Database,
  Folder,
  FileCode,
  Workflow,
  Clock,
  Rocket,
  AlertTriangle,
  Circle,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import { useAcceleratorStore } from '../store/acceleratorStore';
import { INDUSTRY_LABELS } from '../types/accelerator';

interface ProvisionStep {
  id: string;
  label: string;
  detail: string;
  icon: LucideIcon;
}

const STEPS: ProvisionStep[] = [
  { id: 'folder',    label: 'Create workspace folder',        detail: '/Workspace/DataLens/inv-opt-01/',           icon: Folder },
  { id: 'notebooks', label: 'Import notebook bundle',         detail: '12 notebooks · Bronze / Silver / Gold',      icon: FileCode },
  { id: 'dlt',       label: 'Create DLT pipeline',            detail: 'inv_opt_transforms · Delta Live Tables',     icon: Workflow },
  { id: 'job',       label: 'Create scheduled Databricks Job', detail: 'Daily at 03:00 UTC',                        icon: Clock },
  { id: 'schema',    label: 'Create Unity Catalog schema',    detail: 'datalens_inv_opt · Bronze/Silver/Gold',      icon: Database },
];

type Phase = 'idle' | 'provisioning' | 'done';

export default function InstallAccelerator() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const accelerator = useAcceleratorStore((s) => s.accelerators.find((a) => a.slug === slug));

  const [phase, setPhase] = useState<Phase>('idle');
  const [stepIdx, setStepIdx] = useState<number>(-1);

  if (!accelerator) {
    return (
      <AppLayout title="Install accelerator">
        <div className="mx-auto max-w-2xl rounded-2xl border border-navy-100 bg-white p-8 text-center">
          <AlertTriangle className="mx-auto h-6 w-6 text-warn-500" />
          <p className="mt-2 text-[14px] font-semibold text-navy-800">Accelerator not found</p>
          <button
            onClick={() => navigate('/accelerators')}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-accent-500 px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-accent-600"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to catalog
          </button>
        </div>
      </AppLayout>
    );
  }

  const runInstall = async () => {
    setPhase('provisioning');
    for (let i = 0; i < STEPS.length; i++) {
      setStepIdx(i);
      await new Promise((r) => setTimeout(r, 700 + Math.random() * 500));
    }
    setStepIdx(STEPS.length);
    setPhase('done');
  };

  const workspaceName = `inv-opt-${accelerator.slug.slice(0, 6)}-01`;
  const databricksUrl = `https://acme-prod.cloud.databricks.com/#joblist/pipelines/datalens/${accelerator.slug}`;

  return (
    <AppLayout title="Install accelerator" fluid>
      <div className="flex h-full flex-col bg-navy-50/40">
        {/* Header */}
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
            <h1 className="text-[15px] font-bold tracking-tight text-navy-900">Install accelerator</h1>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-success-500/25 bg-success-50 px-2.5 py-1 text-[10.5px] font-semibold text-success-700">
            <span className="h-1.5 w-1.5 rounded-full bg-success-600"></span>
            Databricks · acme-prod
          </div>
        </header>

        {/* Body */}
        <div className="custom-scrollbar flex-1 overflow-y-auto px-6 py-8">
          <div className="mx-auto flex max-w-2xl flex-col gap-4">

            {/* Accelerator identity card */}
            <div className="flex items-center gap-4 rounded-2xl border border-navy-100 bg-white p-5 shadow-sm">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                <Boxes className="h-7 w-7" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[16px] font-bold text-navy-900">{accelerator.name}</div>
                <div className="text-[11.5px] text-navy-500">
                  v{accelerator.version} · {accelerator.coe} · {INDUSTRY_LABELS[accelerator.industry]}
                </div>
                <p className="mt-1.5 text-[12.5px] text-navy-600 line-clamp-2">{accelerator.tagline}</p>
              </div>
            </div>

            {/* What will be created */}
            <div className="rounded-2xl border border-navy-100 bg-white p-5 shadow-sm">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-navy-400">
                What DataLens will do
              </div>
              <p className="mb-4 text-[12.5px] text-navy-500">
                Provision the accelerator into your Databricks workspace. Takes about 30 seconds.
                Everything runs in your own Databricks tenant — your data never leaves.
              </p>

              <ul className="space-y-2">
                {STEPS.map((s, i) => {
                  const isDone = phase === 'done' || (phase === 'provisioning' && i < stepIdx);
                  const isActive = phase === 'provisioning' && i === stepIdx;
                  const isPending = phase === 'idle' || (phase === 'provisioning' && i > stepIdx);
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
                        <div
                          className={`text-[12.5px] font-semibold ${
                            isPending ? 'text-navy-500' : 'text-navy-900'
                          }`}
                        >
                          {s.label}
                        </div>
                        <div
                          className={`truncate font-mono text-[10.5px] ${
                            isPending ? 'text-navy-400' : 'text-navy-500'
                          }`}
                        >
                          {s.detail}
                        </div>
                      </div>
                      {isPending && phase !== 'idle' && (
                        <Circle className="h-3 w-3 text-navy-300" />
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Idle: big Install button */}
            {phase === 'idle' && (
              <button
                type="button"
                onClick={runInstall}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-accent-500 px-5 py-3 text-[13.5px] font-semibold text-white shadow-sm transition-colors hover:bg-accent-600"
              >
                <Rocket className="h-4 w-4" />
                Install to Databricks
              </button>
            )}

            {/* Done: success + deep-links */}
            {phase === 'done' && (
              <div className="rounded-2xl border border-success-500/30 bg-success-50 p-5">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success-100 text-success-700">
                    <Check className="h-5 w-5" strokeWidth={2.5} />
                  </div>
                  <div>
                    <div className="text-[14px] font-bold text-navy-900">Installed</div>
                    <div className="text-[11.5px] text-navy-600">
                      Workspace <span className="font-mono">{workspaceName}</span> ready. Pipeline is scaffolded — open in Databricks to author transforms.
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
                    <ExternalLink className="h-4 w-4" />
                    Open pipeline in Databricks
                  </a>
                  <button
                    type="button"
                    onClick={() => navigate(`/solution/${workspaceName}`)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-navy-200 bg-white px-3 py-2 text-[12.5px] font-semibold text-navy-700 hover:bg-navy-50"
                  >
                    Go to Solution Home
                  </button>
                </div>

                <div className="mt-3 flex items-start gap-2 rounded-lg bg-white/60 px-3 py-2 text-[11px] text-navy-600">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success-600" />
                  <span>
                    All 12 notebooks + DLT pipeline + Job + Unity Catalog schema live inside your Databricks workspace under
                    <span className="mx-1 font-mono">/Workspace/DataLens/{workspaceName}/</span>. DataLens holds pointers, not code.
                  </span>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </AppLayout>
  );
}
