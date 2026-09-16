import { useMemo, useState } from 'react';
import { Building2, Coins, ShieldAlert, Activity, TrendingDown } from 'lucide-react';
import { PLANTS, MATERIALS, RECOMMENDATIONS, plantTrends, opportunityGroups } from '../../data/inventoryMock';
import { WORLD_LAND_PATH } from '../../data/worldPath';
import { useRequestStore, type ActionKind } from '../../store/requestStore';

const money = (n: number) => (Math.abs(n) >= 1_000_000 ? `€${(n / 1_000_000).toFixed(2)}M` : Math.abs(n) >= 1_000 ? `€${(n / 1_000).toFixed(1)}K` : `€${Math.round(n)}`);

// Approx lat/long per plant for the equirectangular projection.
const COORD: Record<string, { lat: number; lng: number }> = {
  'IN-LAL-01': { lat: 30.6, lng: 76.8 }, 'IN-PUN-02': { lat: 18.5, lng: 73.8 }, 'IN-SON-03': { lat: 29.0, lng: 77.0 },
  'NZ-AUK-01': { lat: -36.8, lng: 174.7 }, 'AU-MEL-02': { lat: -37.8, lng: 145.0 }, 'AU-SYD-01': { lat: -33.9, lng: 151.2 },
  'ID-SBY-02': { lat: -7.2, lng: 112.7 }, 'ID-JAK-01': { lat: -6.2, lng: 106.8 }, 'US-NYC-03': { lat: 40.7, lng: -74.0 },
  'MX-MEX-01': { lat: 19.4, lng: -99.1 }, 'DE-BER-02': { lat: 52.5, lng: 13.4 }, 'ZA-JNB-01': { lat: -26.2, lng: 28.0 }, 'ZA-CPT-02': { lat: -33.9, lng: 18.4 },
};
const W = 720, H = 360;
const project = (lat: number, lng: number) => ({ x: ((lng + 180) / 360) * W, y: ((90 - lat) / 180) * H });
const svcColor = (s: number) => (s < 90 ? '#f43f5e' : s < 95 ? '#f59e0b' : '#22c55e');

