import { useMemo, useState } from 'react';
import { Truck, Clock, PackageCheck, AlertTriangle, Search } from 'lucide-react';
import { getVendors } from '../../services/inventoryApi';
import { useLiveOrMock } from './useLiveData';
import { TopProgressBar } from './LoadingBar';

const money = (n: number) => (Math.abs(n) >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : Math.abs(n) >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${Math.round(n)}`);

function Kpi({ icon: Icon, value, label, sub, tone }: { icon: typeof Truck; value: string; label: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-navy-100 bg-white p-3.5 dark:border-slate-800 dark:bg-[#211c33]">
      <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tone || 'bg-accent-500/12 text-accent-600 dark:text-accent-400'}`}><Icon className="h-4 w-4" /></span>
      <div className="mt-2.5 text-[20px] font-semibold leading-none tracking-tight">{value}</div>
      <div className="mt-1.5 text-[11px] font-medium">{label}</div>
      {sub && <div className="text-[10px] text-navy-400 dark:text-slate-500">{sub}</div>}
    </div>
  );
}

const leadTone = (d: number) => (d >= 55 ? 'text-rose-600 dark:text-rose-400' : d >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400');
const otTone = (p: number) => (p < 80 ? 'text-rose-600 dark:text-rose-400' : p < 90 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400');

export default function VendorAnalytics({ plantIds }: { plantIds: string[] }) {
  const data = useLiveOrMock<any>(() => getVendors(plantIds), null, [plantIds.join(',')]);
  const [q, setQ] = useState('');
  const s = data?.summary;
  const vendors: any[] = data?.vendors || [];
  const maxSS = useMemo(() => Math.max(1, ...vendors.map((v) => v.safety_stock_value)), [vendors]);
  const shown = vendors.filter((v) => !q || v.supplier.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="relative px-6 py-5">
      <TopProgressBar />
      <div className="mb-4">
        <h1 className="flex items-center gap-2 text-[19px] font-semibold tracking-tight"><Truck className="h-5 w-5 text-accent-500" /> Supplier &amp; lead-time analytics</h1>
        <p className="text-[12.5px] text-navy-500 dark:text-slate-500">Long, variable supplier lead times drive safety stock. See which vendors inflate working capital most — and where reliability gains would release it.</p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={PackageCheck} tone="bg-violet-500/12 text-violet-600 dark:text-violet-400" value={money(s?.safety_stock_value || 0)} label="Safety stock driven" sub="by supplier lead time" />
        <Kpi icon={Clock} value={`${Math.round(s?.avg_lead_days || 0)}d`} label="Avg lead time" sub="across suppliers" />
        <Kpi icon={AlertTriangle} tone="bg-rose-500/12 text-rose-600 dark:text-rose-400" value={String(s?.high_impact_count || 0)} label="High-impact suppliers" sub="long / variable lead" />
        <Kpi icon={Truck} value={String(s?.supplier_count || 0)} label="Suppliers" sub={s?.worst_lead_supplier ? `worst: ${s.worst_lead_supplier}` : undefined} />
      </div>

      <div className="overflow-hidden rounded-xl border border-navy-100 bg-white dark:border-slate-800 dark:bg-[#211c33]">
        <div className="flex items-center justify-between border-b border-navy-100 px-4 py-2.5 dark:border-slate-800">
          <span className="text-[12.5px] font-semibold">Suppliers <span className="text-navy-400 dark:text-slate-500">· ranked by stock they drive</span></span>
          <div className="flex items-center gap-2 rounded-lg border border-navy-200 bg-white px-2.5 py-1 dark:border-slate-700 dark:bg-slate-900">
            <Search className="h-3.5 w-3.5 text-navy-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search supplier…" className="w-44 border-none bg-transparent text-[12px] outline-none placeholder:text-navy-400 dark:text-slate-200" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-[12px]">
            <thead><tr className="border-b border-navy-100 bg-navy-50/40 text-left text-[9.5px] uppercase tracking-wide text-navy-400 dark:border-slate-800 dark:bg-slate-900/30 dark:text-slate-500">
              <th className="px-4 py-2.5 font-semibold">Supplier</th>
              <th className="px-2.5 py-2.5 text-right font-semibold">SKUs</th>
              <th className="px-2.5 py-2.5 text-right font-semibold">Avg lead</th>
              <th className="px-2.5 py-2.5 text-right font-semibold">Variability</th>
              <th className="px-2.5 py-2.5 text-right font-semibold">On-time</th>
              <th className="px-2.5 py-2.5 font-semibold">Safety stock driven</th>
              <th className="px-2.5 py-2.5 font-semibold">Flags</th>
            </tr></thead>
            <tbody>{shown.map((v) => (
              <tr key={v.supplier} className="border-b border-navy-50 last:border-0 hover:bg-navy-50/60 dark:border-slate-800/60 dark:hover:bg-slate-800/40">
                <td className="px-4 py-2.5"><div className="font-medium">{v.supplier}</div><div className="text-[10px] text-navy-400 dark:text-slate-500">{v.category_count} categories · {v.vital_count} vital</div></td>
                <td className="px-2.5 py-2.5 text-right tabular-nums">{v.sku_count}</td>
                <td className={`px-2.5 py-2.5 text-right font-medium tabular-nums ${leadTone(v.avg_lead_days)}`}>{Math.round(v.avg_lead_days)}d<div className="text-[9px] text-navy-400 dark:text-slate-500">{v.lead_min}–{v.lead_max}d</div></td>
                <td className="px-2.5 py-2.5 text-right tabular-nums">{Math.round(v.lead_variability_pct)}%</td>
                <td className={`px-2.5 py-2.5 text-right font-medium tabular-nums ${otTone(v.on_time_pct)}`}>{Math.round(v.on_time_pct)}%</td>
                <td className="px-2.5 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-navy-100 dark:bg-slate-700"><div className="h-full rounded-full bg-violet-500" style={{ width: `${(v.safety_stock_value / maxSS) * 100}%` }} /></div>
                    <span className="tabular-nums text-violet-600 dark:text-violet-400">{money(v.safety_stock_value)}</span>
                  </div>
                </td>
                <td className="px-2.5 py-2.5">
                  <div className="flex flex-wrap gap-1">{(v.flags || []).map((f: string, i: number) => (
                    <span key={i} className="rounded bg-amber-500/12 px-1.5 py-0.5 text-[9.5px] font-medium text-amber-600 dark:text-amber-400">{f}</span>
                  ))}</div>
                </td>
              </tr>
            ))}
            {vendors.length === 0 && <tr><td colSpan={7} className="px-3 py-10 text-center text-[12.5px] text-navy-500 dark:text-slate-400">No supplier data in this scope.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
