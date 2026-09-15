import { useMemo, useState } from 'react';
import { Search, List } from 'lucide-react';
import { MATERIALS } from '../../data/inventoryMock';
import type { Material } from '../../types/inventory';
import { fetchForecastSummaries } from '../../services/inventoryApi';
import { useLiveOrMock } from './useLiveData';
import SkuGrid, { statusOf } from './SkuGrid';
import MaterialAnalysis from './MaterialAnalysis';

const FILTERS: { k: string; label: string }[] = [
  { k: 'all', label: 'All' }, { k: 'reduce', label: 'Reduce excess' }, { k: 'reorder', label: 'Reorder' },
  { k: 'dispose', label: 'Dispose' }, { k: 'vital', label: 'Vital' },
];

export default function MaterialMaster({ plantIds }: { plantIds: string[] }) {
  const summaries = useLiveOrMock(() => fetchForecastSummaries(plantIds), null, [plantIds.join(',')]);
  const sumById = useMemo(() => new Map((summaries || []).map((s) => [s.material_id, s])), [summaries]);
  const [material, setMaterial] = useState<Material | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const mats = useMemo(() => {
    const q = search.toLowerCase();
    return MATERIALS.filter((m) => plantIds.includes(m.plant_id))
      .filter((m) => !q || m.description.toLowerCase().includes(q) || m.id.includes(search) || m.category.toLowerCase().includes(q) || m.supplier.toLowerCase().includes(q))
      .filter((m) => {
        if (filter === 'all') return true;
        if (filter === 'vital') return m.ved === 'Vital';
        return statusOf(m, sumById.get(m.id)).label.toLowerCase() === filter;
      })
      .sort((a, b) => b.current_stock_value - a.current_stock_value);
  }, [plantIds, search, filter, sumById]);

  if (material) return <MaterialAnalysis material={material} onBack={() => setMaterial(null)} />;

  return (
    <div className="px-6 py-5">
      <div className="mb-4">
        <h1 className="flex items-center gap-2 text-[19px] font-semibold tracking-tight"><List className="h-5 w-5 text-accent-500" /> Material master</h1>
        <p className="text-[12.5px] text-navy-500 dark:text-slate-500">Every SKU with its live forecast &amp; policy — the same metrics as the Savings Wizard. Click any material for the full 360°.</p>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-lg border border-navy-100 p-0.5 dark:border-slate-800">
          {FILTERS.map((f) => (
            <button key={f.k} onClick={() => setFilter(f.k)} className={`rounded-md px-2.5 py-1 text-[11px] font-medium ${filter === f.k ? 'bg-accent-500 text-white' : 'text-navy-600 hover:bg-navy-50 dark:text-slate-300 dark:hover:bg-white/5'}`}>{f.label}</button>
          ))}
        </div>
        <span className="text-[11px] text-navy-400 dark:text-slate-500">{mats.length} materials</span>
        <div className="ml-auto flex items-center gap-2 rounded-lg border border-navy-200 bg-white px-2.5 py-1 dark:border-slate-700 dark:bg-slate-900">
          <Search className="h-3.5 w-3.5 text-navy-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search material, category, supplier…" className="w-56 border-none bg-transparent text-[12px] outline-none placeholder:text-navy-400 dark:text-slate-200" />
        </div>
      </div>
      <SkuGrid mats={mats} sumById={sumById} onOpen={setMaterial} limit={200} />
    </div>
  );
}
