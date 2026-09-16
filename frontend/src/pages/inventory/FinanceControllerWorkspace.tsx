import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Inbox, Receipt, Landmark, Workflow, Sun, Moon, LogOut, PanelLeft,
  Check, X, CornerUpLeft, Coins, TrendingUp, Banknote, Wallet, PiggyBank, Search,
} from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { MATERIALS, RECOMMENDATIONS, MY_PLANTS, regionalFinance, financeTotals, savingsFunnel } from '../../data/inventoryMock';
import { useRequestStore, STAGE_LABEL, ACTION_LABEL, type Stage } from '../../store/requestStore';
import WorkflowView from './WorkflowView';
import MaterialsView from './MaterialsView';
import PersonaSwitcher from './PersonaSwitcher';
import type { PersonaId } from './personas';

const money = (n: number) => (Math.abs(n) >= 1_000_000 ? `€${(n / 1_000_000).toFixed(2)}M` : Math.abs(n) >= 1_000 ? `€${(n / 1_000).toFixed(1)}K` : `€${Math.round(n)}`);
const C = { indigo: '#6366f1', amber: '#f59e0b', mint: '#22c55e', rose: '#f43f5e', violet: '#8b5cf6' };
const AXIS = 'text-navy-400 dark:text-slate-500';
const GRID = 'text-navy-100 dark:text-slate-800';
const tip = { fontSize: 11, borderRadius: 8, border: '1px solid rgba(120,120,140,0.2)' };

type View = 'dashboard' | 'approvals' | 'writeoffs' | 'financials' | 'workflow';

export default function FinanceControllerWorkspace({ persona, onPersona }: { persona: PersonaId; onPersona: (p: PersonaId) => void }) {
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
          <NavIcon icon={Inbox} active={view === 'approvals'} onClick={() => setView('approvals')} label="Sign-offs" expanded={navOpen} />
          <NavIcon icon={Receipt} active={view === 'writeoffs'} onClick={() => setView('writeoffs')} label="Write-offs" expanded={navOpen} />
          <NavIcon icon={Landmark} active={view === 'financials'} onClick={() => setView('financials')} label="Financials" expanded={navOpen} />
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
                <div className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-accent-600 dark:text-accent-400">Finance Controller · Stage 3</div>
              </div>
            </div>
            <span className="mx-1 hidden h-5 w-px bg-navy-200 dark:bg-slate-700 sm:block" />
            <span className="hidden text-[14.5px] font-medium capitalize text-navy-500 dark:text-slate-400 sm:block">{view === 'approvals' ? 'Sign-offs' : view === 'writeoffs' ? 'Write-offs' : view}</span>
            <span className="ml-auto rounded-lg border border-navy-200 bg-white px-3 py-1.5 text-[13.5px] dark:border-slate-700 dark:bg-slate-900">Global · all regions</span>
          </header>

          <main className="custom-scrollbar flex-1 overflow-y-auto">
            {view === 'dashboard' && <FinanceDashboard onNavigate={setView} />}
            {view === 'approvals' && <WorkflowView />}
            {view === 'writeoffs' && <WriteOffs mats={mats} />}
            {view === 'financials' && <Financials />}
            {view === 'workflow' && <WorkflowView />}
            {/* materials available for drill if needed */}
            {false && <MaterialsView mats={mats} recs={recs} />}
          </main>
        </div>
      </div>
    </div>
  );
}

