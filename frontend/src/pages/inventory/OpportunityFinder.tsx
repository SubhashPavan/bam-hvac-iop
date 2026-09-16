import { useMemo, useState } from 'react';
import { TrendingDown, Ban, Layers, ArrowLeftRight, Copy, Truck, ArrowRight, Check, Search } from 'lucide-react';
import { opportunityGroups, MATERIALS, type OppGroup, type OppKind } from '../../data/inventoryMock';
import type { Material, Region } from '../../types/inventory';
import { useRequestStore, ACTION_LABEL, type ActionKind, type ActionSeed } from '../../store/requestStore';
import { useLiveOrMock } from './useLiveData';
import { getOpportunities } from '../../services/inventoryApi';

const money = (n: number) => (Math.abs(n) >= 1_000_000 ? `€${(n / 1_000_000).toFixed(2)}M` : Math.abs(n) >= 1_000 ? `€${(n / 1_000).toFixed(1)}K` : `€${Math.round(n)}`);

// Map the backend /opportunities (ML optimal-target logic) → the view's OppGroup shape.
const TYPE_TO_KEY: Record<string, string> = {
  excess_inventory: 'excess', obsolete_stock: 'obsolete', safety_stock_overstock: 'overstock',
  stock_transfer: 'transfer', duplicate_materials: 'duplicate', supplier_consolidation: 'supplier',
};
const TYPE_TO_KIND: Record<string, OppKind> = {
  excess_inventory: 'reduce_stock', obsolete_stock: 'dispose', safety_stock_overstock: 'reduce_stock',
  stock_transfer: 'transfer', duplicate_materials: 'rebalance', supplier_consolidation: 'rebalance',
};
const DESC: Record<string, string> = {
  excess: 'on-hand far above optimal', obsolete: 'no/near-zero demand · write-off',
  overstock: 'safety stock set too high', transfer: 'rebalance from a plant with excess',
  duplicate: 'consolidate near-identical SKUs', supplier: 'fewer POs · leverage spend',
};

function mapOpportunities(live: any, mock: OppGroup[]): { groups: OppGroup[]; seedById: Record<string, ActionSeed> } {
  if (!live?.groups) return { groups: mock, seedById: {} };
  const byId = new Map(MATERIALS.map((m) => [m.id, m]));
  const seedById: Record<string, ActionSeed> = {};
  const groups: OppGroup[] = [];
  for (const g of live.groups) {
    if (!g.count) continue;
    const key = TYPE_TO_KEY[g.type] ?? g.type;
    const items = (g.items || []).map((it: any) => {
      if (it.action_seed) seedById[`${key}:${it.material_id}`] = it.action_seed;
      const material: Material = byId.get(it.material_id) ?? {
        id: it.material_id, description: it.material_desc, category: it.category, supplier: '—',
        plant_id: it.plant_id, region: 'Europe' as Region, country: '—', xyz: 'Y', fsn: 'Slow',
        ved: 'Essential', criticality_score: 50, coverage_days: 0, on_hand_qty: 0, unit_cost: 0,
        current_stock_value: it.current_value, avg_monthly_demand: 0,
      };
      return { material, savings: it.savings_potential, note: it.rationale };
    });
    groups.push({
      key, label: g.label, desc: DESC[key] ?? '', actionKind: TYPE_TO_KIND[g.type] ?? 'reduce_stock',
      count: g.count, value: items.reduce((n: number, i: any) => n + i.material.current_stock_value, 0), items,
    });
  }
  return groups.length ? { groups, seedById } : { groups: mock, seedById: {} };
}

const GROUP_META: Record<string, { icon: typeof Layers; tone: string }> = {
  excess: { icon: Layers, tone: 'amber' }, obsolete: { icon: Ban, tone: 'rose' }, overstock: { icon: TrendingDown, tone: 'violet' },
  transfer: { icon: ArrowLeftRight, tone: 'accent' }, duplicate: { icon: Copy, tone: 'cyan' }, supplier: { icon: Truck, tone: 'mint' },
};
const TONE: Record<string, string> = {
  amber: 'bg-amber-500/12 text-amber-600 dark:text-amber-400', rose: 'bg-rose-500/12 text-rose-600 dark:text-rose-400',
  violet: 'bg-violet-500/12 text-violet-600 dark:text-violet-400', accent: 'bg-accent-500/12 text-accent-600 dark:text-accent-400',
  cyan: 'bg-cyan-500/12 text-cyan-600 dark:text-cyan-400', mint: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400',
};

