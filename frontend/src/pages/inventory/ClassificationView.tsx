import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { PLANTS, MATERIALS, classification, plannerKpis, plantTrends, type ClassDim } from '../../data/inventoryMock';
import type { Material } from '../../types/inventory';

const money = (n: number) => (Math.abs(n) >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : Math.abs(n) >= 1_000 ? `$${(n / 1_000).toFixed(1)}K` : `$${Math.round(n)}`);
const COLORS = ['#6366f1', '#f59e0b', '#f43f5e', '#22c55e', '#8b5cf6', '#0891b2'];
const AXIS = 'text-navy-400 dark:text-slate-500';
const GRID = 'text-navy-100 dark:text-slate-800';
const tip = { fontSize: 11, borderRadius: 8, border: '1px solid rgba(120,120,140,0.2)' };

const DIMS: { k: ClassDim | 'performance'; label: string }[] = [
  { k: 'abc', label: 'ABC' }, { k: 'xyz', label: 'XYZ' }, { k: 'fsn', label: 'FSN' },
  { k: 'ved', label: 'VED' }, { k: 'criticality', label: 'Criticality' }, { k: 'performance', label: 'Performance' },
];

export default function ClassificationView({ selected }: { selected: string[] }) {
  const [dim, setDim] = useState<ClassDim | 'performance'>('abc');
  return (
    <div className="px-6 py-5">
      <div className="mb-4">
        <h1 className="text-[19px] font-semibold tracking-tight">Inventory Classification</h1>
        <p className="text-[12.5px] text-navy-500 dark:text-slate-500">Segment by value, demand variability, movement, criticality — and track policy performance</p>
      </div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {DIMS.map((d) => (
          <button key={d.k} onClick={() => setDim(d.k)} className={`rounded-lg px-3.5 py-1.5 text-[12.5px] font-semibold ${dim === d.k ? 'bg-accent-500 text-white' : 'bg-navy-100 text-navy-600 hover:bg-navy-200 dark:bg-slate-800 dark:text-slate-300'}`}>{d.label}</button>
        ))}
      </div>
      {dim === 'performance' ? <Performance selected={selected} /> : <DimView key={dim} dim={dim} selected={selected} />}
    </div>
  );
}

