import { useState } from 'react';
import { Clock, TrendingUp, Zap, AlertTriangle, Play, Loader2, RefreshCw } from 'lucide-react';
import { PLANTS } from '../../data/inventoryMock';

const SCENARIOS = [
  { key: 'lead_time', label: 'Lead Time Increase', icon: Clock },
  { key: 'demand_spike', label: 'Demand Spike', icon: TrendingUp },
  { key: 'plant_shutdown', label: 'Plant Shutdown', icon: Zap },
  { key: 'supplier_failure', label: 'Supplier Failure', icon: AlertTriangle },
];

interface Impact { service: number; stockouts: number; extra_cost: number; wc_impact: number }

export default function DigitalTwin() {
  const [scenario, setScenario] = useState('lead_time');
  const [plant, setPlant] = useState(PLANTS[0].id);
  const [intensity, setIntensity] = useState(40);
  const [running, setRunning] = useState(false);
  const [impact, setImpact] = useState<Impact | null>(null);

  const run = async () => {
    setRunning(true);
    setImpact(null);
    await new Promise((r) => setTimeout(r, 1500));
    const sev = intensity / 100;
    setImpact({
      service: Math.round((95 - sev * 22) * 10) / 10,
      stockouts: Math.round(sev * 140),
      extra_cost: Math.round(sev * 2_400_000),
      wc_impact: Math.round(sev * 3_100_000),
    });
    setRunning(false);
  };

  return (
    <div className="px-6 py-5">
      <div className="mb-4">
        <h1 className="text-[19px] font-semibold tracking-tight">Digital Twin Simulator</h1>
        <p className="text-[12.5px] text-navy-500 dark:text-slate-500">What-if analysis · Scenario planning · Risk simulation</p>
      </div>

      <div className="mb-4 flex items-center justify-between rounded-xl border border-accent-300/40 bg-accent-500/5 p-4 dark:border-accent-500/30 dark:bg-accent-500/10">
        <div>
          <div className="text-[13px] font-semibold text-accent-700 dark:text-accent-300">Digital Twin Mode — Advanced</div>
          <div className="text-[11.5px] text-navy-500 dark:text-slate-400">Simulate disruption scenarios and instantly see inventory, service level, and cost impacts without affecting live data.</div>
        </div>
        <span className="rounded-full bg-success-500/15 px-2.5 py-1 text-[11px] font-semibold text-success-600 dark:text-success-400">Simulation Ready</span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Scenario type */}
        <div className="rounded-xl border border-navy-100 bg-white p-4 dark:border-slate-800 dark:bg-[#211c33]">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-navy-400 dark:text-slate-500">Scenario Type</div>
          <div className="space-y-2">
            {SCENARIOS.map((s) => {
              const Icon = s.icon;
              const active = scenario === s.key;
              return (
                <button key={s.key} onClick={() => { setScenario(s.key); setImpact(null); }}
                  className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-[12.5px] font-medium transition-colors ${active ? 'border-accent-400 bg-accent-500/10 dark:border-accent-500' : 'border-navy-100 hover:bg-navy-50 dark:border-slate-800 dark:hover:bg-slate-800/40'}`}>
                  <Icon className={`h-4 w-4 ${active ? 'text-accent-600 dark:text-accent-400' : 'text-navy-400 dark:text-slate-500'}`} />
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Parameters */}
        <div className="rounded-xl border border-navy-100 bg-white p-4 dark:border-slate-800 dark:bg-[#211c33]">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-navy-400 dark:text-slate-500">Parameters</div>
          <label className="mb-1 block text-[11.5px] font-medium">Plant</label>
          <select value={plant} onChange={(e) => setPlant(e.target.value)}
            className="mb-4 w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-[12.5px] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            {PLANTS.map((p) => <option key={p.id} value={p.id}>{p.id} — {p.name}</option>)}
          </select>
          <div className="mb-1 flex items-center justify-between text-[11.5px] font-medium"><span>Intensity</span><span className="text-accent-600 dark:text-accent-400">{intensity}%</span></div>
          <input type="range" min={0} max={100} step={5} value={intensity} onChange={(e) => setIntensity(Number(e.target.value))} className="w-full accent-accent-500" />
          <div className="mb-4 flex justify-between text-[10px] text-navy-400 dark:text-slate-500"><span>Low</span><span>Severe</span></div>
          <button onClick={run} disabled={running}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent-500 px-3 py-2.5 text-[12.5px] font-semibold text-white hover:bg-accent-600 disabled:opacity-60">
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}{running ? 'Running simulation…' : 'Run Simulation'}
          </button>
        </div>

        {/* Impact preview */}
        <div className="rounded-xl border border-navy-100 bg-white p-4 dark:border-slate-800 dark:bg-[#211c33]">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-navy-400 dark:text-slate-500">Impact Preview</div>
          {!impact && !running ? (
            <div className="flex h-[220px] flex-col items-center justify-center gap-2 text-center text-[12px] text-navy-400 dark:text-slate-500">
              <RefreshCw className="h-6 w-6" />
              Configure scenario and run simulation to see impact predictions
            </div>
          ) : running ? (
            <div className="flex h-[220px] items-center justify-center text-navy-400 dark:text-slate-500"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : impact && (
            <div className="space-y-2.5">
              <Impact label="Projected Service Level" value={`${impact.service}%`} tone={impact.service < 90 ? 'rose' : 'emerald'} />
              <Impact label="Additional Stockouts" value={String(impact.stockouts)} tone="amber" />
              <Impact label="Extra Holding Cost" value={money(impact.extra_cost)} tone="rose" />
              <Impact label="Working Capital Impact" value={money(impact.wc_impact)} tone="rose" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const money = (n: number) => (Math.abs(n) >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : Math.abs(n) >= 1_000 ? `$${(n / 1_000).toFixed(1)}K` : `$${n.toFixed(0)}`);
function Impact({ label, value, tone }: { label: string; value: string; tone: 'rose' | 'emerald' | 'amber' }) {
  const c = { rose: 'text-rose-600 dark:text-rose-400', emerald: 'text-emerald-600 dark:text-emerald-400', amber: 'text-amber-600 dark:text-amber-400' }[tone];
  return (
    <div className="flex items-center justify-between rounded-lg border border-navy-100 bg-navy-50/50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/40">
      <span className="text-[11.5px] text-navy-600 dark:text-slate-400">{label}</span>
      <span className={`text-[15px] font-semibold ${c}`}>{value}</span>
    </div>
  );
}