export default function PlantsMap({ selected, embedded }: { selected: string[]; embedded?: boolean }) {
  const openAction = useRequestStore((s) => s.openAction);
  const metrics = useMemo(() => PLANTS.map((p) => {
    const pm = MATERIALS.filter((m) => m.plant_id === p.id);
    const inventory = pm.reduce((n, m) => n + m.current_stock_value, 0);
    const savings = RECOMMENDATIONS.filter((r) => r.plant_id === p.id).reduce((n, r) => n + r.savings_potential, 0);
    const dead = pm.filter((m) => m.fsn === 'Non-moving').reduce((n, m) => n + m.current_stock_value, 0);
    const atRisk = pm.filter((m) => m.ved === 'Vital' && m.coverage_days < 15).length;
    const turns = plantTrends([p.id]).slice(-1)[0].turns;
    return { ...p, inventory, savings, dead, atRisk, turns };
  }), []);
  const maxInv = Math.max(...metrics.map((m) => m.inventory), 1);
  const [selId, setSelId] = useState<string>(selected[0] || PLANTS[0].id);
  const sel = metrics.find((m) => m.id === selId) || metrics[0];

  // Top opportunities for the selected plant (each actionable → workflow).
  const plantOpps = useMemo(() => {
    const groups = opportunityGroups([selId]);
    return groups.flatMap((g) => g.items.slice(0, 3).map((it) => ({
      label: g.label, kind: g.actionKind as ActionKind, savings: it.savings, note: it.note, m: it.material,
    }))).sort((a, b) => b.savings - a.savings).slice(0, 6);
  }, [selId]);
  const oppTotal = plantOpps.reduce((n, o) => n + o.savings, 0);
  const actOpp = (o: typeof plantOpps[number]) => openAction({
    materialId: o.m.id, materialDesc: o.m.description, plantId: o.m.plant_id, kind: o.kind,
    currentValue: o.m.current_stock_value,
    proposedValue: o.kind === 'dispose' ? 0 : o.kind === 'reduce_stock' ? Math.round(o.m.current_stock_value * 0.6) : Math.round(o.m.current_stock_value * 0.85),
    savings: o.savings, cashRelease: o.kind === 'dispose' ? Math.round(o.m.current_stock_value * 0.5) : o.savings, justification: `${o.label}: ${o.note}.`,
  });

  return (
    <div className={embedded ? '' : 'px-6 py-5'}>
      {!embedded && (
        <div className="mb-4">
          <h1 className="text-[20px] font-semibold tracking-tight">Plant Network</h1>
          <p className="text-[14px] text-navy-500 dark:text-slate-500">{PLANTS.length} plants across the globe · marker size = inventory value · colour = service level · click to inspect</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* Map */}
        <div className="rounded-xl border border-navy-100 bg-white p-3 dark:border-slate-800 dark:bg-[#211c33]">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ aspectRatio: '2 / 1' }}>
            <rect x="0" y="0" width={W} height={H} rx="10" className="fill-navy-50 dark:fill-[#0e0b18]" />
            {/* faint graticule */}
            {[...Array(11)].map((_, i) => <line key={`v${i}`} x1={(i + 1) * (W / 12)} y1="0" x2={(i + 1) * (W / 12)} y2={H} stroke="currentColor" strokeWidth="0.4" className="text-navy-100/70 dark:text-slate-800/50" />)}
            {[...Array(5)].map((_, i) => <line key={`h${i}`} x1="0" y1={(i + 1) * (H / 6)} x2={W} y2={(i + 1) * (H / 6)} stroke="currentColor" strokeWidth="0.4" className="text-navy-100/70 dark:text-slate-800/50" />)}
            {/* land silhouette (Natural Earth 110m, equirectangular) */}
            <path d={WORLD_LAND_PATH} fillRule="evenodd" className="fill-navy-200 stroke-navy-300/60 dark:fill-slate-700/70 dark:stroke-slate-600/40" strokeWidth="0.4" />
            <text x={W * 0.16} y={20} className="fill-navy-300 dark:fill-slate-600" style={{ fontSize: 10, letterSpacing: 2 }}>AMERICAS</text>
            <text x={W * 0.5} y={20} className="fill-navy-300 dark:fill-slate-600" style={{ fontSize: 10, letterSpacing: 2 }}>EMEA</text>
            <text x={W * 0.8} y={20} className="fill-navy-300 dark:fill-slate-600" style={{ fontSize: 10, letterSpacing: 2 }}>APAC</text>
            {/* markers */}
            {metrics.map((m) => {
              const c = COORD[m.id]; if (!c) return null;
              const { x, y } = project(c.lat, c.lng);
              const r = 5 + (m.inventory / maxInv) * 13;
              const mine = selected.includes(m.id);
              const active = m.id === selId;
              return (
                <g key={m.id} onClick={() => setSelId(m.id)} style={{ cursor: 'pointer' }}>
                  {m.atRisk > 0 && <circle cx={x} cy={y} r={r + 4} fill={svcColor(m.service_level)} opacity="0.18" />}
                  <circle cx={x} cy={y} r={r} fill={svcColor(m.service_level)} fillOpacity={active ? 0.95 : 0.7} stroke={active ? '#6366f1' : mine ? '#818cf8' : '#fff'} strokeWidth={active ? 3 : mine ? 2 : 1} />
                  <text x={x} y={y - r - 4} textAnchor="middle" className="fill-navy-600 dark:fill-slate-300" style={{ fontSize: 9, fontWeight: 600 }}>{m.name}</text>
                </g>
              );
            })}
          </svg>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[12px] text-navy-500 dark:text-slate-400">
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: '#22c55e' }} /> service ≥ 95%</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: '#f59e0b' }} /> 90–95%</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: '#f43f5e' }} /> &lt; 90%</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full ring-2 ring-accent-500" /> your plant</span>
          </div>
        </div>

        {/* Selected plant KPIs */}
        <div className="rounded-xl border border-navy-100 bg-white p-4 dark:border-slate-800 dark:bg-[#211c33]">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-500/15 text-accent-600 dark:text-accent-400"><Building2 className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} /></span>
            <div><div className="text-[15.5px] font-semibold leading-tight">{sel.name}</div><div className="text-[12px] text-navy-400 dark:text-slate-500">{sel.id} · {sel.country} · {sel.region}</div></div>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-navy-50 px-3 py-2 dark:bg-slate-900/40">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: svcColor(sel.service_level) }} />
            <span className="text-[13.5px] font-medium">Service level</span>
            <span className="ml-auto text-[16.5px] font-semibold" style={{ color: svcColor(sel.service_level) }}>{sel.service_level}%</span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <MiniKpi icon={Building2} label="Inventory value" value={money(sel.inventory)} />
            <MiniKpi icon={Coins} label="Savings potential" value={money(sel.savings)} tone="amber" />
            <MiniKpi icon={Activity} label="Inventory turns" value={`${sel.turns}×`} tone="mint" />
            <MiniKpi icon={ShieldAlert} label="Vital at risk" value={String(sel.atRisk)} tone={sel.atRisk > 0 ? 'rose' : undefined} />
            <MiniKpi icon={TrendingDown} label="Dead stock" value={money(sel.dead)} tone="rose" />
            <MiniKpi icon={Building2} label="Materials" value={String(MATERIALS.filter((m) => m.plant_id === sel.id).length)} />
          </div>
          {selected.includes(sel.id) && <div className="mt-3 rounded-lg bg-accent-500/5 px-3 py-2 text-[12.5px] text-accent-700 dark:bg-accent-500/10 dark:text-accent-300">This is one of your assigned plants.</div>}

          {/* Opportunities at this plant */}
          <div className="mt-3 border-t border-navy-100 pt-3 dark:border-slate-800">
            <div className="mb-1.5 flex items-center gap-2"><span className="text-[12.5px] font-semibold uppercase tracking-wide text-navy-400 dark:text-slate-500">Opportunities</span><span className="ml-auto text-[12.5px] font-semibold text-amber-600 dark:text-amber-400">{money(oppTotal)}</span></div>
            <div className="flex flex-col gap-1.5">
              {plantOpps.map((o, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-navy-100 px-2.5 py-1.5 dark:border-slate-800">
                  <div className="min-w-0 flex-1"><div className="truncate text-[12.5px] font-medium">{o.m.description}</div><div className="text-[11px] text-navy-400 dark:text-slate-500">{o.label} · {money(o.savings)}</div></div>
                  <button onClick={() => actOpp(o)} className="rounded-md bg-accent-500 px-2 py-1 text-[11.5px] font-semibold text-white hover:bg-accent-600">Act</button>
                </div>
              ))}
              {plantOpps.length === 0 && <div className="py-2 text-center text-[12.5px] text-navy-500 dark:text-slate-400">No open opportunities at this plant.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const TONE: Record<string, string> = { amber: 'text-amber-600 dark:text-amber-400', mint: 'text-emerald-600 dark:text-emerald-400', rose: 'text-rose-600 dark:text-rose-400' };
function MiniKpi({ icon: Icon, label, value, tone }: { icon: typeof Building2; label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-navy-100 px-2.5 py-2 dark:border-slate-800">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-navy-400 dark:text-slate-500"><Icon className="h-3 w-3" />{label}</div>
      <div className={`mt-0.5 text-[16.5px] font-semibold ${tone ? TONE[tone] : ''}`}>{value}</div>
    </div>
  );
}
