import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Inbox, Wrench, List, Workflow, Sun, Moon, LogOut, PanelLeft,
  Check, X, CornerUpLeft, Clock, Package, ShieldAlert, Boxes, Gauge, TrendingUp,
} from 'lucide-react';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { MATERIALS, RECOMMENDATIONS, MY_PLANTS } from '../../data/inventoryMock';
import { useRequestStore, STAGE_LABEL, ACTION_LABEL, type Stage } from '../../store/requestStore';
import WorkflowView from './WorkflowView';
import MaterialsView from './MaterialsView';
import PersonaSwitcher from './PersonaSwitcher';
import type { PersonaId } from './personas';

const money = (n: number) => (Math.abs(n) >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : Math.abs(n) >= 1_000 ? `$${(n / 1_000).toFixed(1)}K` : `$${Math.round(n)}`);
const C = { indigo: '#6366f1', amber: '#f59e0b', mint: '#22c55e', rose: '#f43f5e' };
const AXIS = 'text-navy-400 dark:text-slate-500';
const GRID = 'text-navy-100 dark:text-slate-800';
const tip = { fontSize: 11, borderRadius: 8, border: '1px solid rgba(120,120,140,0.2)' };

type View = 'dashboard' | 'requests' | 'readiness' | 'materials' | 'workflow';

export default function MaintenanceLeaderWorkspace({ persona, onPersona }: { persona: PersonaId; onPersona: (p: PersonaId) => void }) {
  const navigate = useNavigate();
  const [dark, setDark] = useState<boolean>(() => { try { return localStorage.getItem('inv-theme') !== 'light'; } catch { return true; } });
  useEffect(() => { try { localStorage.setItem('inv-theme', dark ? 'dark' : 'light'); } catch { /* ignore */ } }, [dark]);
  const [navOpen, setNavOpen] = useState(false);
  const [view, setView] = useState<View>('dashboard');
  const selected = MY_PLANTS;
  const mats = useMemo(() => MATERIALS.filter((m) => selected.includes(m.plant_id)), [selected]);
  const recs = useMemo(() => RECOMMENDATIONS.filter((r) => selected.includes(r.plant_id)), [selected]);

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
          <NavIcon icon={Inbox} active={view === 'requests'} onClick={() => setView('requests')} label="Incoming" expanded={navOpen} />
          <NavIcon icon={Wrench} active={view === 'readiness'} onClick={() => setView('readiness')} label="Spare readiness" expanded={navOpen} />
          <NavIcon icon={List} active={view === 'materials'} onClick={() => setView('materials')} label="Materials" expanded={navOpen} />
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
              <div className="leading-tight">
                <div className="text-[14.5px] font-semibold tracking-tight">Inventory Optimization</div>
                <div className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-accent-600 dark:text-accent-400">Maintenance Leader · Stage 2</div>
              </div>
            </div>
            <span className="mx-1 hidden h-5 w-px bg-navy-200 dark:bg-slate-700 sm:block" />
            <span className="hidden text-[14.5px] font-medium capitalize text-navy-500 dark:text-slate-400 sm:block">{view === 'requests' ? 'Incoming' : view}</span>
            <span className="ml-auto rounded-lg border border-navy-200 bg-white px-3 py-1.5 text-[13.5px] dark:border-slate-700 dark:bg-slate-900">All plants · India</span>
          </header>

          <main className="custom-scrollbar flex-1 overflow-y-auto">
            {view === 'dashboard' && <MaintenanceDashboard mats={mats} selected={selected} onNavigate={setView} />}
            {view === 'requests' && <WorkflowView />}
            {view === 'readiness' && <SpareReadiness mats={mats} />}
            {view === 'materials' && <MaterialsView mats={mats} recs={recs} />}
            {view === 'workflow' && <WorkflowView />}
          </main>
        </div>
      </div>
    </div>
  );
}