export default function OpportunityFinder({ plantIds }: { plantIds: string[] }) {
  const mockGroups = useMemo(() => opportunityGroups(plantIds), [plantIds]);
  const live = useLiveOrMock<any>(() => getOpportunities(plantIds), null, [plantIds.join(',')]);
  const { groups, seedById } = useMemo(() => mapOpportunities(live, mockGroups), [live, mockGroups]);
  const [sel, setSel] = useState('excess');
  const [acted, setActed] = useState<Record<string, true>>({});
  const [search, setSearch] = useState('');
  const openAction = useRequestStore((s) => s.openAction);
  const group = groups.find((g) => g.key === sel) || groups[0];
  const items = group.items.filter((it) => { if (!search) return true; const s = search.toLowerCase(); return it.material.description.toLowerCase().includes(s) || it.material.id.includes(s) || it.material.plant_id.toLowerCase().includes(s); });
  const totalValue = groups.reduce((n, g) => n + g.value, 0);
  const totalCount = groups.reduce((n, g) => n + g.count, 0);
  const totalSavings = groups.reduce((n, g) => n + g.items.reduce((s, i) => s + i.savings, 0), 0);

  const act = (g: OppGroup, item: OppGroup['items'][number]) => {
    const m = item.material;
    // Prefer the backend's ML action seed (optimal target + rationale) when available.
    const seed = seedById[`${g.key}:${m.id}`];
    if (seed) {
      openAction(seed);
    } else {
      const proposed = g.actionKind === 'dispose' ? 0 : g.actionKind === 'reduce_stock' ? Math.round(m.current_stock_value * 0.6) : g.actionKind === 'rebalance' ? Math.round(m.current_stock_value * 0.85) : m.current_stock_value;
      openAction({
        materialId: m.id, materialDesc: m.description, plantId: m.plant_id,
        kind: g.actionKind as ActionKind, currentValue: m.current_stock_value, proposedValue: proposed,
        savings: item.savings, cashRelease: g.actionKind === 'dispose' ? Math.round(m.current_stock_value * 0.5) : item.savings,
        justification: `${g.label}: ${item.note}.`,
      });
    }
    setActed((s) => ({ ...s, [m.id]: true }));
  };

  return (
    <div className="px-6 py-5">
      <div className="mb-4">
        <h1 className="text-[20px] font-semibold tracking-tight">Opportunity Finder</h1>
        <p className="text-[14px] text-navy-500 dark:text-slate-500">{totalCount} opportunities · {money(totalValue)} addressable · {money(totalSavings)} potential savings</p>
      </div>

      {/* Group tiles */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        {groups.map((g) => {
          const meta = GROUP_META[g.key]; const Icon = meta.icon; const active = g.key === sel;
          return (
            <button key={g.key} onClick={() => setSel(g.key)} className={`rounded-xl border bg-white p-4 text-left transition-all hover:shadow-md dark:bg-[#211c33] ${active ? 'border-accent-400 ring-2 ring-accent-500/20 dark:border-accent-500' : 'border-navy-100 dark:border-slate-800'}`}>
              <div className="flex items-center justify-between">
                <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${TONE[meta.tone]}`}><Icon className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} /></span>
                <span className="rounded-full bg-navy-100 px-2 py-0.5 text-[11.5px] font-semibold text-navy-500 dark:bg-slate-800 dark:text-slate-400">{g.count}</span>
              </div>
              <div className="mt-2.5 text-[15px] font-semibold">{g.label}</div>
              <div className="text-[12px] text-navy-400 dark:text-slate-500">{g.desc}</div>
              <div className="mt-1.5 text-[13.5px] font-semibold text-amber-600 dark:text-amber-400">{money(g.items.reduce((s, i) => s + i.savings, 0))} savings · {money(g.value)}</div>
            </button>
          );
        })}
      </div>

      {/* Selected group items */}
      <div className="rounded-xl border border-navy-100 bg-white p-4 dark:border-slate-800 dark:bg-[#211c33]">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-[14.5px] font-semibold">{group.label}</span>
          <span className="text-[12.5px] text-navy-400 dark:text-slate-500">{group.count} opportunities · suggested action: <b>{ACTION_LABEL[group.actionKind as ActionKind]}</b></span>
          <div className="ml-auto flex items-center gap-2 rounded-lg border border-navy-200 bg-white px-2.5 py-1 dark:border-slate-700 dark:bg-slate-900">
            <Search className="h-3.5 w-3.5 text-navy-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="w-40 border-none bg-transparent text-[13.5px] outline-none placeholder:text-navy-400 dark:text-slate-200" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-[13.5px]">
            <thead>
              <tr className="border-b border-navy-100 text-left text-[11.5px] uppercase tracking-wide text-navy-400 dark:border-slate-800 dark:text-slate-500">
                <th className="px-3 py-2 font-semibold">Material</th>
                <th className="px-3 py-2 font-semibold">Plant</th>
                <th className="px-3 py-2 font-semibold">Signal</th>
                <th className="px-3 py-2 text-right font-semibold">Stock value</th>
                <th className="px-3 py-2 text-right font-semibold">Savings</th>
                <th className="px-3 py-2 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const m = it.material; const done = acted[m.id];
                return (
                  <tr key={m.id} className="border-b border-navy-50 last:border-0 hover:bg-navy-50/50 dark:border-slate-800/60 dark:hover:bg-slate-800/30">
                    <td className="px-3 py-2.5"><div className="font-medium">{m.description}</div><div className="font-mono text-[11.5px] text-navy-400 dark:text-slate-500">{m.id}</div></td>
                    <td className="px-3 py-2.5 text-navy-500 dark:text-slate-400">{m.plant_id}</td>
                    <td className="px-3 py-2.5 text-navy-500 dark:text-slate-400">{it.note}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{money(m.current_stock_value)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-amber-600 dark:text-amber-400">{money(it.savings)}</td>
                    <td className="px-3 py-2.5 text-right">
                      {done ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2.5 py-1.5 text-[12.5px] font-semibold text-emerald-600 dark:text-emerald-400"><Check className="h-3.5 w-3.5" /> Actioned</span>
                      ) : (
                        <button onClick={() => act(group, it)} className="inline-flex items-center gap-1 rounded-md bg-accent-500 px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-accent-600">Act <ArrowRight className="h-3.5 w-3.5" /></button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && <tr><td colSpan={6} className="px-3 py-10 text-center text-[14px] text-navy-500 dark:text-slate-400">{search ? 'No matches.' : 'No opportunities in this group. 👍'}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
