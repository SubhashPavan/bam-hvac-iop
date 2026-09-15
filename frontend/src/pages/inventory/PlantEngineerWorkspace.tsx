import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, List, Building2, ChevronDown,
  Check, Sun, Moon, LogOut, Sparkles, ArrowUp, Send,
  X, Zap, Maximize2, Minimize2, Workflow, Coins, PanelLeft, Boxes, Network, Truck, Brain,
} from 'lucide-react';
import DashboardHome from './DashboardHome';
import WorkflowView from './WorkflowView';
import ActionSlideOver from './ActionSlideOver';
import SavingsTracker from './SavingsTracker';
import SavingsPockets from './SavingsPockets';
import MaterialMaster from './MaterialMaster';
import NetworkPooling from './NetworkPooling';
import VendorAnalytics from './VendorAnalytics';
import { TopProgressBar } from './LoadingBar';
import PersonaSwitcher from './PersonaSwitcher';
import type { PersonaId } from './personas';
import { sageAnswer, sageMoney, type SageReply, type SageBlock } from './sageEngine';
import { askSage, runDeepInsight, type DeepInsight } from '../../services/inventoryApi';
import DeepInsightPanel from './DeepInsightPanel';
import { MATERIALS, RECOMMENDATIONS, PLANTS, MY_PLANTS } from '../../data/inventoryMock';
import { useRequestStore, type ActionKind } from '../../store/requestStore';
import { type Recommendation, type RecommendationType } from '../../types/inventory';

const KIND_FROM_TYPE: Record<RecommendationType, ActionKind> = {
  reduce_stock: 'reduce_stock', dispose: 'dispose', increase_stock: 'increase_stock', keep_unchanged: 'param_change', emergency_action: 'expedite',
};

type View = 'workspace' | 'dashboard' | 'materials' | 'network' | 'suppliers' | 'savings' | 'workflow';