/* ── Maintenance dashboard ─────────────────────────────────────── */
function MaintenanceDashboard({ mats, selected, onNavigate }: { mats: typeof MATERIALS; selected: string[]; onNavigate: (v: View) => void }) {
  const requests = useRequestStore((s) => s.requests).filter((r) => selected.includes(r.plantId));
  const decide = useRequestStore((s) => s.decide);
  const sendBack = useRequestStore((s) => s.sendBack);

  const incoming = requests.filter((r) => r.stage === 'maintenance');
  const inExecution = requests.filter((r) => r.stage === 'executing');
  const approvedByMe = requests.filter((r) => r.history.some((h) => h.stage === 'maintenance' && h.decision === 'approved'));
  const spares = mats.filter((m) => m.ved === 'Vital' || m.ved === 'Essential');
  const ready = spares.filter((m) => m.coverage_days >= 20).length;
  const readiness = spares.length ? Math.round((ready / spares.length) * 100) : 100;
  const upcoming = Math.round(mats.reduce((n, m) => n + m.avg_monthly_demand, 0) * 3);
  const backlog = incoming.reduce((n, r) => n + r.savings, 0);

  const readinessByCat = useMemo(() => {
    const m = new Map<string, { total: number; ready: number }>();
    spares.forEach((s) => { const e = m.get(s.category) || { total: 0, ready: 0 }; e.total++; if (s.coverage_days >= 20) e.ready++; m.set(s.category, e); });
    return Array.from(m, ([category, e]) => ({ category, pct: Math.round((e.ready / e.total) * 100) })).sort((a, b) => a.pct - b.pct).slice(0, 8);
  }, [spares]);

  return (
    <div className="px-6 py-5">
      <div className="mb-4">
        <div className="text-[13px] text-navy-500 dark:text-slate-400">Maintenance planning · <span className="font-medium text-accent-600 dark:text-accent-400">{incoming.length} requests awaiting your approval</span></div>
        <div className="text-[21px] font-semibold tracking-tight">Maintenance Leader cockpit</div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Kpi icon={Inbox} tone="rose" value={String(incoming.length)} label="Awaiting you" sub="Stage 2" />
        <Kpi icon={Check} tone="mint" value={String(approvedByMe.length)} label="Approved by you" sub="routed on" />
        <Kpi icon={Clock} tone="violet" value={String(inExecution.length)} label="In execution" sub="work orders" />
        <Kpi icon={Gauge} tone={readiness < 80 ? 'amber' : 'mint'} value={`${readiness}%`} label="Spare readiness" sub="vital/essential" />
        <Kpi icon={TrendingUp} tone="indigo" value={upcoming.toLocaleString()} label="Upcoming demand" sub="next 3 mo · units" />
        <Kpi icon={Boxes} tone="amber" value={money(backlog)} label="Backlog value" sub="in your queue" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Incoming approvals */}
        <Panel title="Incoming for your approval" sub={`${incoming.length} routed from Plant Managers`}>
          {incoming.length === 0 ? (
            <div className="py-8 text-center text-[14px] text-navy-500 dark:text-slate-400">Nothing awaiting you. When a Plant Manager submits an action, it lands here.</div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {incoming.slice(0, 8).map((r) => (
                <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-navy-100 px-3 py-2 dark:border-slate-800">
                  <span className="rounded-full bg-accent-500/10 px-2 py-0.5 text-[11px] font-semibold text-accent-700 dark:text-accent-300">{ACTION_LABEL[r.kind]}</span>
                  <div className="min-w-0 flex-1"><div className="truncate text-[13.5px] font-medium">{r.materialDesc}</div><div className="text-[11.5px] text-navy-400 dark:text-slate-500">{r.plantId} · {money(r.savings)}{r.snapshot ? ' · sim attached' : ''}</div></div>
                  <button onClick={() => decide(r.id, 'approved', STAGE_LABEL['maintenance' as Stage])} className="inline-flex items-center gap-1 rounded-md bg-emerald-500 px-2.5 py-1.5 text-[12px] font-semibold text-white hover:bg-emerald-600"><Check className="h-3 w-3" /> Approve</button>
                  <button onClick={() => sendBack(r.id, STAGE_LABEL['maintenance' as Stage])} className="rounded-md bg-amber-500/15 p-1.5 text-amber-600 hover:bg-amber-500/25 dark:text-amber-400" aria-label="Send back"><CornerUpLeft className="h-3.5 w-3.5" /></button>
                  <button onClick={() => decide(r.id, 'rejected', STAGE_LABEL['maintenance' as Stage])} className="rounded-md bg-rose-500/15 p-1.5 text-rose-600 hover:bg-rose-500/25 dark:text-rose-400" aria-label="Reject"><X className="h-3.5 w-3.5" /></button>
                </div>
              ))}
              <button onClick={() => onNavigate('requests')} className="mt-1 text-[13px] font-medium text-accent-600 hover:underline dark:text-accent-400">Open full queue →</button>
            </div>
          )}
        </Panel>

        {/* Spare readiness */}
        <Panel title="Spare readiness by category" sub="% of vital/essential spares with ≥20d cover">
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={readinessByCat} layout="vertical" margin={{ left: 24, right: 16, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="currentColor" className={GRID} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} stroke="currentColor" className={AXIS} />
                <YAxis type="category" dataKey="category" tick={{ fontSize: 10 }} width={92} stroke="currentColor" className={AXIS} />
                <Tooltip formatter={(v) => `${v}%`} contentStyle={tip} />
                <Bar dataKey="pct" radius={[0, 4, 4, 0]}>{readinessByCat.map((c, i) => <Cell key={i} fill={c.pct < 60 ? C.rose : c.pct < 80 ? C.amber : C.mint} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      {/* Work order pipeline */}
      <Panel title="Work-order pipeline" sub="requests by stage" className="mt-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {(['maintenance', 'finance', 'regional', 'global', 'done'] as Stage[]).map((st) => {
            const count = requests.filter((r) => r.stage === st).length;
            return <div key={st} className="rounded-xl border border-navy-100 p-3 text-center dark:border-slate-800"><div className="text-[22px] font-semibold">{count}</div><div className="text-[12px] text-navy-500 dark:text-slate-400">{st === 'maintenance' ? 'With me' : STAGE_LABEL[st]}</div></div>;
          })}
        </div>
      </Panel>
    </div>
  );
}