/* ── Finance dashboard ─────────────────────────────────────────── */
function FinanceDashboard({ onNavigate }: { onNavigate: (v: View) => void }) {
  const requests = useRequestStore((s) => s.requests);
  const decide = useRequestStore((s) => s.decide);
  const sendBack = useRequestStore((s) => s.sendBack);
  const ft = useMemo(() => financeTotals(), []);
  const regions = useMemo(() => regionalFinance(), []);
  const f = useMemo(() => savingsFunnel(RECOMMENDATIONS), []);

  const incoming = requests.filter((r) => r.stage === 'finance');
  const writeOffPending = requests.filter((r) => r.kind === 'dispose' && (r.stage === 'finance' || r.stage === 'maintenance')).reduce((n, r) => n + r.currentValue, 0);
  const actor = STAGE_LABEL['finance' as Stage];

  return (
    <div className="px-6 py-5">
      <div className="mb-4">
        <div className="text-[13px] text-navy-500 dark:text-slate-400">Financial control · <span className="font-medium text-accent-600 dark:text-accent-400">{incoming.length} requests awaiting sign-off</span></div>
        <div className="text-[21px] font-semibold tracking-tight">Finance Controller cockpit</div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Kpi icon={Inbox} tone="rose" value={String(incoming.length)} label="Awaiting sign-off" sub="Stage 3" />
        <Kpi icon={Wallet} tone="mint" value={money(ft.wc_release)} label="Working capital released" sub="program" />
        <Kpi icon={Coins} tone="amber" value={money(f.identified)} label="Savings identified" sub="pipeline" />
        <Kpi icon={Receipt} tone="rose" value={money(writeOffPending)} label="Write-offs pending" sub="disposal value" />
        <Kpi icon={Banknote} tone="indigo" value={money(ft.npv)} label="NPV of program" sub="cash benefit" />
        <Kpi icon={TrendingUp} tone="mint" value={`${ft.roi}×`} label="Program ROI" sub="return" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Incoming for sign-off" sub={`${incoming.length} approved by Maintenance, awaiting finance`}>
          {incoming.length === 0 ? (
            <div className="py-8 text-center text-[14px] text-navy-500 dark:text-slate-400">Nothing awaiting sign-off. Requests appear here once Maintenance approves them.</div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {incoming.slice(0, 8).map((r) => (
                <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-navy-100 px-3 py-2 dark:border-slate-800">
                  <span className="rounded-full bg-accent-500/10 px-2 py-0.5 text-[11px] font-semibold text-accent-700 dark:text-accent-300">{ACTION_LABEL[r.kind]}</span>
                  <div className="min-w-0 flex-1"><div className="truncate text-[13.5px] font-medium">{r.materialDesc}</div><div className="text-[11.5px] text-navy-400 dark:text-slate-500">{r.plantId} · saves {money(r.savings)} · releases {money(r.cashRelease)}</div></div>
                  <button onClick={() => decide(r.id, 'approved', actor)} className="inline-flex items-center gap-1 rounded-md bg-emerald-500 px-2.5 py-1.5 text-[12px] font-semibold text-white hover:bg-emerald-600"><Check className="h-3 w-3" /> Sign off</button>
                  <button onClick={() => sendBack(r.id, actor)} className="rounded-md bg-amber-500/15 p-1.5 text-amber-600 hover:bg-amber-500/25 dark:text-amber-400" aria-label="Send back"><CornerUpLeft className="h-3.5 w-3.5" /></button>
                  <button onClick={() => decide(r.id, 'rejected', actor)} className="rounded-md bg-rose-500/15 p-1.5 text-rose-600 hover:bg-rose-500/25 dark:text-rose-400" aria-label="Reject"><X className="h-3.5 w-3.5" /></button>
                </div>
              ))}
              <button onClick={() => onNavigate('approvals')} className="mt-1 text-[13px] font-medium text-accent-600 hover:underline dark:text-accent-400">Open full queue →</button>
            </div>
          )}
        </Panel>

        <Panel title="Savings realization" sub="cumulative · identified vs realized">
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={f.realization} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="fcId" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.indigo} stopOpacity={0.25} /><stop offset="100%" stopColor={C.indigo} stopOpacity={0.02} /></linearGradient>
                  <linearGradient id="fcRe" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.mint} stopOpacity={0.3} /><stop offset="100%" stopColor={C.mint} stopOpacity={0.02} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className={GRID} />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="currentColor" className={AXIS} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={money} stroke="currentColor" className={AXIS} />
                <Tooltip formatter={(v) => money(Number(v))} contentStyle={tip} />
                <Area type="monotone" dataKey="identified" name="Identified" stroke={C.indigo} strokeWidth={2} fill="url(#fcId)" />
                <Area type="monotone" dataKey="realized" name="Realized" stroke={C.mint} strokeWidth={2} fill="url(#fcRe)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <Panel title="Financial impact by region" sub="working-capital release & savings across the network" className="mt-4">
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={regions} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className={GRID} />
              <XAxis dataKey="region" tick={{ fontSize: 9 }} interval={0} stroke="currentColor" className={AXIS} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={money} stroke="currentColor" className={AXIS} />
              <Tooltip formatter={(v) => money(Number(v))} contentStyle={tip} />
              <Bar dataKey="savings" name="Savings" fill={C.indigo} radius={[3, 3, 0, 0]} />
              <Bar dataKey="wc_release" name="WC release" fill={C.mint} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </div>
  );
}

