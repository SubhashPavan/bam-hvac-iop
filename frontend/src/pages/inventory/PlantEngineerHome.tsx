import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Check, Inbox, AlertTriangle, ShieldAlert, ArrowRight, Sparkles,
} from 'lucide-react';
import { MATERIALS, RECOMMENDATIONS, PLANTS, MY_PLANTS } from '../../data/inventoryMock';

const BASE = '/accelerator/inventory-optimization';
const money = (n: number) => (Math.abs(n) >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : Math.abs(n) >= 1_000 ? `$${(n / 1_000).toFixed(1)}K` : `$${n.toFixed(0)}`);
const VED_TONE: Record<string, string> = {
  Vital: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  Essential: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  Desirable: 'bg-navy-100 text-navy-500 dark:bg-slate-800 dark:text-slate-400',
};

export default function PlantEngineerHome() {
  const navigate = useNavigate();
  const myPlants = useMemo(() => PLANTS.filter((p) => MY_PLANTS.includes(p.id)), []);
  const [selected, setSelected] = useState<string[]>(MY_PLANTS);

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? (s.length > 1 ? s.filter((x) => x !== id) : s) : [...s, id]));

  const mats = useMemo(() => MATERIALS.filter((m) => selected.includes(m.plant_id)), [selected]);
  const recs = useMemo(() => RECOMMENDATIONS.filter((r) => selected.includes(r.plant_id)), [selected]);

  const inventory = mats.reduce((n, m) => n + m.current_stock_value, 0);
  const critical = mats.filter((m) => m.criticality_score > 70);
  const slow = mats.filter((m) => m.fsn === 'Slow');
  const dead = mats.filter((m) => m.fsn === 'Non-moving');

  const toReview = recs.filter((r) => r.workflow_status === 'pending' && r.type !== 'emergency_action');
  const toReviewSavings = toReview.reduce((n, r) => n + r.savings_potential, 0);
  const emergencies = recs.filter((r) => r.type === 'emergency_action');
  const emergencySplit = useMemo(() => {
    const c = new Map<string, number>();
    emergencies.forEach((r) => c.set(r.plant_id, (c.get(r.plant_id) || 0) + 1));
    return Array.from(c.entries());
  }, [emergencies]);
  const vitalAtRisk = mats.filter((m) => m.ved === 'Vital' && m.coverage_days < 15);

  const watchlist = useMemo(() => [...critical].sort((a, b) => b.criticality_score - a.criticality_score).slice(0, 6), [critical]);
  const plantName = (id: string) => PLANTS.find((p) => p.id === id)?.name || id;

  return (
    <div className="min-h-full bg-navy-50 dark:bg-[#14111f]">
      {/* Plant selector */}
      <div className="flex flex-wrap items-center gap-3 border-b border-navy-100 bg-white px-6 py-3 dark:border-slate-800 dark:bg-[#1b1730]">
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-navy-400 dark:text-slate-600">My plants</span>
        <div className="flex flex-wrap gap-1.5">
          {myPlants.map((p) => {
            const on = selected.includes(p.id);
            return (
              <button key={p.id} onClick={() => toggle(p.id)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ${on ? 'border-accent-400 bg-accent-500/10 text-accent-700 dark:border-accent-500 dark:text-accent-300' : 'border-navy-200 bg-white text-navy-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'}`}>
                {on && <Check className="h-3 w-3" />}{p.name} · {p.id}
              </button>
            );
          })}
        </div>
        <span className="ml-auto text-[11px] text-navy-400 dark:text-slate-500">{selected.length} of {myPlants.length} · {mats.length} materials</span>
      </div>

      {/* Identity + per-plant service level */}
      <div className="flex flex-wrap items-start gap-4 border-b border-navy-100 bg-white px-6 py-4 dark:border-slate-800 dark:bg-[#1b1730]">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-500/10 text-accent-600 dark:text-accent-400"><Building2 className="h-6 w-6" /></div>
        <div className="flex-1">
          <div className="text-[18px] font-semibold">{selected.length === 1 ? plantName(selected[0]) : `${selected.length} plants`} · India</div>
          <div className="text-[12px] text-navy-500 dark:text-slate-400">Viewing {selected.map(plantName).join(' + ')}</div>
        </div>
        <div className="min-w-[240px]">
          <div className="mb-1.5 text-right text-[10.5px] uppercase tracking-[0.1em] text-navy-400 dark:text-slate-500">Service level · per plant</div>
          <div className="flex flex-col gap-1.5">
            {selected.map((id) => {
              const p = PLANTS.find((x) => x.id === id)!;
              const tone = p.service_level < 90 ? 'bg-rose-500' : p.service_level < 95 ? 'bg-amber-500' : 'bg-emerald-500';
              const txt = p.service_level < 90 ? 'text-rose-600 dark:text-rose-400' : p.service_level < 95 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400';
              return (
                <div key={id} className="flex items-center gap-2">
                  <span className="w-14 text-[11px] text-navy-500 dark:text-slate-400">{p.name}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-navy-100 dark:bg-slate-800"><span className={`block h-full ${tone}`} style={{ width: `${p.service_level}%` }} /></span>
                  <span className={`w-8 text-right text-[11px] font-semibold ${txt}`}>{p.service_level}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="px-6 py-5">
        {/* Needs you today */}
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-navy-400 dark:text-slate-600">Needs you today · across {selected.length} plant{selected.length > 1 ? 's' : ''}</div>
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <ActionCard onClick={() => navigate(`${BASE}/review`)} icon={Inbox} tone="accent" value={String(toReview.length)} label="Recommendations to review" sub={`${money(toReviewSavings)} savings potential`} />
          <ActionCard onClick={() => navigate(`${BASE}/review`)} icon={AlertTriangle} tone="danger" value={String(emergencies.length)} label="Emergency actions"
            sub={emergencySplit.map(([pid, n]) => `${n} ${plantName(pid)}`).join(' · ') || 'none'} />
          <ActionCard onClick={() => navigate(`${BASE}/risk`)} icon={ShieldAlert} tone="warn" value={String(vitalAtRisk.length)} label="Vital spares at stockout risk" sub="cover under 15 days" />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Combined health */}
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-navy-400 dark:text-slate-600">Combined health</div>
            <div className="grid grid-cols-2 gap-3">
              <Kpi value={money(inventory)} label="Plant Inventory" />
              <Kpi value={String(critical.length)} label="Critical Spares · score >70" />
              <Kpi value={String(slow.length)} label={`Slow Movers · ${money(slow.reduce((n, m) => n + m.current_stock_value, 0))}`} tone="warn" />
              <Kpi value={String(dead.length)} label={`Dead Stock · ${money(dead.reduce((n, m) => n + m.current_stock_value, 0))}`} tone="danger" />
            </div>
          </div>

          {/* Critical spares list */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-navy-400 dark:text-slate-600">Critical spares</span>
              <span className="text-[11px] text-accent-600 dark:text-accent-400">all →</span>
            </div>
            <div className="space-y-1.5">
              {watchlist.map((m) => (
                <div key={m.id} className="flex items-center gap-3 rounded-lg bg-white px-3 py-2 dark:bg-[#211c33]">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-medium">{m.description}</div>
                    <div className="text-[10px] text-navy-400 dark:text-slate-500">{m.id} · <span className="text-accent-600 dark:text-accent-400">{plantName(m.plant_id)}</span></div>
                  </div>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${VED_TONE[m.ved]}`}>{m.ved}</span>
                  <div className="w-11 text-right"><div className="text-[13px] font-semibold">{m.criticality_score}</div><div className="text-[9px] text-navy-400 dark:text-slate-500">/100</div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Ask */}
      <div className="flex items-center gap-2 border-t border-navy-100 bg-white px-6 py-3 dark:border-slate-800 dark:bg-[#1b1730]">
        <Sparkles className="h-4 w-4 text-accent-500" />
        <button onClick={() => navigate(`${BASE}/ask`)} className="text-[12px] text-navy-500 hover:text-navy-800 dark:text-slate-400 dark:hover:text-slate-200">Ask about your plants — “which slow movers can I safely reduce at {plantName(selected[selected.length - 1])}?”</button>
      </div>
    </div>
  );
}

function ActionCard({ onClick, icon: Icon, tone, value, label, sub }: { onClick: () => void; icon: typeof Inbox; tone: 'accent' | 'danger' | 'warn'; value: string; label: string; sub: string }) {
  const styles = {
    accent: { card: 'border-navy-200 bg-white dark:border-slate-700 dark:bg-[#211c33]', chip: 'bg-accent-500/10 text-accent-600 dark:text-accent-400', arrow: 'text-navy-400 dark:text-slate-500', val: '', lab: '', sub: 'text-amber-600 dark:text-amber-400' },
    danger: { card: 'border-rose-300/50 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10', chip: 'bg-white text-rose-600 dark:bg-slate-900 dark:text-rose-400', arrow: 'text-rose-500', val: 'text-rose-600 dark:text-rose-400', lab: 'text-rose-700 dark:text-rose-300', sub: 'text-rose-600 dark:text-rose-400' },
    warn: { card: 'border-amber-300/50 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10', chip: 'bg-white text-amber-600 dark:bg-slate-900 dark:text-amber-400', arrow: 'text-amber-500', val: 'text-amber-700 dark:text-amber-400', lab: 'text-amber-800 dark:text-amber-300', sub: 'text-amber-600 dark:text-amber-400' },
  }[tone];
  return (
    <button onClick={onClick} className={`rounded-xl border p-4 text-left transition-all hover:shadow-md ${styles.card}`}>
      <div className="flex items-center justify-between">
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${styles.chip}`}><Icon className="h-4 w-4" /></span>
        <ArrowRight className={`h-4 w-4 ${styles.arrow}`} />
      </div>
      <div className={`mt-2 text-[24px] font-semibold ${styles.val}`}>{value}</div>
      <div className={`text-[12px] font-medium ${styles.lab}`}>{label}</div>
      <div className={`text-[11px] ${styles.sub}`}>{sub}</div>
    </button>
  );
}

function Kpi({ value, label, tone }: { value: string; label: string; tone?: 'warn' | 'danger' }) {
  const c = tone === 'warn' ? 'text-amber-600 dark:text-amber-400' : tone === 'danger' ? 'text-rose-600 dark:text-rose-400' : '';
  return (
    <div className="rounded-xl bg-white p-4 dark:bg-[#211c33]">
      <div className={`text-[20px] font-semibold ${c}`}>{value}</div>
      <div className="text-[11px] text-navy-500 dark:text-slate-400">{label}</div>
    </div>
  );
}
