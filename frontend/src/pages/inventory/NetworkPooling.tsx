import { useMemo, useState } from 'react';
import { Network, ArrowRight, Coins, Boxes, ShieldCheck, Search, Sparkles } from 'lucide-react';
import { getNetworkPooling } from '../../services/inventoryApi';
import { useLiveOrMock } from './useLiveData';
import { useRequestStore, type ActionSeed } from '../../store/requestStore';
import { TopProgressBar } from './LoadingBar';

const money = (n: number) => (Math.abs(n) >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : Math.abs(n) >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${Math.round(n)}`);
const VED_TONE: Record<string, string> = { Vital: 'bg-rose-500/15 text-rose-600 dark:text-rose-400', Essential: 'bg-amber-500/15 text-amber-600 dark:text-amber-400', Desirable: 'bg-navy-100 text-navy-500 dark:bg-slate-700 dark:text-slate-300' };

function Kpi({ icon: Icon, value, label, sub, tone }: { icon: typeof Coins; value: string; label: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-navy-100 bg-white p-3.5 dark:border-slate-800 dark:bg-[#211c33]">
      <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tone || 'bg-accent-500/12 text-accent-600 dark:text-accent-400'}`}><Icon className="h-4 w-4" /></span>
      <div className="mt-2.5 text-[21px] font-semibold leading-none tracking-tight">{value}</div>
      <div className="mt-1.5 text-[12.5px] font-medium">{label}</div>
      {sub && <div className="text-[11.5px] text-navy-400 dark:text-slate-500">{sub}</div>}
    </div>
  );
}

export default function NetworkPooling({ plantIds }: { plantIds: string[] }) {
  const data = useLiveOrMock<any>(() => getNetworkPooling(plantIds), null, [plantIds.join(',')]);
  const openAction = useRequestStore((s) => s.openAction);
  const [q, setQ] = useState('');
  const s = data?.summary;
  const moves: any[] = data?.moves || [];
  const shown = useMemo(() => {
    const t = q.toLowerCase();
    return moves.filter((m) => !t || m.part.toLowerCase().includes(t) || m.category.toLowerCase().includes(t) || m.supplier.toLowerCase().includes(t) || m.from_plant.toLowerCase().includes(t) || m.to_plant.toLowerCase().includes(t)).slice(0, 60);
  }, [moves, q]);

  return (
    <div className="relative px-6 py-5">
      <TopProgressBar />
      <div className="mb-4">
        <h1 className="flex items-center gap-2 text-[20px] font-semibold tracking-tight"><Network className="h-5 w-5 text-accent-500" /> Network stock pooling</h1>
        <p className="text-[14px] text-navy-500 dark:text-slate-500">Cover shortages from surplus already sitting elsewhere in the network — instead of buying. Each move frees capital and protects a critical part.</p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi icon={Coins} tone="bg-emerald-500/12 text-emerald-600 dark:text-emerald-400" value={money(s?.capital_freed || 0)} label="Purchases avoided" sub="capital freed" />
        <Kpi icon={ArrowRight} value={String(s?.move_count || 0)} label="Rebalance moves" sub={`${Math.round(s?.units_moved || 0)} units`} />
        <Kpi icon={ShieldCheck} tone="bg-rose-500/12 text-rose-600 dark:text-rose-400" value={String(s?.at_risk_covered || 0)} label="Shortages covered" sub="critical parts protected" />
        <Kpi icon={Network} tone="bg-violet-500/12 text-violet-600 dark:text-violet-400" value={String(s?.plants_involved || 0)} label="Plants involved" />
        <Kpi icon={Boxes} value={String(s?.families_balanced || 0)} label="Part families balanced" />
      </div>

      <div className="overflow-hidden rounded-xl border border-navy-100 bg-white dark:border-slate-800 dark:bg-[#211c33]">
        <div className="flex items-center justify-between border-b border-navy-100 px-4 py-2.5 dark:border-slate-800">
          <span className="text-[14px] font-semibold">Recommended moves <span className="text-navy-400 dark:text-slate-500">· highest value first</span></span>
          <div className="flex items-center gap-2 rounded-lg border border-navy-200 bg-white px-2.5 py-1 dark:border-slate-700 dark:bg-slate-900">
            <Search className="h-3.5 w-3.5 text-navy-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search part, plant…" className="w-48 border-none bg-transparent text-[13.5px] outline-none placeholder:text-navy-400 dark:text-slate-200" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-[13.5px]">
            <thead><tr className="border-b border-navy-100 bg-navy-50/40 text-left text-[11px] uppercase tracking-wide text-navy-400 dark:border-slate-800 dark:bg-slate-900/30 dark:text-slate-500">
              <th className="px-4 py-2.5 font-semibold">Part family</th>
              <th className="px-2.5 py-2.5 font-semibold">Move</th>
              <th className="px-2.5 py-2.5 text-right font-semibold">Units</th>
              <th className="px-2.5 py-2.5 text-right font-semibold">Avoided</th>
              <th className="px-2.5 py-2.5 font-semibold">Criticality</th>
              <th className="px-2 py-2.5"></th>
            </tr></thead>
            <tbody>{shown.map((m) => (
              <tr key={m.id} className="border-b border-navy-50 last:border-0 hover:bg-navy-50/60 dark:border-slate-800/60 dark:hover:bg-slate-800/40">
                <td className="px-4 py-2.5"><div className="font-medium">{m.part}</div><div className="text-[11.5px] text-navy-400 dark:text-slate-500">{m.category} · {m.supplier}</div></td>
                <td className="px-2.5 py-2.5">
                  <div className="flex items-center gap-1.5 text-[13px]">
                    <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[11.5px] font-medium text-emerald-600 dark:text-emerald-400">{m.from_plant_name}</span>
                    <ArrowRight className="h-3 w-3 text-navy-400" />
                    <span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-[11.5px] font-medium text-rose-600 dark:text-rose-400">{m.to_plant_name}</span>
                  </div>
                  <div className="text-[10.5px] text-navy-400 dark:text-slate-500">cover {m.from_coverage}d → {m.to_coverage}d</div>
                </td>
                <td className="px-2.5 py-2.5 text-right tabular-nums">{Math.round(m.units)}</td>
                <td className="px-2.5 py-2.5 text-right font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{money(m.value)}</td>
                <td className="px-2.5 py-2.5"><span className={`rounded px-1.5 py-0.5 text-[11.5px] font-semibold ${VED_TONE[m.to_ved] || ''}`}>{m.to_ved}</span></td>
                <td className="px-2 py-2.5 text-right">
                  <button onClick={() => openAction(m.action_seed as ActionSeed)} className="inline-flex items-center gap-1 rounded-lg bg-accent-500 px-2 py-1 text-[12px] font-semibold text-white hover:bg-accent-600"><Sparkles className="h-3 w-3" /> Rebalance</button>
                </td>
              </tr>
            ))}
            {moves.length === 0 && <tr><td colSpan={6} className="px-3 py-10 text-center text-[14px] text-navy-500 dark:text-slate-400">No pooling moves — no part family has surplus at one plant and a shortage at another in this scope.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