/* ── Write-offs ────────────────────────────────────────────────── */
function WriteOffs({ mats }: { mats: typeof MATERIALS }) {
  const [q, setQ] = useState('');
  const openAction = useRequestStore((s) => s.openAction);
  const dead = mats.filter((m) => m.fsn === 'Non-moving').sort((a, b) => b.current_stock_value - a.current_stock_value);
  const shown = dead.filter((m) => !q || m.description.toLowerCase().includes(q.toLowerCase()) || m.id.includes(q) || m.plant_id.toLowerCase().includes(q.toLowerCase()));
  const total = dead.reduce((n, m) => n + m.current_stock_value, 0);

  return (
    <div className="px-6 py-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-[20px] font-semibold tracking-tight">Write-offs</h1><p className="text-[14px] text-navy-500 dark:text-slate-500">{dead.length} non-moving items · {money(total)} obsolescence exposure · 50% typically recoverable via disposal</p></div>
        <div className="flex items-center gap-2 rounded-lg border border-navy-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-900">
          <Search className="h-3.5 w-3.5 text-navy-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="w-48 border-none bg-transparent text-[14px] outline-none placeholder:text-navy-400 dark:text-slate-200" />
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-navy-100 dark:border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-[13.5px]">
            <thead>
              <tr className="border-b border-navy-100 bg-navy-50/60 text-left text-[11.5px] uppercase tracking-wide text-navy-400 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-500">
                <th className="px-4 py-2.5 font-semibold">Material</th><th className="px-3 py-2.5 font-semibold">Plant</th><th className="px-3 py-2.5 text-right font-semibold">Book value</th><th className="px-3 py-2.5 text-right font-semibold">Write-off</th><th className="px-3 py-2.5 text-right font-semibold">Recoverable</th><th className="px-4 py-2.5 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {shown.slice(0, 40).map((m) => (
                <tr key={m.id} className="border-b border-navy-50 last:border-0 hover:bg-navy-50/50 dark:border-slate-800/60 dark:bg-[#211c33] dark:hover:bg-slate-800/30">
                  <td className="px-4 py-2.5"><div className="font-medium">{m.description}</div><div className="font-mono text-[11.5px] text-navy-400 dark:text-slate-500">{m.id} · {m.supplier}</div></td>
                  <td className="px-3 py-2.5 text-navy-500 dark:text-slate-400">{m.plant_id}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{money(m.current_stock_value)}</td>
                  <td className="px-3 py-2.5 text-right text-rose-600 dark:text-rose-400">{money(Math.round(m.current_stock_value * 0.5))}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-emerald-600 dark:text-emerald-400">{money(Math.round(m.current_stock_value * 0.5))}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => openAction({ materialId: m.id, materialDesc: m.description, plantId: m.plant_id, kind: 'dispose', currentValue: m.current_stock_value, proposedValue: 0, savings: Math.round(m.current_stock_value * 0.5), cashRelease: Math.round(m.current_stock_value * 0.5), justification: 'Obsolete (non-moving) — approve write-off / disposal.' })} className="rounded-md bg-rose-500 px-2.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-rose-600">Approve write-off</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ── Financials ────────────────────────────────────────────────── */
function Financials() {
  const regions = useMemo(() => regionalFinance(), []);
  const ft = useMemo(() => financeTotals(), []);
  return (
    <div className="px-6 py-5">
      <div className="mb-4"><h1 className="text-[20px] font-semibold tracking-tight">Financials</h1><p className="text-[14px] text-navy-500 dark:text-slate-500">Working-capital release, savings and ROI across the network</p></div>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={Wallet} tone="mint" value={money(ft.wc_release)} label="Working capital release" sub="program total" />
        <Kpi icon={Coins} tone="amber" value={money(ft.savings)} label="Savings identified" sub="all regions" />
        <Kpi icon={Banknote} tone="indigo" value={money(ft.npv)} label="NPV" sub="cash benefit" />
        <Kpi icon={PiggyBank} tone="mint" value={`${ft.roi}×`} label="ROI" sub="program return" />
      </div>
      <Panel title="Regional finance rollup">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[13.5px]">
            <thead>
              <tr className="border-b border-navy-100 text-left text-[11.5px] uppercase tracking-wide text-navy-400 dark:border-slate-800 dark:text-slate-500">
                <th className="px-3 py-2 font-semibold">Region</th><th className="px-3 py-2 text-right font-semibold">Inventory</th><th className="px-3 py-2 text-right font-semibold">Savings</th><th className="px-3 py-2 text-right font-semibold">WC release</th><th className="px-3 py-2 text-right font-semibold">Cash benefit</th><th className="px-3 py-2 text-right font-semibold">ROI</th><th className="px-3 py-2 font-semibold">Priority</th>
              </tr>
            </thead>
            <tbody>
              {regions.map((r) => (
                <tr key={r.region} className="border-b border-navy-50 last:border-0 dark:border-slate-800/60">
                  <td className="px-3 py-2 font-medium">{r.region}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(r.total_inventory)}</td>
                  <td className="px-3 py-2 text-right font-semibold text-amber-600 dark:text-amber-400">{money(r.savings)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{money(r.wc_release)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(r.cash_benefit)}</td>
                  <td className="px-3 py-2 text-right">{r.roi}×</td>
                  <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${r.priority === 'High' ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400' : r.priority === 'Medium' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-navy-100 text-navy-500 dark:bg-slate-800 dark:text-slate-400'}`}>{r.priority}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
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