/* ── Spare readiness view ──────────────────────────────────────── */
function SpareReadiness({ mats }: { mats: typeof MATERIALS }) {
  const [q, setQ] = useState('');
  const spares = mats.filter((m) => m.ved === 'Vital' || m.ved === 'Essential').sort((a, b) => a.coverage_days - b.coverage_days);
  const shown = spares.filter((m) => !q || m.description.toLowerCase().includes(q.toLowerCase()) || m.id.includes(q) || m.plant_id.toLowerCase().includes(q.toLowerCase()));
  const ready = spares.filter((m) => m.coverage_days >= 20).length;

  return (
    <div className="px-6 py-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-[20px] font-semibold tracking-tight">Spare Readiness</h1><p className="text-[14px] text-navy-500 dark:text-slate-500">{ready} of {spares.length} vital/essential spares ready · lowest cover first</p></div>
        <div className="flex items-center gap-2 rounded-lg border border-navy-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-900">
          <Package className="h-3.5 w-3.5 text-navy-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search spares…" className="w-48 border-none bg-transparent text-[14px] outline-none placeholder:text-navy-400 dark:text-slate-200" />
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-navy-100 dark:border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-[13.5px]">
            <thead>
              <tr className="border-b border-navy-100 bg-navy-50/60 text-left text-[11.5px] uppercase tracking-wide text-navy-400 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-500">
                <th className="px-4 py-2.5 font-semibold">Spare</th><th className="px-3 py-2.5 font-semibold">Plant</th><th className="px-3 py-2.5 font-semibold">Criticality</th>
                <th className="px-3 py-2.5 text-right font-semibold">On hand</th><th className="px-3 py-2.5 text-right font-semibold">Cover</th><th className="px-3 py-2.5 font-semibold">Readiness</th>
              </tr>
            </thead>
            <tbody>
              {shown.slice(0, 40).map((m) => {
                const status = m.coverage_days < 10 ? 'critical' : m.coverage_days < 20 ? 'low' : 'ready';
                return (
                  <tr key={m.id} className="border-b border-navy-50 last:border-0 hover:bg-navy-50/50 dark:border-slate-800/60 dark:bg-[#211c33] dark:hover:bg-slate-800/30">
                    <td className="px-4 py-2.5"><div className="font-medium">{m.description}</div><div className="font-mono text-[11.5px] text-navy-400 dark:text-slate-500">{m.id}</div></td>
                    <td className="px-3 py-2.5 text-navy-500 dark:text-slate-400">{m.plant_id}</td>
                    <td className="px-3 py-2.5"><span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${m.ved === 'Vital' ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'}`}>{m.ved}</span> <span className="text-[11.5px] text-navy-400">{m.criticality_score}</span></td>
                    <td className="px-3 py-2.5 text-right">{m.on_hand_qty}</td>
                    <td className={`px-3 py-2.5 text-right font-medium ${m.coverage_days < 20 ? 'text-rose-600 dark:text-rose-400' : ''}`}>{m.coverage_days}d</td>
                    <td className="px-3 py-2.5"><span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${status === 'ready' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : status === 'low' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'}`}>{status === 'ready' ? <><ShieldAlert className="h-3 w-3" /> Ready</> : status === 'low' ? 'Low' : 'Critical'}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ── shared bits ───────────────────────────────────────────────── */
function NavIcon({ icon: Icon, active, onClick, label, expanded }: { icon: typeof LayoutDashboard; active: boolean; onClick: () => void; label: string; expanded?: boolean }) {
  return (
    <button onClick={onClick} title={expanded ? undefined : label} className={`flex items-center rounded-lg ${expanded ? 'h-9 w-full gap-2.5 px-2.5' : 'h-9 w-9 justify-center'} ${active ? 'bg-accent-500/10 text-accent-600 dark:bg-accent-500/15 dark:text-accent-300' : 'text-navy-400 hover:bg-navy-50 dark:text-slate-500 dark:hover:bg-slate-800'}`}>
      <Icon style={{ width: 19, height: 19 }} className="shrink-0" />{expanded && <span className="truncate text-[14px] font-medium">{label}</span>}
    </button>
  );
}
const TONE: Record<string, string> = { indigo: 'bg-accent-500/12 text-accent-600 dark:text-accent-400', rose: 'bg-rose-500/12 text-rose-600 dark:text-rose-400', amber: 'bg-amber-500/12 text-amber-600 dark:text-amber-400', mint: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400', violet: 'bg-violet-500/12 text-violet-600 dark:text-violet-400' };
function Kpi({ icon: Icon, tone, value, label, sub }: { icon: typeof Inbox; tone: string; value: string; label: string; sub: string }) {
  return (
    <div className="rounded-xl border border-navy-100 bg-white p-3.5 dark:border-slate-800 dark:bg-[#211c33]">
      <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${TONE[tone]}`}><Icon className="h-4 w-4" /></span>
      <div className="mt-2.5 text-[21px] font-semibold leading-none tracking-tight">{value}</div>
      <div className="mt-1.5 text-[12.5px] font-medium">{label}</div>
      <div className="text-[11.5px] text-navy-400 dark:text-slate-500">{sub}</div>
    </div>
  );
}
function Panel({ title, sub, children, className }: { title: string; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-navy-100 bg-white p-4 dark:border-slate-800 dark:bg-[#211c33] ${className || ''}`}>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-2"><span className="text-[14px] font-semibold">{title}</span>{sub && <span className="text-[12.5px] text-navy-400 dark:text-slate-500">{sub}</span>}</div>
      {children}
    </div>
  );
}