function DimView({ dim, selected }: { dim: ClassDim; selected: string[] }) {
  const buckets = useMemo(() => classification(selected, dim), [dim, selected]);
  const [sel, setSel] = useState(buckets[0]?.key || '');
  const [search, setSearch] = useState('');
  const active = buckets.find((b) => b.key === sel) || buckets[0];
  const activeItems = (active?.items || []).filter((m) => { if (!search) return true; const s = search.toLowerCase(); return m.description.toLowerCase().includes(s) || m.id.includes(s) || m.plant_id.toLowerCase().includes(s) || m.supplier.toLowerCase().includes(s); });
  const total = buckets.reduce((n, b) => n + b.value, 0) || 1;
  const donut = buckets.map((b, i) => ({ name: b.label, value: b.value, color: COLORS[i % COLORS.length] }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Value distribution" sub="by class">
          <div className="h-[170px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart><Pie data={donut} dataKey="value" nameKey="name" innerRadius={42} outerRadius={68} paddingAngle={2}>{donut.map((s, i) => <Cell key={i} fill={s.color} />)}</Pie><Tooltip formatter={(v) => money(Number(v))} contentStyle={tip} /></PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-1 flex flex-col gap-1">
            {buckets.map((b, i) => (
              <button key={b.key} onClick={() => setSel(b.key)} className={`flex items-center gap-2 rounded-md px-2 py-1 text-[11px] ${sel === b.key ? 'bg-accent-500/10' : 'hover:bg-navy-50 dark:hover:bg-slate-800'}`}>
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="flex-1 text-left">{b.label}</span>
                <span className="font-medium tabular-nums">{money(b.value)}</span>
                <span className="w-9 text-right text-navy-400 dark:text-slate-500">{Math.round((b.value / total) * 100)}%</span>
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="Count by class" sub="SKUs" className="lg:col-span-2">
          <div className="h-[210px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={buckets} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className={GRID} />
                <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={0} stroke="currentColor" className={AXIS} />
                <YAxis tick={{ fontSize: 10 }} stroke="currentColor" className={AXIS} />
                <Tooltip formatter={(v) => `${v} SKUs`} contentStyle={tip} />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>{buckets.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <Panel title={`${active?.label || ''} — materials`} sub={`${active?.count || 0} SKUs · ${money(active?.value || 0)}`}>
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-navy-200 bg-white px-2.5 py-1 dark:border-slate-700 dark:bg-slate-900 sm:w-64">
          <Search className="h-3.5 w-3.5 text-navy-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search this class…" className="w-full border-none bg-transparent text-[12px] outline-none placeholder:text-navy-400 dark:text-slate-200" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[12px]">
            <thead>
              <tr className="border-b border-navy-100 text-left text-[10px] uppercase tracking-wide text-navy-400 dark:border-slate-800 dark:text-slate-500">
                <th className="px-3 py-2 font-semibold">Material</th><th className="px-3 py-2 font-semibold">Plant</th>
                <th className="px-3 py-2 font-semibold">XYZ/FSN/VED</th><th className="px-3 py-2 text-right font-semibold">Cover</th>
                <th className="px-3 py-2 text-right font-semibold">Crit</th><th className="px-3 py-2 text-right font-semibold">Value</th>
              </tr>
            </thead>
            <tbody>
              {activeItems.slice(0, 25).map((m: Material) => (
                <tr key={m.id} className="border-b border-navy-50 last:border-0 dark:border-slate-800/60">
                  <td className="px-3 py-2"><div className="font-medium">{m.description}</div><div className="font-mono text-[10px] text-navy-400 dark:text-slate-500">{m.id}</div></td>
                  <td className="px-3 py-2 text-navy-500 dark:text-slate-400">{m.plant_id}</td>
                  <td className="px-3 py-2 text-navy-500 dark:text-slate-400">{m.xyz} · {m.fsn} · {m.ved}</td>
                  <td className="px-3 py-2 text-right">{m.coverage_days}d</td>
                  <td className="px-3 py-2 text-right">{m.criticality_score}</td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">{money(m.current_stock_value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function Performance({ selected }: { selected: string[] }) {
  const k = useMemo(() => plannerKpis(selected), [selected]);
  const mats = useMemo(() => MATERIALS.filter((m) => selected.includes(m.plant_id)), [selected]);
  const plants = PLANTS.filter((p) => selected.includes(p.id));
  const service = plants.length ? Math.round((plants.reduce((n, p) => n + p.service_level, 0) / plants.length) * 10) / 10 : 0;
  const turns = plantTrends(selected).slice(-1)[0].turns;
  const dio = Math.round(365 / turns);
  const totalVal = mats.reduce((n, m) => n + m.current_stock_value, 0) || 1;
  const deadVal = mats.filter((m) => m.fsn === 'Non-moving').reduce((n, m) => n + m.current_stock_value, 0);
  const obsoRate = Math.round((deadVal / totalVal) * 1000) / 10;
  const compliant = mats.filter((m) => m.coverage_days >= 20 && m.coverage_days <= 180).length;
  const policyCompliance = Math.round((compliant / Math.max(1, mats.length)) * 100);

  const cards = [
    { label: 'Service level', value: `${service}%`, pct: (service / 95) * 100, target: 'target 95%', good: service >= 92 },
    { label: 'Inventory turns', value: `${turns}×`, pct: (turns / 4) * 100, target: 'target 3×', good: turns >= 2 },
    { label: 'Days inv. outstanding', value: `${dio}d`, pct: Math.max(0, 100 - (dio / 200) * 100), target: 'lower is better', good: dio < 120 },
    { label: 'Policy compliance', value: `${policyCompliance}%`, pct: policyCompliance, target: 'coverage in-band', good: policyCompliance >= 70 },
    { label: 'Forecast accuracy', value: `${k.forecastAccuracy}%`, pct: k.forecastAccuracy, target: 'MAPE-based', good: k.forecastAccuracy >= 80 },
    { label: 'Obsolescence rate', value: `${obsoRate}%`, pct: Math.max(0, 100 - obsoRate * 3), target: 'lower is better', good: obsoRate < 15 },
  ];

  return (
    <div>
      <div className="mb-2 text-[12px] text-navy-500 dark:text-slate-400">Policy performance scorecard across your selected plants.</div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-navy-100 bg-white p-4 dark:border-slate-800 dark:bg-[#211c33]">
            <div className="flex items-baseline justify-between">
              <span className="text-[12px] font-medium text-navy-500 dark:text-slate-400">{c.label}</span>
              <span className={`text-[20px] font-semibold ${c.good ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>{c.value}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-navy-100 dark:bg-slate-800">
              <span className={`block h-full rounded-full ${c.good ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(100, Math.max(4, c.pct))}%` }} />
            </div>
            <div className="mt-1 text-[10px] text-navy-400 dark:text-slate-500">{c.target}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Panel({ title, sub, children, className }: { title: string; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-navy-100 bg-white p-4 dark:border-slate-800 dark:bg-[#211c33] ${className || ''}`}>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-2"><span className="text-[12.5px] font-semibold">{title}</span>{sub && <span className="text-[11px] text-navy-400 dark:text-slate-500">{sub}</span>}</div>
      {children}
    </div>
  );
}