export default function PlantEngineerWorkspace({ persona, onPersona }: { persona: PersonaId; onPersona: (p: PersonaId) => void }) {
  const navigate = useNavigate();
  const [dark, setDark] = useState<boolean>(() => { try { return localStorage.getItem('inv-theme') !== 'light'; } catch { return true; } });
  useEffect(() => { try { localStorage.setItem('inv-theme', dark ? 'dark' : 'light'); } catch { /* ignore */ } }, [dark]);

  // Prefer the demo's "my plants", but fall back to whatever plants are actually
  // loaded (e.g. an ingested dataset with entirely different plant codes) so the
  // workspace is never scoped to plants that don't exist in the active source.
  const myPlants = useMemo(() => {
    const mine = PLANTS.filter((p) => MY_PLANTS.includes(p.id));
    return mine.length ? mine : PLANTS;
  }, []);
  const [selected, setSelected] = useState<string[]>(myPlants.map((p) => p.id));
  const scopeRegion = useMemo(() => { const rs = [...new Set(myPlants.map((p) => p.region))]; return rs.length === 1 ? rs[0] : 'All regions'; }, [myPlants]);
  const [plantOpen, setPlantOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [period] = useState<number>(12);
  const [view, setView] = useState<View>('workspace');
  const [submitted, setSubmitted] = useState<Record<string, true>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const openAction = useRequestStore((s) => s.openAction);

  const mats = useMemo(() => MATERIALS.filter((m) => selected.includes(m.plant_id)), [selected]);
  const recs = useMemo(() => RECOMMENDATIONS.filter((r) => selected.includes(r.plant_id) && !submitted[r.id]), [selected, submitted]);

  // "Act" on a recommendation → open the structured Create-Action slide-over (pre-filled).
  const submit = (id: string, label: string) => {
    const rec = RECOMMENDATIONS.find((r) => r.id === id);
    if (!rec) { setToast(`${label} — routed`); window.setTimeout(() => setToast(null), 2400); return; }
    setActingId(id);
    openAction({
      materialId: rec.material_id, materialDesc: rec.material_desc, plantId: rec.plant_id,
      kind: KIND_FROM_TYPE[rec.type], currentValue: rec.current_stock_value, proposedValue: rec.recommended_value,
      savings: rec.savings_potential, cashRelease: rec.cash_release, justification: rec.ai_reasoning,
    });
  };
  const onActionDone = (label: string) => {
    if (actingId) setSubmitted((s) => ({ ...s, [actingId]: true }));
    setActingId(null);
    setToast(`${label} — request created & routed to the Maintenance Planner`);
    window.setTimeout(() => setToast(null), 3000);
  };
  const togglePlant = (id: string) => setSelected((s) => (s.includes(id) ? (s.length > 1 ? s.filter((x) => x !== id) : s) : [...s, id]));

  return (
    <div className={dark ? 'dark' : ''}>
      <PersonaSwitcher persona={persona} onChange={onPersona} />
      <div className="flex h-screen overflow-hidden bg-navy-50 font-sans text-navy-900 dark:bg-[#14111f] dark:text-slate-100">
        {/* Collapsible nav */}
        <nav className={`flex shrink-0 flex-col gap-1 overflow-hidden border-r border-navy-100 bg-white py-3 transition-[width] duration-200 dark:border-slate-800/70 dark:bg-[#1b1730] ${navOpen ? 'w-[212px] items-stretch px-2.5' : 'w-[52px] items-center'}`}>
          <div className={`mb-3 flex items-center ${navOpen ? 'w-full gap-2' : 'flex-col gap-2'}`}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-500 text-[12.5px] font-bold text-white">IO</div>
            {navOpen && <div className="min-w-0 flex-1 text-[13.5px] font-semibold leading-tight">Inventory Optimization</div>}
            <button onClick={() => setNavOpen((v) => !v)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-navy-400 hover:bg-navy-50 dark:text-slate-500 dark:hover:bg-slate-800" aria-label={navOpen ? 'Collapse menu' : 'Expand menu'}><PanelLeft style={{ width: 16, height: 16 }} /></button>
          </div>
          <NavIcon icon={Boxes} active={view === 'workspace'} onClick={() => setView('workspace')} label="Savings Wizard" expanded={navOpen} />
          <NavIcon icon={LayoutDashboard} active={view === 'dashboard'} onClick={() => setView('dashboard')} label="Dashboard" expanded={navOpen} />
          <NavIcon icon={List} active={view === 'materials'} onClick={() => setView('materials')} label="Material master" expanded={navOpen} />
          <NavIcon icon={Network} active={view === 'network'} onClick={() => setView('network')} label="Network pooling" expanded={navOpen} />
          <NavIcon icon={Truck} active={view === 'suppliers'} onClick={() => setView('suppliers')} label="Suppliers" expanded={navOpen} />
          <NavIcon icon={Coins} active={view === 'savings'} onClick={() => setView('savings')} label="Savings" expanded={navOpen} />
          <NavIcon icon={Workflow} active={view === 'workflow'} onClick={() => setView('workflow')} label="Workflow" expanded={navOpen} />
          <div className={`mt-auto flex flex-col gap-1 ${navOpen ? 'items-stretch' : 'items-center'}`}>
            <button onClick={() => setDark((v) => !v)} className={`flex items-center rounded-lg text-navy-400 hover:bg-navy-50 dark:text-slate-400 dark:hover:bg-slate-800 ${navOpen ? 'h-9 w-full gap-2.5 px-2.5' : 'h-9 w-9 justify-center'}`} aria-label="Theme">{dark ? <Sun style={{ width: 18, height: 18 }} className="shrink-0" /> : <Moon style={{ width: 18, height: 18 }} className="shrink-0" />}{navOpen && <span className="text-[14px] font-medium">{dark ? 'Light mode' : 'Dark mode'}</span>}</button>
            <button onClick={() => navigate('/accelerators')} className={`flex items-center rounded-lg text-navy-400 hover:bg-navy-50 dark:text-slate-400 dark:hover:bg-slate-800 ${navOpen ? 'h-9 w-full gap-2.5 px-2.5' : 'h-9 w-9 justify-center'}`} aria-label="Exit"><LogOut style={{ width: 18, height: 18 }} className="shrink-0" />{navOpen && <span className="text-[14px] font-medium">Exit accelerator</span>}</button>
          </div>
        </nav>

        {/* Center */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Header: title + plant dropdown */}
          <header className="relative flex h-13 shrink-0 items-center gap-3 border-b border-navy-100 px-5 py-3 dark:border-slate-800/70">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-accent-400 to-accent-600 text-[11.5px] font-bold text-white shadow-sm shadow-accent-500/30">IO</span>
              <div className="leading-tight">
                <div className="text-[14.5px] font-semibold tracking-tight">Inventory Optimization</div>
                <div className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-accent-600 dark:text-accent-400">Powered by Agentic AI</div>
              </div>
            </div>
            <span className="mx-1 hidden h-5 w-px bg-navy-200 dark:bg-slate-700 sm:block" />
            <span className="hidden text-[14.5px] font-medium capitalize text-navy-500 dark:text-slate-400 sm:block">{view}</span>
            <div className="ml-auto flex items-center gap-2">
              <div className="relative">
              <button onClick={() => setPlantOpen((v) => !v)} className="flex items-center gap-2 rounded-lg border border-navy-200 bg-white px-3 py-1.5 text-[13.5px] dark:border-slate-700 dark:bg-slate-900">
                <Building2 className="h-3.5 w-3.5 text-accent-500" />{selected.length === myPlants.length ? 'All my plants' : `${selected.length} plant${selected.length > 1 ? 's' : ''}`} · {scopeRegion}
                <ChevronDown className="h-3.5 w-3.5 text-navy-400" />
              </button>
              {plantOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setPlantOpen(false)} />
                  <div className="absolute right-0 z-20 mt-1 w-56 rounded-xl border border-navy-100 bg-white p-1.5 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                    {myPlants.map((p) => {
                      const on = selected.includes(p.id);
                      return (
                        <button key={p.id} onClick={() => togglePlant(p.id)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[14px] hover:bg-navy-50 dark:hover:bg-slate-800">
                          <span className={`flex h-4 w-4 items-center justify-center rounded border ${on ? 'border-accent-500 bg-accent-500 text-white' : 'border-navy-300 dark:border-slate-600'}`}>{on && <Check className="h-3 w-3" />}</span>
                          {p.name} · {p.id}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
              </div>
            </div>
          </header>

          <main className="custom-scrollbar relative flex-1 overflow-y-auto">
            <TopProgressBar />
            {view === 'workspace' && <SavingsPockets plantIds={selected} />}
            {view === 'dashboard' && <DashboardHome mats={mats} recs={recs} selected={selected} period={period} onNavigate={(v) => setView(v as View)} onSubmit={submit} />}
            {view === 'materials' && <MaterialMaster plantIds={selected} />}
            {view === 'network' && <NetworkPooling plantIds={selected} />}
            {view === 'suppliers' && <VendorAnalytics plantIds={selected} />}
            {view === 'savings' && <SavingsTracker recs={recs} selected={selected} />}
            {view === 'workflow' && <WorkflowView />}
          </main>
        </div>

        {/* Create-Action slide-over (opens on Act, anywhere) */}
        <ActionSlideOver onDone={onActionDone} />

        {/* Floating Sage agent */}
        <CopilotDock recs={recs} selected={selected} onNavigate={setView} />

        {toast && (
          <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-emerald-600 px-4 py-2.5 text-[14px] font-medium text-white shadow-lg">
            <span className="inline-flex items-center gap-1.5"><Check className="h-4 w-4" /> {toast}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function NavIcon({ icon: Icon, active, onClick, label, expanded }: { icon: typeof LayoutDashboard; active: boolean; onClick: () => void; label: string; expanded?: boolean }) {
  return (
    <button onClick={onClick} title={expanded ? undefined : label} className={`flex items-center rounded-lg ${expanded ? 'h-9 w-full gap-2.5 px-2.5' : 'h-9 w-9 justify-center'} ${active ? 'bg-accent-500/10 text-accent-600 dark:bg-accent-500/15 dark:text-accent-300' : 'text-navy-400 hover:bg-navy-50 dark:text-slate-500 dark:hover:bg-slate-800'}`}>
      <Icon style={{ width: 19, height: 19 }} className="shrink-0" />
      {expanded && <span className="truncate text-[14px] font-medium">{label}</span>}
    </button>
  );
}

/* ── Sage: conversational optimization engine ──────────────────── */
function MiniChart({ series, height = 52, area }: { series: { color: string; points: number[] }[]; height?: number; area?: boolean }) {
  const all = series.flatMap((s) => s.points);
  const max = Math.max(...all, 1), min = Math.min(...all, 0);
  const n = Math.max(...series.map((s) => s.points.length), 2);
  const X = (i: number) => (i / (n - 1)) * 100;
  const Y = (v: number) => 37 - ((v - min) / (max - min || 1)) * 33;
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full" style={{ height }}>
      {[0.25, 0.5, 0.75].map((g) => <line key={g} x1="0" x2="100" y1={37 - g * 33} y2={37 - g * 33} stroke="currentColor" className="text-navy-100 dark:text-slate-800" strokeWidth="0.4" />)}
      {series.map((s, si) => (
        <g key={si}>
          {area && <polygon fill={s.color} fillOpacity="0.12" points={`0,40 ${s.points.map((v, i) => `${X(i)},${Y(v)}`).join(' ')} 100,40`} />}
          <polyline fill="none" stroke={s.color} strokeWidth="1.7" strokeLinejoin="round" points={s.points.map((v, i) => `${X(i)},${Y(v)}`).join(' ')} vectorEffect="non-scaling-stroke" />
        </g>
      ))}
    </svg>
  );
}

const KPI_TONE: Record<string, string> = { rose: 'text-rose-600 dark:text-rose-400', amber: 'text-amber-600 dark:text-amber-400', mint: 'text-emerald-600 dark:text-emerald-400' };

type SageMsg = { id: string; role: 'user'; text: string } | { id: string; role: 'bot'; reply: SageReply };

function CopilotDock({ recs, selected, onNavigate }: { recs: Recommendation[]; selected: string[]; onNavigate: (v: View) => void }) {
  const [open, setOpen] = useState(false);
  const [wide, setWide] = useState(false);
  const [msgs, setMsgs] = useState<SageMsg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scroll = useRef<HTMLDivElement>(null);
  const openAction = useRequestStore((s) => s.openAction);
  const emergencies = useMemo(() => recs.filter((r) => r.type === 'emergency_action'), [recs]);

  // Deep Insight (multi-step staged report) — Sage auto-detects when a query wants one.
  const [deepOpen, setDeepOpen] = useState(false);
  const [deepRunning, setDeepRunning] = useState(false);
  const [deepReport, setDeepReport] = useState<DeepInsight | null>(null);
  const [deepSteps, setDeepSteps] = useState<string[]>([]);
  const FULL_REVIEW_STEPS = ['Portfolio health', 'Where capital is trapped', 'Demand & forecast outlook', 'Service & investment trade-off', 'Supplier lead-time risk', 'Network rebalancing'];

  const runDeep = async (raw?: string, preset?: string) => {
    const q = (raw ?? input).trim();
    if ((!q && !preset) || deepRunning) return;
    setInput('');
    if (q) setMsgs((m) => [...m, { id: `u${Math.random()}`, role: 'user', text: q },
      { id: `b${Math.random()}`, role: 'bot', reply: { text: `That's a deep one — running a **multi-step analysis** across your portfolio. The full report is opening on the right →`, blocks: [] } }]);
    setDeepSteps(preset === 'full_review' ? FULL_REVIEW_STEPS : ['Planning the analysis', 'Gathering the data', 'Running each dimension', 'Consolidating findings']);
    setDeepReport(null); setDeepRunning(true); setDeepOpen(true);
    try {
      setDeepReport(await runDeepInsight(q || 'Full inventory review', selected, preset));
    } catch {
      setDeepReport({ title: 'Deep insight unavailable', objective: q, narrative: 'The analysis backend is not reachable right now. Try again once the service is up.', plan: [], sections: [], actions: [], engine: 'rules', generated_at: new Date().toISOString() });
    } finally { setDeepRunning(false); }
  };

  // Sage classifies intent: a deep-analysis / review request runs the staged report;
  // a regular question or optimization is answered inline.
  const isDeepQuery = (q: string) => /\b(deep|deep.?dive|comprehensive|thorough|holistic|end.to.end|full (review|analysis|report|picture|assessment)|complete (review|analysis|picture)|overall (review|assessment|picture|health)|health.?check|360|walk me through|assess(ment)?|audit|everything|full review)\b/i.test(q)
    || (/\b(review|analy[sz]e|analysis|overview|report|breakdown|assessment)\b/i.test(q) && /\b(portfolio|inventory|stock|everything|all (plants|skus)|network|supply|end.to.end|risk)\b/i.test(q));

  const submit = (raw?: string) => {
    const q = (raw ?? input).trim();
    if (!q || busy || deepRunning) return;
    if (isDeepQuery(q)) runDeep(q); else send(q);
  };

  useEffect(() => {
    if (open && msgs.length === 0) {
      setMsgs([{ id: 'intro', role: 'bot', reply: { text: `Hi — I'm **Sage**. I can optimize your entire stock base: ask for **optimization opportunities**, what's at risk, obsolete or excess stock, top savings, a demand forecast, or run a what-if — and act on anything I surface.`, blocks: [], chips: ['Show optimization opportunities', 'What’s at risk?', 'Top 5 savings', 'Simulate a supplier delay'] } }]);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { scroll.current?.scrollTo({ top: scroll.current.scrollHeight, behavior: 'smooth' }); }, [msgs, open, busy]);

  const send = async (raw?: string) => {
    const q = (raw ?? input).trim(); if (!q || busy) return;
    setMsgs((m) => [...m, { id: `u${Math.random()}`, role: 'user', text: q }]);
    setInput(''); setBusy(true);
    let reply: SageReply;
    try {
      reply = await askSage(q, selected);           // live: Claude tool-calling over the backend
    } catch {
      reply = sageAnswer(q, selected);              // fallback: local engine if backend is unreachable
    }
    setBusy(false);
    setMsgs((m) => [...m, { id: `b${Math.random()}`, role: 'bot', reply }]);
    if (reply.navTo) onNavigate(reply.navTo as View);
  };

  const RichText = ({ text }: { text: string }) => <>{text.split('**').map((seg, i) => (i % 2 ? <b key={i}>{seg}</b> : <span key={i}>{seg}</span>))}</>;

  const renderBlock = (b: SageBlock, key: number) => {
    if (b.kind === 'kpis') return (
      <div key={key} className="grid grid-cols-3 gap-1.5">
        {b.tiles.map((t) => <div key={t.label} className="rounded-lg border border-navy-100 bg-white px-2 py-1.5 dark:border-slate-800 dark:bg-[#0e1730]"><div className={`text-[14.5px] font-semibold leading-none ${t.tone ? KPI_TONE[t.tone] : ''}`}>{t.value}</div><div className="mt-1 text-[10.5px] text-navy-400 dark:text-slate-500">{t.label}</div></div>)}
      </div>
    );
    if (b.kind === 'oppGroups') return (
      <div key={key} className="grid grid-cols-2 gap-1.5">
        {b.groups.map((g) => <button key={g.key} onClick={() => send(`show ${g.label}`)} className="rounded-lg border border-navy-100 bg-white p-2 text-left hover:border-accent-300 dark:border-slate-800 dark:bg-[#0e1730] dark:hover:border-accent-500/40"><div className="text-[12px] font-semibold">{g.label}</div><div className="text-[10.5px] text-navy-400 dark:text-slate-500">{g.count} · {sageMoney(g.value)}</div><div className="text-[11.5px] font-semibold text-amber-600 dark:text-amber-400">{sageMoney(g.savings)} savings</div></button>)}
      </div>
    );
    if (b.kind === 'items') return (
      <div key={key} className="rounded-xl border border-navy-100 bg-white p-2 dark:border-slate-800 dark:bg-[#0e1730]">
        <div className="mb-1 px-1 text-[11.5px] font-semibold uppercase tracking-wide text-navy-400 dark:text-slate-500">{b.title}</div>
        <div className="flex flex-col gap-1">
          {b.items.map((it, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-navy-50 dark:hover:bg-slate-800/50">
              <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-medium">{it.seed.materialDesc}</div><div className="text-[11px] text-navy-400 dark:text-slate-500">{it.badge} · {it.sub}</div></div>
              <span className="text-[12.5px] font-semibold text-amber-600 dark:text-amber-400">{sageMoney(it.value)}</span>
              <button onClick={() => openAction(it.seed)} className="rounded-md bg-accent-500 px-2 py-1 text-[11.5px] font-semibold text-white hover:bg-accent-600">{it.act}</button>
            </div>
          ))}
        </div>
      </div>
    );
    if (b.kind === 'scenario') return (
      <div key={key} className="rounded-xl border border-amber-300/50 bg-amber-50/60 p-2.5 dark:border-amber-500/25 dark:bg-amber-500/5">
        <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400"><Zap className="h-3 w-3" /> What-if simulation</div>
        <div className="text-[13.5px] font-semibold">{b.title}</div>
        <div className="mt-1 text-amber-500"><MiniChart series={[{ color: '#f59e0b', points: b.points }]} area height={54} /></div>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          {b.stats.map((st) => <div key={st.label} className="rounded-lg bg-white/70 px-2 py-1 dark:bg-slate-900/40"><div className="text-[10.5px] uppercase tracking-wide text-navy-400 dark:text-slate-500">{st.label}</div><div className={`text-[13.5px] font-semibold ${st.tone ? KPI_TONE[st.tone] : ''}`}>{st.value}</div></div>)}
        </div>
      </div>
    );
    if (b.kind === 'forecast') return (
      <div key={key} className="rounded-xl border border-navy-100 bg-white p-2 dark:border-slate-800 dark:bg-[#0e1730]">
        <div className="mb-1.5 grid grid-cols-3 gap-1.5">
          <div className="rounded-lg bg-emerald-500/10 px-2 py-1"><div className="text-[14.5px] font-semibold text-emerald-600 dark:text-emerald-400">{b.growth}</div><div className="text-[10.5px] text-navy-400 dark:text-slate-500">rising</div></div>
          <div className="rounded-lg bg-rose-500/10 px-2 py-1"><div className="text-[14.5px] font-semibold text-rose-600 dark:text-rose-400">{b.decline}</div><div className="text-[10.5px] text-navy-400 dark:text-slate-500">falling</div></div>
          <div className="rounded-lg bg-accent-500/10 px-2 py-1"><div className="text-[14.5px] font-semibold text-accent-600 dark:text-accent-400">{b.accuracy}%</div><div className="text-[10.5px] text-navy-400 dark:text-slate-500">accuracy</div></div>
        </div>
        <div className="flex flex-col gap-1">
          {b.movers.map((mv, i) => <div key={i} className="flex items-center gap-2 text-[12.5px]"><span className={mv.changePct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>{mv.changePct >= 0 ? '▲' : '▼'}</span><span className="min-w-0 flex-1 truncate">{mv.desc}</span><span className="text-navy-400 dark:text-slate-500">{mv.plant}</span><span className={`font-semibold ${mv.changePct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{mv.changePct >= 0 ? '+' : ''}{mv.changePct}%</span></div>)}
        </div>
      </div>
    );
    return null;
  };

  const globalChips = ['Show optimization opportunities', 'What’s at risk?', 'Simulate a supplier delay', 'Top 5 savings'];

  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)} className="group fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-gradient-to-br from-accent-400 to-accent-600 py-3 pl-3.5 pr-4 text-white shadow-lg shadow-accent-500/40 ring-1 ring-white/20 transition-all hover:scale-105 hover:shadow-accent-500/60">
          <span className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-accent-500/50 opacity-60 blur-lg transition-opacity group-hover:opacity-100" />
          <Sparkles className="h-5 w-5" /><span className="text-[14.5px] font-semibold">Sage</span>
          {emergencies.length > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[11.5px] font-bold ring-2 ring-white dark:ring-[#080d1a]">{emergencies.length}</span>}
        </button>
      )}

      {open && (
        <div className={`fixed inset-y-0 right-0 z-40 flex h-full flex-col overflow-hidden border-l border-navy-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0a1020] ${wide ? 'w-[min(1040px,96vw)]' : 'w-[min(720px,94vw)]'} transition-[width] duration-200`}>
          <div className="pointer-events-none absolute -top-24 right-0 h-64 w-64 rounded-full bg-accent-500/20 blur-3xl dark:bg-accent-500/15" />
          <div className="relative flex items-center gap-3 border-b border-navy-100 bg-gradient-to-r from-accent-500/10 via-transparent to-transparent px-4 py-3.5 dark:border-white/10">
            <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 text-white shadow-md shadow-accent-500/40"><span className="absolute inset-0 rounded-xl bg-accent-400/50 blur-md" /><Sparkles style={{ width: 19, height: 19 }} className="relative" /></span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[15.5px] font-semibold leading-tight">Sage <span className="rounded-full bg-accent-500/15 px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-accent-600 dark:text-accent-300">Optimization AI</span></div>
              <div className="flex items-center gap-1.5 text-[12.5px] text-navy-400 dark:text-slate-500"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Queries your whole stock base · acts into the workflow</div>
            </div>
            <button onClick={() => setWide((w) => !w)} className="rounded-lg p-1.5 text-navy-400 hover:bg-navy-50 dark:text-slate-400 dark:hover:bg-white/5" aria-label="Resize">{wide ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</button>
            <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-navy-400 hover:bg-navy-50 dark:text-slate-400 dark:hover:bg-white/5" aria-label="Close"><X className="h-4 w-4" /></button>
          </div>

          <div ref={scroll} className="custom-scrollbar relative flex-1 overflow-y-auto px-4 py-4">
            <div className="mx-auto flex max-w-[760px] flex-col gap-3">
              {msgs.map((m) => m.role === 'user' ? (
                <div key={m.id} className="max-w-[80%] self-end rounded-2xl rounded-br-sm bg-accent-500/10 px-3.5 py-2 text-[14px] text-accent-800 dark:bg-accent-500/15 dark:text-accent-100">{m.text}</div>
              ) : (
                <div key={m.id} className="flex flex-col gap-2">
                  {m.reply.steps && (
                    <div className="rounded-xl border border-navy-100 bg-navy-50/60 p-2.5 dark:border-slate-800 dark:bg-slate-900/40">
                      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-accent-600 dark:text-accent-400"><Zap className="h-3 w-3" /> Working</div>
                      {m.reply.steps.map((st, i) => <div key={i} className="flex items-center gap-2 text-[13px] text-navy-700 dark:text-slate-300"><span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"><Check className="h-2.5 w-2.5" /></span>{st}</div>)}
                    </div>
                  )}
                  <div className="max-w-[95%] rounded-2xl rounded-tl-sm bg-navy-50 px-3.5 py-2 text-[14px] leading-relaxed text-navy-700 dark:bg-slate-800 dark:text-slate-200"><RichText text={m.reply.text} /></div>
                  {m.reply.blocks.map((b, i) => renderBlock(b, i))}
                  {m.reply.chips && (
                    <div className="flex flex-wrap gap-1.5">
                      {m.reply.chips.map((c) => <button key={c} onClick={() => submit(c)} className="rounded-full border border-navy-200 px-2.5 py-1 text-[12px] font-medium text-navy-600 hover:border-accent-300 hover:bg-accent-500/5 hover:text-accent-700 dark:border-slate-700 dark:text-slate-300 dark:hover:text-accent-300">{c}</button>)}
                    </div>
                  )}
                </div>
              ))}
              {busy && <div className="flex items-center gap-1.5 self-start rounded-2xl bg-navy-50 px-3 py-2 dark:bg-slate-800"><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-navy-400 [animation-delay:-0.2s] dark:bg-slate-500" /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-navy-400 [animation-delay:-0.1s] dark:bg-slate-500" /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-navy-400 dark:bg-slate-500" /></div>}
            </div>
          </div>

          <div className="relative border-t border-navy-100 p-3 dark:border-white/10">
            <div className="mx-auto max-w-[760px]">
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <button onClick={() => runDeep(undefined, 'full_review')} className="inline-flex items-center gap-1 rounded-full border border-accent-500/40 bg-accent-500/10 px-3 py-1.5 text-[12.5px] font-semibold text-accent-600 hover:bg-accent-500/15 dark:text-accent-400"><Brain className="h-3.5 w-3.5" /> Full inventory review</button>
                {globalChips.map((c) => <button key={c} onClick={() => submit(c)} className="rounded-full border border-navy-200 bg-white px-3 py-1.5 text-[12.5px] font-medium text-navy-600 transition-colors hover:border-accent-300 hover:bg-accent-500/5 hover:text-accent-700 dark:border-slate-700 dark:bg-white/5 dark:text-slate-300 dark:hover:text-accent-300">{c}</button>)}
              </div>
              <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex items-center gap-2 rounded-xl border border-navy-200 bg-white px-3.5 py-2.5 transition-shadow focus-within:border-accent-400 focus-within:ring-2 focus-within:ring-accent-500/20 dark:border-slate-700 dark:bg-white/5">
                <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask Sage — a question, an optimization, or “review my whole portfolio”…" className="min-w-0 flex-1 border-none bg-transparent text-[14px] outline-none placeholder:text-navy-400 dark:text-slate-200 dark:placeholder:text-slate-500" />
                <button type="submit" className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent-400 to-accent-600 text-white shadow-sm shadow-accent-500/40 transition-transform hover:scale-105" aria-label="Send">{input.trim() ? <Send style={{ width: 17, height: 17 }} /> : <ArrowUp style={{ width: 17, height: 17 }} />}</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {deepOpen && <DeepInsightPanel running={deepRunning} steps={deepSteps} report={deepReport} onClose={() => setDeepOpen(false)} />}
    </>
  );
}

