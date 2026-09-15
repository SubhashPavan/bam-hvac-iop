import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  RefreshCw,
  Plus,
  Boxes,
  FileCog,
  Users,
  ShieldCheck,
  Truck,
  Wallet,
  UserSearch,
  Stethoscope,
  Check,
  type LucideIcon,
} from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import { useAcceleratorStore } from '../store/acceleratorStore';
import {
  INDUSTRY_LABELS,
  BACKEND_LABELS,
  STATUS_LABELS,
  type Accelerator,
  type AcceleratorIndustry,
  type AcceleratorStatus,
} from '../types/accelerator';

/* ── icon + tone lookups ────────────────────────────────────────── */

const SLUG_ICON: Record<string, LucideIcon> = {
  'inventory-optimization': Boxes,
  'procurement-analytics': FileCog,
  'hr-attrition': Users,
  'credit-risk': ShieldCheck,
  'supply-chain-tower': Truck,
  'working-capital': Wallet,
  'customer-360': UserSearch,
  'clinical-ops': Stethoscope,
};

const SLUG_TONE: Record<string, { bg: string; fg: string }> = {
  'inventory-optimization': { bg: 'bg-amber-100', fg: 'text-amber-800' },
  'procurement-analytics': { bg: 'bg-emerald-100', fg: 'text-emerald-800' },
  'hr-attrition': { bg: 'bg-violet-100', fg: 'text-violet-800' },
  'credit-risk': { bg: 'bg-rose-100', fg: 'text-rose-800' },
  'supply-chain-tower': { bg: 'bg-orange-100', fg: 'text-orange-800' },
  'working-capital': { bg: 'bg-sky-100', fg: 'text-sky-800' },
  'customer-360': { bg: 'bg-pink-100', fg: 'text-pink-800' },
  'clinical-ops': { bg: 'bg-teal-100', fg: 'text-teal-800' },
};

const STATUS_TONE: Record<AcceleratorStatus, string> = {
  ga: 'bg-success-50 text-success-700 ring-success-500/25',
  beta: 'bg-warn-50 text-warn-700 ring-warn-500/25',
  preview: 'bg-navy-100 text-navy-600 ring-navy-200',
};

/* ── Page ───────────────────────────────────────────────────────── */

