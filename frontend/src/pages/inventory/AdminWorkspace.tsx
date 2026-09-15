import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Database, Users, Workflow, Sun, Moon, LogOut, PanelLeft,
  Upload, CheckCircle2, Table, Download, Plug, FileSpreadsheet, ArrowRight, Boxes, Building2, Brain,
  CalendarRange, AlertTriangle, ArrowRightCircle,
} from 'lucide-react';
import { PLANTS, MATERIALS, RECOMMENDATIONS } from '../../data/inventoryMock';
import { useRequestStore } from '../../store/requestStore';
import { PERSONAS } from './personas';
import WorkflowView from './WorkflowView';
import PersonaSwitcher from './PersonaSwitcher';
import { Spinner } from './LoadingBar';
import { ingestPreview, ingestCsv, type IngestResult } from '../../services/inventoryApi';
import type { PersonaId } from './personas';

type View = 'dashboard' | 'data' | 'users' | 'workflow';

export default function AdminWorkspace({ persona, onPersona, onDataChange }: { persona: PersonaId; onPersona: (p: PersonaId) => void; onDataChange?: () => void | Promise<void> }) {
  const navigate = useNavigate();
  const [dark, setDark] = useState<boolean>(() => { try { return localStorage.getItem('inv-theme') !== 'light'; } catch { return true; } });
  useEffect(() => { try { localStorage.setItem('inv-theme', dark ? 'dark' : 'light'); } catch { /* ignore */ } }, [dark]);
  const [navOpen, setNavOpen] = useState(false);
  const [view, setView] = useState<View>('dashboard');

  return (
    <div className={dark ? 'dark' : ''}>
      <PersonaSwitcher persona={persona} onChange={onPersona} />
      <div className="flex h-screen overflow-hidden bg-navy-50 font-sans text-navy-900 dark:bg-[#14111f] dark:text-slate-100">
        <nav className={`flex shrink-0 flex-col gap-1 overflow-hidden border-r border-navy-100 bg-white py-3 transition-[width] duration-200 dark:border-slate-800/70 dark:bg-[#1b1730] ${navOpen ? 'w-[212px] items-stretch px-2.5' : 'w-[52px] items-center'}`}>
          <div className={`mb-3 flex items-center ${navOpen ? 'w-full gap-2' : 'flex-col gap-2'}`}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-500 text-[12.5px] font-bold text-white">IO</div>
            {navOpen && <div className="min-w-0 flex-1 text-[13.5px] font-semibold leading-tight">Inventory Optimization</div>}
            <button onClick={() => setNavOpen((v) => !v)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-navy-400 hover:bg-navy-50 dark:text-slate-500 dark:hover:bg-slate-800"><PanelLeft style={{ width: 16, height: 16 }} /></button>
          </div>
          <NavIcon icon={LayoutDashboard} active={view === 'dashboard'} onClick={() => setView('dashboard')} label="Dashboard" expanded={navOpen} />
          <NavIcon icon={Database} active={view === 'data'} onClick={() => setView('data')} label="Data sources" expanded={navOpen} />
          <NavIcon icon={Users} active={view === 'users'} onClick={() => setView('users')} label="Users & access" expanded={navOpen} />
          <NavIcon icon={Workflow} active={view === 'workflow'} onClick={() => setView('workflow')} label="Workflow" expanded={navOpen} />
          <div className={`mt-auto flex flex-col gap-1 ${navOpen ? 'items-stretch' : 'items-center'}`}>
            <button onClick={() => setDark((v) => !v)} className={`flex items-center rounded-lg text-navy-400 hover:bg-navy-50 dark:text-slate-400 dark:hover:bg-slate-800 ${navOpen ? 'h-9 w-full gap-2.5 px-2.5' : 'h-9 w-9 justify-center'}`}>{dark ? <Sun style={{ width: 18, height: 18 }} className="shrink-0" /> : <Moon style={{ width: 18, height: 18 }} className="shrink-0" />}{navOpen && <span className="text-[14px] font-medium">{dark ? 'Light mode' : 'Dark mode'}</span>}</button>
            <button onClick={() => navigate('/accelerators')} className={`flex items-center rounded-lg text-navy-400 hover:bg-navy-50 dark:text-slate-400 dark:hover:bg-slate-800 ${navOpen ? 'h-9 w-full gap-2.5 px-2.5' : 'h-9 w-9 justify-center'}`}><LogOut style={{ width: 18, height: 18 }} className="shrink-0" />{navOpen && <span className="text-[14px] font-medium">Exit accelerator</span>}</button>
          </div>
        </nav>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="relative flex h-13 shrink-0 items-center gap-3 border-b border-navy-100 px-5 py-3 dark:border-slate-800/70">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-accent-400 to-accent-600 text-[11.5px] font-bold text-white shadow-sm shadow-accent-500/30">IO</span>
              <div className="leading-tight"><div className="text-[14.5px] font-semibold tracking-tight">Inventory Optimization</div><div className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-accent-600 dark:text-accent-400">Admin · Platform</div></div>
            </div>
            <span className="mx-1 hidden h-5 w-px bg-navy-200 dark:bg-slate-700 sm:block" />
            <span className="hidden text-[14.5px] font-medium capitalize text-navy-500 dark:text-slate-400 sm:block">{view === 'data' ? 'Data sources' : view === 'users' ? 'Users & access' : view}</span>
          </header>

          <main className="custom-scrollbar flex-1 overflow-y-auto">
            {view === 'dashboard' && <AdminDashboard onNavigate={setView} />}
            {view === 'data' && <DataSources onDataChange={onDataChange} onGoToWorkspace={() => onPersona('plant_manager')} />}
            {view === 'users' && <UsersAccess />}
            {view === 'workflow' && <WorkflowView />}
          </main>
        </div>
      </div>
    </div>
  );
}

function AdminDashboard({ onNavigate }: { onNavigate: (v: View) => void }) {
  const requests = useRequestStore((s) => s.requests);
  return (
    <div className="px-6 py-5">
      <div className="mb-4"><div className="text-[13px] text-navy-500 dark:text-slate-400">Platform administration</div><div className="text-[21px] font-semibold tracking-tight">Admin console</div></div>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi icon={Building2} value={String(PLANTS.length)} label="Plants" sub={`${new Set(PLANTS.map((p) => p.region)).size} regions`} />
        <Kpi icon={Boxes} value={MATERIALS.length.toLocaleString()} label="Materials (SKUs)" sub="in catalog" />
        <Kpi icon={Brain} value={RECOMMENDATIONS.length.toLocaleString()} label="AI recommendations" sub="generated" />
        <Kpi icon={Users} value={String(PERSONAS.length)} label="Personas" sub="entitled roles" />
        <Kpi icon={Workflow} value={String(requests.length)} label="Requests processed" sub="through workflow" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <button onClick={() => onNavigate('data')} className="rounded-xl border border-navy-100 bg-white p-4 text-left hover:border-accent-300 dark:border-slate-800 dark:bg-[#211c33] dark:hover:border-accent-500/40">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-500/12 text-accent-600 dark:text-accent-400"><Database className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} /></span>
          <div className="mt-2.5 text-[15px] font-semibold">Data sources & ingestion</div>
          <div className="text-[13px] text-navy-500 dark:text-slate-400">Connect Databricks/Postgres or upload a CSV — the accelerator runs on the active source.</div>
          <div className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-accent-600 dark:text-accent-400">Manage data <ArrowRight className="h-3 w-3" /></div>
        </button>
        <button onClick={() => onNavigate('users')} className="rounded-xl border border-navy-100 bg-white p-4 text-left hover:border-accent-300 dark:border-slate-800 dark:bg-[#211c33] dark:hover:border-accent-500/40">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-500/12 text-accent-600 dark:text-accent-400"><Users className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} /></span>
          <div className="mt-2.5 text-[15px] font-semibold">Users & entitlements</div>
          <div className="text-[13px] text-navy-500 dark:text-slate-400">Persona-based access — Plant Manager, Maintenance, Finance, Executive, Admin.</div>
          <div className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-accent-600 dark:text-accent-400">Manage access <ArrowRight className="h-3 w-3" /></div>
        </button>
      </div>
    </div>
  );
}

/* ── Data ingestion ────────────────────────────────────────────── */
const FIELDS = [
  { key: 'materialid', label: 'Material ID' }, { key: 'description', label: 'Description' }, { key: 'plant', label: 'Plant' },
  { key: 'category', label: 'Category' }, { key: 'supplier', label: 'Supplier' }, { key: 'stockvalue', label: 'Stock value' },
  { key: 'coverage', label: 'Coverage days' }, { key: 'ved', label: 'VED' }, { key: 'fsn', label: 'FSN' }, { key: 'xyz', label: 'XYZ' },
];
function parseCSV(text: string) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  const headers = (lines[0] || '').split(',').map((h) => h.trim());
  const rows = lines.slice(1).map((l) => l.split(',').map((c) => c.trim()));
  return { headers, rows };
}
const norm = (s: string) => s.toLowerCase().replace(/[_\s-]/g, '');

