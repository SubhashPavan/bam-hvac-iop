import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Cell } from 'recharts';
import { Box, ShieldAlert, TrendingDown, Ban } from 'lucide-react';
import { PLANTS, MATERIALS } from '../../data/inventoryMock';

const money = (n: number) => (Math.abs(n) >= 1_000_000 ? `€${(n / 1_000_000).toFixed(2)}M` : Math.abs(n) >= 1_000 ? `€${(n / 1_000).toFixed(1)}K` : `€${n.toFixed(0)}`);

export default function PlantDashboard({ plantIds }: { plantIds?: string[] } = {}) {
  const plantList = useMemo(() => PLANTS.filter((p) => !plantIds || plantIds.includes(p.id)), [plantIds]);
  const [plantId, setPlantId] = useState(plantList[0].id);
  const plant = plantList.find((p) => p.id === plantId) || plantList[0];
  const mats = useMemo(() => MATERIALS.filter((m) => m.plant_id === plantId), [plantId]);

  const inventory = mats.reduce((n, m) => n + m.current_stock_value, 0);
  const critical = mats.filter((m) => m.criticality_score > 70);
  const slow = mats.filter((m) => m.fsn === 'Slow');
  const dead = mats.filter((m) => m.fsn === 'Non-moving');

  const catDist = useMemo(() => {
    const c = new Map<string, number>();
    mats.forEach((m) => c.set(m.category, (c.get(m.category) || 0) + m.current_stock_value));
    return Array.from(c.entries()).map(([category, value]) => ({ category, value })).sort((a, b) => b.value - a.value).slice(0, 9);
  }, [mats]);

  const criticalSpares = useMemo(() => [...critical].sort((a, b) => b.criticality_score - a.criticality_score).slice(0, 8), [critical]);

  return (
    <div className="px-6 py-5">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight">Plant Dashboard</h1>
          <p className="text-[14px] text-navy-500 dark:text-slate-500">Plant-level inventory detail · Critical spares · Dead stock</p>
        </div>
        <select value={plantId} onChange={(e) => setPlantId(e.target.value)}
          className="ml-auto rounded-lg border border-navy-200 bg-white px-3 py-1.5 text-[14px] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
          {plantList.map((p) => <option key={p.id} value={p.id}>{p.id} — {p.name}</option>)}
        </select>
        <span className="rounded-full bg-accent-500/10 px-2.5 py-1 text-[13px] font-medium text-accent-700 dark:text-accent-300">{mats.length} materials</span>
        <span className="flex items-center gap-1.5 text-[13px] text-navy-500 dark:text-slate-400"><span className={`h-2 w-2 rounded-full ${plant.service_level < 92 ? 'bg-rose-500' : 'bg-emerald-500'}`} /> Service Level ≈ {plant.service_level}%</span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={Box} tone="sky" value={money(inventory)} label="Plant Inventory" />
        <Kpi icon={ShieldAlert} tone="rose" value={String(critical.length)} label="Critical Spares" sub="Score > 70" />
        <Kpi icon={TrendingDown} tone="amber" value={String(slow.length)} label="Slow Movers" sub={money(slow.reduce((n, m) => n + m.current_stock_value, 0))} />
        <Kpi icon={Ban} tone="red" value={String(dead.length)} label="Dead Stock" sub={money(dead.reduce((n, m) => n + m.current_stock_value, 0))} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-navy-100 bg-white p-4 dark:border-slate-800 dark:bg-[#211c33]">
          <div className="mb-2 text-[14.5px] font-semibold">Category Distribution</div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={catDist} layout="vertical" margin={{ left: 20, right: 16, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="currentColor" className="text-navy-100 dark:text-slate-800" />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={money} stroke="currentColor" className="text-navy-400 dark:text-slate-500" />
                <YAxis type="category" dataKey="category" tick={{ fontSize: 10 }} width={92} stroke="currentColor" className="text-navy-400 dark:text-slate-500" />
                <Tooltip formatter={(v) => money(Number(v))} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {catDist.map((_, i) => <Cell key={i} fill="#38bdf8" />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-navy-100 bg-white p-4 dark:border-slate-800 dark:bg-[#211c33]">
          <div className="mb-3 text-[14.5px] font-semibold">Critical Spares</div>
          <div className="space-y-1.5">
            {criticalSpares.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-lg border-l-2 border-amber-400 bg-navy-50/50 px-3 py-2 dark:bg-slate-800/40">
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-[11.5px] text-navy-400 dark:text-slate-500">{m.id}</div>
                  <div className="truncate text-[13.5px] font-medium">{m.description}</div>
                </div>
                <div className="text-right">
                  <div className="text-[14.5px] font-semibold text-amber-600 dark:text-amber-400">{m.criticality_score}/100</div>
                  <div className="text-[11.5px] text-navy-400 dark:text-slate-500">{m.ved}</div>
                </div>
              </div>
            ))}
            {criticalSpares.length === 0 && <div className="py-6 text-center text-[14px] text-navy-500 dark:text-slate-400">No critical spares at this plant.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

const TONE: Record<string, string> = {
  sky: 'bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400',
  rose: 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400',
  amber: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
  red: 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400',
};
function Kpi({ icon: Icon, tone, value, label, sub }: { icon: typeof Box; tone: string; value: string; label: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-navy-100 bg-white p-4 dark:border-slate-800 dark:bg-[#211c33]">
      <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${TONE[tone]}`}><Icon className="h-4 w-4" /></span>
      <div className="mt-3 text-[26px] font-semibold leading-none">{value}</div>
      <div className="mt-1.5 text-[13.5px] font-medium">{label}</div>
      {sub && <div className="text-[12px] text-navy-400 dark:text-slate-500">{sub}</div>}
    </div>
  );
}
