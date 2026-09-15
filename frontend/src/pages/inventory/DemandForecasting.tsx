import { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { Sparkles } from 'lucide-react';
import { MATERIALS, makeForecast } from '../../data/inventoryMock';

const HORIZONS = [3, 6, 12, 18, 24];
const XYZ_TONE: Record<string, string> = {
  X: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  Y: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  Z: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
};

export default function DemandForecasting({ plantIds }: { plantIds?: string[] } = {}) {
  const list = useMemo(() => MATERIALS.filter((m) => !plantIds || plantIds.includes(m.plant_id)).slice(0, 40), [plantIds]);
  const [selId, setSelId] = useState(list[0].id);
  const [horizon, setHorizon] = useState(12);
  const material = list.find((m) => m.id === selId) || list[0];
  const fc = useMemo(() => makeForecast(material, horizon), [material, horizon]);

  return (
    <div className="px-6 py-5">
      <div className="mb-4">
        <h1 className="text-[19px] font-semibold tracking-tight">Demand Forecasting</h1>
        <p className="text-[12.5px] text-navy-500 dark:text-slate-500">ML-powered · 3M to 24M horizons · Confidence intervals</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* Material picker */}
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-navy-400 dark:text-slate-500">Select Material</div>
          <div className="custom-scrollbar max-h-[560px] space-y-1.5 overflow-y-auto pr-1">
            {list.map((m) => (
              <button key={m.id} onClick={() => setSelId(m.id)}
                className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors ${m.id === selId ? 'border-accent-400 bg-accent-500/10 dark:border-accent-500' : 'border-navy-100 bg-white hover:bg-navy-50 dark:border-slate-800 dark:bg-[#211c33] dark:hover:bg-slate-800/40'}`}>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-medium">{m.description}</div>
                  <div className="font-mono text-[10px] text-navy-400 dark:text-slate-500">{m.id} · {m.plant_id}</div>
                </div>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${XYZ_TONE[m.xyz]}`}>{m.xyz}</span>
                <span className="text-[10.5px] text-navy-500 dark:text-slate-400">{m.avg_monthly_demand}/mo</span>
              </button>
            ))}
          </div>
        </div>

        {/* Forecast */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="font-mono text-[12px] text-navy-500 dark:text-slate-400">{material.id} — {material.description}</div>
              <div className="text-[11px] text-navy-400 dark:text-slate-500">{material.plant_id} · {material.category} · XYZ: {material.xyz}</div>
            </div>
            <div className="flex gap-1">
              {HORIZONS.map((h) => (
                <button key={h} onClick={() => setHorizon(h)}
                  className={`rounded-lg px-2.5 py-1 text-[11.5px] font-semibold ${horizon === h ? 'bg-accent-500 text-white' : 'bg-navy-100 text-navy-600 hover:bg-navy-200 dark:bg-slate-800 dark:text-slate-300'}`}>{h}M</button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-navy-100 bg-white p-4 dark:border-slate-800 dark:bg-[#211c33]">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[12.5px] font-semibold">Demand Forecast — {horizon}M Horizon</span>
              <span className="flex items-center gap-2 text-[11px] text-navy-500 dark:text-slate-400">Model Accuracy
                <span className="h-1.5 w-20 overflow-hidden rounded-full bg-navy-200 dark:bg-slate-700"><span className="block h-full rounded-full bg-accent-500" style={{ width: `${fc.model_accuracy}%` }} /></span>
                <span className="font-semibold text-accent-600 dark:text-accent-400">{fc.model_accuracy}%</span>
              </span>
            </div>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={fc.points} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-navy-100 dark:text-slate-800" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="currentColor" className="text-navy-400 dark:text-slate-500" />
                  <YAxis tick={{ fontSize: 10 }} stroke="currentColor" className="text-navy-400 dark:text-slate-500" />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  <Line type="monotone" dataKey="upper" stroke="#f59e0b" strokeDasharray="4 3" strokeWidth={1.2} dot={false} name="Upper CI" />
                  <Line type="monotone" dataKey="lower" stroke="#f59e0b" strokeDasharray="4 3" strokeWidth={1.2} dot={false} name="Lower CI" />
                  <Line type="monotone" dataKey="forecast" stroke="#0ea5e9" strokeWidth={2} dot={false} name="Forecast" />
                  <Line type="monotone" dataKey="actual" stroke="#10b981" strokeWidth={2} dot={false} name="Actual" connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat value={String(fc.avg_monthly_demand)} label="Avg Monthly Demand" sub="units" />
            <Stat value={`${fc.forecast_confidence}%`} label="Forecast Confidence" sub="accuracy" tone="accent" />
            <Stat value={String(fc.total_forecast_qty)} label="Total Forecast Qty" sub={`over ${horizon}M`} />
            <Stat value={fc.demand_pattern} label="Demand Pattern" sub={`XYZ-${material.xyz}`} />
          </div>

          <div className="rounded-xl bg-accent-500/5 p-3.5 dark:bg-accent-500/10">
            <div className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold text-accent-700 dark:text-accent-300"><Sparkles className="h-3.5 w-3.5" /> AI Forecast Insight</div>
            <p className="text-[12.5px] leading-relaxed text-navy-700 dark:text-slate-300">{fc.insight}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label, sub, tone }: { value: string; label: string; sub: string; tone?: 'accent' }) {
  return (
    <div className="rounded-xl border border-navy-100 bg-white p-3.5 dark:border-slate-800 dark:bg-[#211c33]">
      <div className={`text-[20px] font-semibold ${tone === 'accent' ? 'text-accent-600 dark:text-accent-400' : ''}`}>{value}</div>
      <div className="text-[11.5px] font-medium">{label}</div>
      <div className="text-[10px] text-navy-400 dark:text-slate-500">{sub}</div>
    </div>
  );
}