function DataSources({ onDataChange, onGoToWorkspace }: { onDataChange?: () => void | Promise<void>; onGoToWorkspace?: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<{ headers: string[]; rows: string[][]; name: string; raw: string } | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [historyCols, setHistoryCols] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<IngestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  const onFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const raw = String(reader.result || '');
      const { headers, rows } = parseCSV(raw);
      setParsed({ headers, rows, name: file.name, raw }); setResult(null); setError(null); setHistoryCols([]);
      const auto: Record<string, string> = {};
      FIELDS.forEach((f) => { const h = headers.find((hh) => norm(hh).includes(f.key) || (f.key === 'materialid' && /(^id$|matid|sku)/.test(norm(hh)))); if (h) auto[f.key] = h; });
      setMapping(auto);
      // Backend preview — smarter synonym mapping + demand-history detection.
      try {
        const pv = await ingestPreview(raw, file.name);
        const m: Record<string, string> = {};
        Object.entries(pv.suggested_mapping || {}).forEach(([k, v]) => { if (v) m[k] = v; });
        setMapping((prev) => ({ ...prev, ...m }));
        setHistoryCols(pv.history_columns || []);
      } catch { /* offline → keep the client-side mapping */ }
    };
    reader.readAsText(file);
  };
  const mappedCount = FIELDS.filter((f) => mapping[f.key]).length;

  const runIngest = async () => {
    if (!parsed) return;
    setBusy(true); setError(null); setResult(null);
    try {
      setResult(await ingestCsv(parsed.raw, mapping, parsed.name, true));
    } catch (e: any) {
      setError(e?.message || 'Ingestion failed — is the backend reachable?');
    } finally { setBusy(false); }
  };

  const openWorkspace = async () => {
    setOpening(true);
    try { await onDataChange?.(); onGoToWorkspace?.(); }
    finally { setOpening(false); }
  };

  const downloadTemplate = () => {
    const months = Array.from({ length: 18 }, (_, i) => `M${i + 1}`);
    const cols = ['material_id', 'description', 'plant', 'category', 'supplier', 'stock_value', 'coverage_days', 'ved', 'fsn', 'xyz', ...months];
    const sample = MATERIALS.slice(0, 25).map((m) => [m.id, `"${m.description}"`, m.plant_id, m.category, m.supplier, m.current_stock_value, m.coverage_days, m.ved, m.fsn, m.xyz, ...months.map(() => Math.max(0, Math.round(m.avg_monthly_demand * (0.4 + Math.random()))))].join(','));
    const blob = new Blob([[cols.join(','), ...sample].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'inventory-template.csv'; a.click(); URL.revokeObjectURL(a.href);
  };

  return (
    <div className="px-6 py-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-[20px] font-semibold tracking-tight">Data sources & ingestion</h1><p className="text-[14px] text-navy-500 dark:text-slate-500">Upload a CSV with demand history — the engine classifies (FSN/XYZ/ABC), computes safety stock, reorder point &amp; EOQ, and the whole accelerator runs on it.</p></div>
        <button onClick={downloadTemplate} className="inline-flex items-center gap-1.5 rounded-lg border border-navy-200 px-3 py-1.5 text-[13.5px] font-medium text-navy-600 hover:bg-navy-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"><Download className="h-3.5 w-3.5" /> Download CSV template</button>
      </div>

      {/* Connected sources */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SourceCard icon={Plug} name="Databricks Gold" detail="acme.inventory_gold" status="active" />
        <SourceCard icon={Database} name="Neon Postgres" detail="chat-new · invoice, stock" status="connected" />
        <SourceCard icon={FileSpreadsheet} name={parsed ? parsed.name : 'CSV upload'} detail={parsed ? `${parsed.rows.length} rows` : 'drag a file below'} status={result?.activated ? 'active' : parsed ? 'staged' : 'none'} />
      </div>

      {/* Upload */}
      <div className="rounded-xl border border-navy-100 bg-white p-4 dark:border-slate-800 dark:bg-[#211c33]">
        <div className="mb-3 text-[14.5px] font-semibold">Upload inventory extract (CSV)</div>
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
        <div onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-navy-200 py-8 text-center hover:border-accent-400 hover:bg-accent-500/5 dark:border-slate-700">
          <Upload className="h-6 w-6 text-accent-500" />
          <div className="text-[14px] font-medium">Drop a CSV here, or click to browse</div>
          <div className="text-[12.5px] text-navy-400 dark:text-slate-500">Core: material_id, description, plant, category, supplier, stock_value, coverage_days, ved · plus monthly demand columns (M1…M18 or 2024-01…)</div>
        </div>

        {parsed && (
          <div className="mt-4">
            {/* history detected */}
            {historyCols.length > 0 && (
              <div className="mb-3 inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] px-3 py-1.5 text-[13px] font-medium text-emerald-700 dark:text-emerald-400">
                <CalendarRange className="h-4 w-4" /> {historyCols.length} months of demand history detected ({historyCols[0]}…{historyCols[historyCols.length - 1]}) — forecasting will run on the real series.
              </div>
            )}

            {/* Preview */}
            <div className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-navy-600 dark:text-slate-300"><Table className="h-3.5 w-3.5" /> Preview — {parsed.rows.length} rows, {parsed.headers.length} columns</div>
            <div className="overflow-x-auto rounded-lg border border-navy-100 dark:border-slate-800">
              <table className="w-full text-[12.5px]">
                <thead><tr className="border-b border-navy-100 bg-navy-50/60 text-left dark:border-slate-800 dark:bg-slate-900/40">{parsed.headers.slice(0, 14).map((h) => <th key={h} className="whitespace-nowrap px-2.5 py-1.5 font-semibold text-navy-500 dark:text-slate-400">{h}</th>)}{parsed.headers.length > 14 && <th className="px-2.5 py-1.5 text-navy-400">+{parsed.headers.length - 14}</th>}</tr></thead>
                <tbody>{parsed.rows.slice(0, 6).map((r, i) => <tr key={i} className="border-b border-navy-50 last:border-0 dark:border-slate-800/60">{r.slice(0, 14).map((c, j) => <td key={j} className="whitespace-nowrap px-2.5 py-1.5 text-navy-600 dark:text-slate-300">{c}</td>)}{r.length > 14 && <td className="px-2.5 py-1.5 text-navy-300">…</td>}</tr>)}</tbody>
              </table>
            </div>

            {/* Mapping */}
            <div className="mt-4 mb-2 text-[13px] font-semibold text-navy-600 dark:text-slate-300">Map to inventory schema · {mappedCount}/{FIELDS.length} core mapped</div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {FIELDS.map((f) => (
                <div key={f.key} className="flex items-center gap-2 rounded-lg border border-navy-100 px-2.5 py-1.5 dark:border-slate-800">
                  <span className="w-24 shrink-0 text-[12.5px] font-medium">{f.label}</span>
                  <ArrowRight className="h-3 w-3 shrink-0 text-navy-300" />
                  <select value={mapping[f.key] || ''} onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))} className="min-w-0 flex-1 rounded-md border border-navy-200 bg-white px-2 py-1 text-[12.5px] outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                    <option value="">— unmapped —</option>
                    {parsed.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              {!result && (
                <button onClick={runIngest} disabled={mappedCount < 3 || busy} className="inline-flex items-center gap-1.5 rounded-lg bg-accent-500 px-4 py-2 text-[14px] font-semibold text-white hover:bg-accent-600 disabled:opacity-50">
                  {busy ? <><Spinner className="h-3.5 w-3.5" /> Ingesting &amp; computing policy…</> : <>Ingest &amp; activate source</>}
                </button>
              )}
              {busy && <span className="text-[13px] text-navy-500 dark:text-slate-400">Classifying, sizing safety stock / ROP / EOQ across {parsed.rows.length.toLocaleString()} SKUs…</span>}
              {error && <span className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-rose-600 dark:text-rose-400"><AlertTriangle className="h-4 w-4" /> {error}</span>}
            </div>

            {result && (
              <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.05] p-4">
                <div className="mb-2 flex items-center gap-2 text-[14.5px] font-semibold text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="h-4.5 w-4.5" /> Source activated — the accelerator now runs on this data.</div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Metric value={result.material_count.toLocaleString()} label="SKUs classified" />
                  <Metric value={String(result.plant_count)} label="Plants" />
                  <Metric value={result.history_periods ? `${result.history_periods} mo` : '—'} label="Demand history" />
                  <Metric value={result.recommendation_count.toLocaleString()} label="Recommendations" />
                </div>
                <button onClick={openWorkspace} disabled={opening} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-accent-500 px-4 py-2 text-[14px] font-semibold text-white hover:bg-accent-600 disabled:opacity-60">
                  {opening ? <><Spinner className="h-3.5 w-3.5" /> Loading the accelerator…</> : <><ArrowRightCircle className="h-4 w-4" /> Open the accelerator on this data</>}
                </button>
                {result.issues?.[0] && <div className="mt-2 text-[12px] text-navy-500 dark:text-slate-400">{result.issues[0]}</div>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg border border-navy-100 bg-white px-3 py-2 dark:border-slate-800 dark:bg-[#211c33]">
      <div className="text-[18px] font-semibold leading-none tracking-tight">{value}</div>
      <div className="mt-1 text-[12px] text-navy-400 dark:text-slate-500">{label}</div>
    </div>
  );
}

function SourceCard({ icon: Icon, name, detail, status }: { icon: typeof Plug; name: string; detail: string; status: 'active' | 'connected' | 'staged' | 'none' }) {
  const tone = status === 'active' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : status === 'connected' ? 'bg-accent-500/15 text-accent-600 dark:text-accent-400' : status === 'staged' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-navy-100 text-navy-400 dark:bg-slate-800 dark:text-slate-500';
  return (
    <div className="rounded-xl border border-navy-100 bg-white p-3.5 dark:border-slate-800 dark:bg-[#211c33]">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-100 text-navy-500 dark:bg-slate-800 dark:text-slate-400"><Icon className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1"><div className="truncate text-[14px] font-semibold">{name}</div><div className="truncate text-[12px] text-navy-400 dark:text-slate-500">{detail}</div></div>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${tone}`}>{status === 'none' ? '—' : status}</span>
      </div>
    </div>
  );
}

/* ── Users & entitlements ──────────────────────────────────────── */
function UsersAccess() {
  const demoUsers = [
    { name: 'Priya Nair', email: 'priya@acme.co', persona: 'Plant Manager', plants: 'Lalru, Pune, Sonipat' },
    { name: 'Marco Rossi', email: 'marco@acme.co', persona: 'Maintenance Leader', plants: 'All India' },
    { name: 'Dana Feld', email: 'dana@acme.co', persona: 'Finance Controller', plants: 'Global' },
    { name: 'Sam Okoro', email: 'sam@acme.co', persona: 'Program Executive', plants: 'Global' },
    { name: 'Riya Sharma', email: 'riya@acme.co', persona: 'Admin', plants: 'All' },
  ];
  return (
    <div className="px-6 py-5">
      <div className="mb-4"><h1 className="text-[20px] font-semibold tracking-tight">Users & entitlements</h1><p className="text-[14px] text-navy-500 dark:text-slate-500">Persona-based access — each role sees a scoped vantage point and approves at its workflow stage.</p></div>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {PERSONAS.map((p) => <div key={p.id} className="rounded-xl border border-navy-100 bg-white p-3 dark:border-slate-800 dark:bg-[#211c33]"><div className="text-[13.5px] font-semibold">{p.name}</div><div className="mt-0.5 text-[12px] text-navy-400 dark:text-slate-500">{p.role}</div></div>)}
      </div>
      <div className="overflow-hidden rounded-xl border border-navy-100 dark:border-slate-800">
        <table className="w-full min-w-[640px] text-[13.5px]">
          <thead><tr className="border-b border-navy-100 bg-navy-50/60 text-left text-[11.5px] uppercase tracking-wide text-navy-400 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-500"><th className="px-4 py-2.5 font-semibold">User</th><th className="px-3 py-2.5 font-semibold">Persona</th><th className="px-3 py-2.5 font-semibold">Scope</th><th className="px-3 py-2.5 font-semibold">Status</th></tr></thead>
          <tbody>
            {demoUsers.map((u) => (
              <tr key={u.email} className="border-b border-navy-50 last:border-0 dark:border-slate-800/60 dark:bg-[#211c33]">
                <td className="px-4 py-2.5"><div className="font-medium">{u.name}</div><div className="text-[11.5px] text-navy-400 dark:text-slate-500">{u.email}</div></td>
                <td className="px-3 py-2.5"><span className="rounded-full bg-accent-500/10 px-2 py-0.5 text-[11.5px] font-semibold text-accent-700 dark:text-accent-300">{u.persona}</span></td>
                <td className="px-3 py-2.5 text-navy-500 dark:text-slate-400">{u.plants}</td>
                <td className="px-3 py-2.5"><span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11.5px] font-semibold text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="h-3 w-3" /> Active</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NavIcon({ icon: Icon, active, onClick, label, expanded }: { icon: typeof LayoutDashboard; active: boolean; onClick: () => void; label: string; expanded?: boolean }) {
  return (
    <button onClick={onClick} title={expanded ? undefined : label} className={`flex items-center rounded-lg ${expanded ? 'h-9 w-full gap-2.5 px-2.5' : 'h-9 w-9 justify-center'} ${active ? 'bg-accent-500/10 text-accent-600 dark:bg-accent-500/15 dark:text-accent-300' : 'text-navy-400 hover:bg-navy-50 dark:text-slate-500 dark:hover:bg-slate-800'}`}>
      <Icon style={{ width: 19, height: 19 }} className="shrink-0" />{expanded && <span className="truncate text-[14px] font-medium">{label}</span>}
    </button>
  );
}
function Kpi({ icon: Icon, value, label, sub }: { icon: typeof Boxes; value: string; label: string; sub: string }) {
  return (
    <div className="rounded-xl border border-navy-100 bg-white p-3.5 dark:border-slate-800 dark:bg-[#211c33]">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-500/12 text-accent-600 dark:text-accent-400"><Icon className="h-4 w-4" /></span>
      <div className="mt-2.5 text-[21px] font-semibold leading-none tracking-tight">{value}</div>
      <div className="mt-1.5 text-[12.5px] font-medium">{label}</div>
      <div className="text-[11.5px] text-navy-400 dark:text-slate-500">{sub}</div>
    </div>
  );
}