export default function AcceleratorCatalog() {
  const navigate = useNavigate();
  const accelerators = useAcceleratorStore((s) => s.accelerators);
  const [search, setSearch] = useState('');
  const [activeIndustry, setActiveIndustry] = useState<AcceleratorIndustry | 'all'>('all');
  const [installedOnly, setInstalledOnly] = useState(false);

  const industryChips = useMemo(() => {
    const counts = new Map<AcceleratorIndustry, number>();
    accelerators.forEach((a) => counts.set(a.industry, (counts.get(a.industry) || 0) + 1));
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [accelerators]);

  const filtered = useMemo(() => {
    return accelerators.filter((a) => {
      if (activeIndustry !== 'all' && a.industry !== activeIndustry) return false;
      if (installedOnly && !a.installed) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          a.name.toLowerCase().includes(s) ||
          a.tagline.toLowerCase().includes(s) ||
          a.functional_area.toLowerCase().includes(s) ||
          a.coe.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [accelerators, search, activeIndustry, installedOnly]);

  const installedCount = accelerators.filter((a) => a.installed).length;

  return (
    <AppLayout title="Accelerator Catalog" fluid>
      <div className="custom-scrollbar flex h-full flex-col overflow-y-auto bg-navy-50/40">
        <header className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-3 border-b border-navy-100 bg-white/95 px-6 py-4 backdrop-blur">
          <div>
            <h1 className="text-[17px] font-bold tracking-tight text-navy-900">Accelerator Catalog</h1>
            <p className="text-[12px] text-navy-500">
              Pre-built solutions from Infosys CoEs. Install to a workspace or fork as a variant.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-navy-200 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-navy-700 transition-colors hover:bg-navy-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => navigate('/accelerators/new')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent-500 px-3.5 py-1.5 text-[12.5px] font-semibold text-white shadow-sm transition-colors hover:bg-accent-600"
            >
              <Plus className="h-3.5 w-3.5" />
              New from scratch
            </button>
          </div>
        </header>

        <div className="flex-1 px-6 py-5">
          <div className="mx-auto max-w-7xl space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <IndustryChip
                active={activeIndustry === 'all'}
                label={`All · ${accelerators.length}`}
                onClick={() => setActiveIndustry('all')}
              />
              {industryChips.map(([ind, count]) => (
                <IndustryChip
                  key={ind}
                  active={activeIndustry === ind}
                  label={`${INDUSTRY_LABELS[ind]} · ${count}`}
                  onClick={() => setActiveIndustry(ind === activeIndustry ? 'all' : ind)}
                />
              ))}

              <button
                type="button"
                onClick={() => setInstalledOnly((v) => !v)}
                className={`ml-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px] font-semibold transition-colors ${
                  installedOnly
                    ? 'bg-success-50 text-success-700 ring-1 ring-inset ring-success-500/25'
                    : 'border border-navy-200 bg-white text-navy-600 hover:bg-navy-50'
                }`}
              >
                <Check className="h-3 w-3" />
                Installed here · {installedCount}
              </button>

              <div className="ml-auto flex items-center gap-2 rounded-lg border border-navy-200 bg-white px-3 py-1.5">
                <Search className="h-3.5 w-3.5 text-navy-400" />
                <input
                  type="text"
                  placeholder="Search…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-40 border-none bg-transparent text-[12.5px] text-navy-800 outline-none placeholder:text-navy-400"
                />
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-navy-200 bg-white/60 px-6 py-16 text-center">
                <p className="text-[14px] font-semibold text-navy-800">No accelerators match</p>
                <p className="text-[12.5px] text-navy-500">Clear filters or search a different term.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {filtered.map((a) => (
                  <AcceleratorCard
                    key={a.id}
                    accelerator={a}
                    onOpen={() => navigate(`/solution/${a.slug}`)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

/* ── Filter chip ────────────────────────────────────────────────── */

function IndustryChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-[11.5px] font-semibold transition-colors ${
        active
          ? 'bg-navy-900 text-white'
          : 'border border-navy-200 bg-white text-navy-600 hover:bg-navy-50'
      }`}
    >
      {label}
    </button>
  );
}

/* ── Card ───────────────────────────────────────────────────────── */

function AcceleratorCard({
  accelerator,
  onOpen,
}: {
  accelerator: Accelerator;
  onOpen: () => void;
}) {
  const Icon = SLUG_ICON[accelerator.slug] || Boxes;
  const tone = SLUG_TONE[accelerator.slug] || { bg: 'bg-navy-100', fg: 'text-navy-600' };

  return (
    <div
      onClick={onOpen}
      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border border-navy-100 bg-white transition-all hover:border-accent-200 hover:shadow-md"
    >
      <div className="flex items-start gap-3 px-4 pb-3 pt-4">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone.bg} ${tone.fg}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="truncate text-[15px] font-semibold leading-tight text-navy-900">
              {accelerator.name}
            </p>
            {accelerator.installed && (
              <span className="shrink-0 rounded-full bg-success-50 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-success-700 ring-1 ring-inset ring-success-500/25">
                Installed
              </span>
            )}
            {accelerator.status !== 'ga' && (
              <span
                className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider ring-1 ring-inset ${STATUS_TONE[accelerator.status]}`}
              >
                {STATUS_LABELS[accelerator.status]}
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-[11px] text-navy-400">
            {accelerator.coe} · v{accelerator.version}
          </p>
        </div>
      </div>

      <div className="px-4 pb-3 text-[12.5px] leading-relaxed text-navy-600">
        {accelerator.tagline}
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-navy-50 bg-navy-50/40 px-4 py-2.5">
        <div className="flex flex-wrap gap-1">
          {accelerator.backends.map((b) => (
            <span
              key={b}
              className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-500/20"
            >
              {BACKEND_LABELS[b].split(' ')[0]}
            </span>
          ))}
        </div>
        <span className="text-[10.5px] text-navy-500">{accelerator.install_count} installs</span>
      </div>
    </div>
  );
}
