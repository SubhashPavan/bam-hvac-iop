/** Mock dataset for the Inventory Optimization accelerator (lighter demo set).
 *  Deterministic (seeded) so values are stable across renders.
 *  Swapped for Databricks-gold reads later, behind these same types.
 */
import type {
  Plant,
  Material,
  Recommendation,
  Region,
  RecommendationType,
  WorkflowStatus,
  XYZ,
  FSN,
  VED,
  RiskLevel,
} from '../types/inventory';

/* ── seeded RNG ─────────────────────────────────────────────────── */
let _seed = 20260828;
function rnd(): number {
  _seed = (_seed * 1664525 + 1013904223) % 4294967296;
  return _seed / 4294967296;
}
const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
const rint = (lo: number, hi: number) => Math.floor(lo + rnd() * (hi - lo + 1));
const rfloat = (lo: number, hi: number) => lo + rnd() * (hi - lo);

/* ── reference vocab ────────────────────────────────────────────── */

export let PLANTS: Plant[] = [
  { id: 'IN-LAL-01', name: 'Lalru', region: 'India', country: 'India', material_count: 0, inventory_value: 0, service_level: 91 },
  { id: 'IN-PUN-02', name: 'Pune', region: 'India', country: 'India', material_count: 0, inventory_value: 0, service_level: 88 },
  { id: 'IN-SON-03', name: 'Sonipat', region: 'India', country: 'India', material_count: 0, inventory_value: 0, service_level: 93 },
  { id: 'NZ-AUK-01', name: 'Auckland', region: 'ANZ', country: 'New Zealand', material_count: 0, inventory_value: 0, service_level: 96 },
  { id: 'AU-MEL-02', name: 'Melbourne', region: 'ANZ', country: 'Australia', material_count: 0, inventory_value: 0, service_level: 93 },
  { id: 'AU-SYD-01', name: 'Sydney', region: 'ANZ', country: 'Australia', material_count: 0, inventory_value: 0, service_level: 92 },
  { id: 'ID-SBY-02', name: 'Surabaya', region: 'ANZ', country: 'Indonesia', material_count: 0, inventory_value: 0, service_level: 89 },
  { id: 'ID-JAK-01', name: 'Jakarta', region: 'ANZ', country: 'Indonesia', material_count: 0, inventory_value: 0, service_level: 90 },
  { id: 'US-NYC-03', name: 'New York', region: 'NORAM', country: 'USA', material_count: 0, inventory_value: 0, service_level: 97 },
  { id: 'MX-MEX-01', name: 'Mexico City', region: 'LATAM', country: 'Mexico', material_count: 0, inventory_value: 0, service_level: 88 },
  { id: 'DE-BER-02', name: 'Berlin', region: 'Europe', country: 'Germany', material_count: 0, inventory_value: 0, service_level: 95 },
  { id: 'ZA-JNB-01', name: 'Johannesburg', region: 'South Africa', country: 'South Africa', material_count: 0, inventory_value: 0, service_level: 90 },
  { id: 'ZA-CPT-02', name: 'Cape Town', region: 'South Africa', country: 'South Africa', material_count: 0, inventory_value: 0, service_level: 91 },
];

const CATEGORIES = ['Bearings', 'Electrical', 'Motors', 'Filtration', 'Valves', 'Gaskets', 'Hydraulics', 'Pneumatics', 'Mechanical Seals', 'Safety', 'Instrumentation', 'Belts & Drives', 'Pumps'];
const SUPPLIERS = ['Grundfos', 'Timken', 'NSK', 'Emerson', 'Spirent', 'Parker Hannifin', 'Siemens', 'SKF', 'Bosch Rexroth', 'Honeywell', 'ABB', 'Pall', 'Gates', 'Danfoss', 'Rexnord'];
const REGIONS: Region[] = ['Europe', 'NORAM', 'South Africa', 'India', 'ANZ', 'LATAM'];

const XYZS: XYZ[] = ['X', 'Y', 'Z'];
const FSNS: FSN[] = ['Fast', 'Slow', 'Non-moving'];
const VEDS: VED[] = ['Vital', 'Essential', 'Desirable'];

/* ── generate materials ─────────────────────────────────────────── */

function code(): string {
  return String(rint(100000000, 109999999));
}

export let MATERIALS: Material[] = PLANTS.flatMap((plant) =>
  Array.from({ length: rint(90, 120) }, () => {
  const category = pick(CATEGORIES);
  const supplier = pick(SUPPLIERS);
  const unit_cost = rfloat(20, 2400);
  const on_hand_qty = rint(1, 400);
  const current_stock_value = Math.round(unit_cost * on_hand_qty);
  return {
    id: code(),
    description: `${category} – ${supplier} ${String.fromCharCode(65 + rint(0, 25))}${rint(100, 999)}`,
    category,
    supplier,
    plant_id: plant.id,
    region: plant.region,
    country: plant.country,
    xyz: pick(XYZS),
    fsn: pick(FSNS),
    ved: pick(VEDS),
    criticality_score: rint(20, 95),
    coverage_days: rint(5, 400),
    on_hand_qty,
    unit_cost: Math.round(unit_cost * 100) / 100,
    current_stock_value,
    avg_monthly_demand: Math.round(rfloat(0.4, 40) * 10) / 10,
  };
  }),
);

/** Demo entitlement: the plants this Plant Engineer is assigned to. */
export const MY_PLANTS = ['IN-LAL-01', 'IN-PUN-02', 'IN-SON-03'];

// backfill plant rollups
for (const p of PLANTS) {
  const mats = MATERIALS.filter((m) => m.plant_id === p.id);
  p.material_count = mats.length;
  p.inventory_value = mats.reduce((n, m) => n + m.current_stock_value, 0);
}

/* ── generate recommendations from materials ────────────────────── */

const REASONING: Record<RecommendationType, (m: Material) => string> = {
  reduce_stock: () => `Demand forecasting shows ${rint(12, 34)}% decline YoY. Current safety stock exceeds ${rfloat(2, 4).toFixed(1)}× calculated requirement.`,
  dispose: (m) => `No consumption in ${rint(14, 36)} months. ${m.fsn} mover with obsolescence risk — recommend write-off.`,
  increase_stock: (m) => `Stockout risk: coverage ${m.coverage_days}d below target for a ${m.ved} item. Demand trending up ${rint(8, 25)}%.`,
  keep_unchanged: () => `Stock levels within optimal band. No action required this cycle.`,
  emergency_action: (m) => `Critical ${m.ved} spare below reorder point at a plant with service level risk. Immediate replenishment required.`,
};

const WF_STATUSES: WorkflowStatus[] = ['pending', 'eng_approved', 'maint_approved', 'finance_approved', 'implemented', 'rejected'];
const RISKS: RiskLevel[] = ['low', 'medium', 'high'];

function recTypeFor(m: Material): RecommendationType {
  if (m.fsn === 'Non-moving' && m.coverage_days > 200) return 'dispose';
  if (m.coverage_days < 20 && m.ved === 'Vital') return rnd() > 0.5 ? 'emergency_action' : 'increase_stock';
  if (m.coverage_days > 120) return 'reduce_stock';
  if (rnd() > 0.7) return 'keep_unchanged';
  return rnd() > 0.5 ? 'reduce_stock' : 'increase_stock';
}

export let RECOMMENDATIONS: Recommendation[] = MATERIALS.filter(() => rnd() > 0.25).map((m) => {
  const type = recTypeFor(m);
  let recommended_value = m.current_stock_value;
  if (type === 'reduce_stock') recommended_value = Math.round(m.current_stock_value * rfloat(0.4, 0.85));
  else if (type === 'dispose') recommended_value = 0;
  else if (type === 'increase_stock' || type === 'emergency_action') recommended_value = Math.round(m.current_stock_value * rfloat(1.15, 1.6));
  const savings_potential = Math.max(0, m.current_stock_value - recommended_value);
  return {
    id: `rec-${m.id}`,
    material_id: m.id,
    material_desc: m.description,
    category: m.category,
    plant_id: m.plant_id,
    region: m.region,
    country: m.country,
    type,
    confidence: rint(65, 96),
    current_stock_value: m.current_stock_value,
    recommended_value,
    savings_potential,
    cash_release: Math.round(savings_potential * rfloat(0.6, 0.85)),
    risk: pick(RISKS),
    ai_reasoning: REASONING[type](m),
    coverage_days: m.coverage_days,
    fsn: m.fsn,
    ved: m.ved,
    criticality_score: m.criticality_score,
    workflow_status: type === 'keep_unchanged' ? 'pending' : pick(WF_STATUSES),
  };
});

/**
 * Replace the base dataset with live backend data (seeded gold or ingested).
 * All derived helpers read these module bindings, so every view goes live at
 * once. Called from the accelerator root; falls back to the seeded mock on
 * failure (arrays keep their initial values). Only non-empty arrays replace.
 */
export function hydrateInventory(data: { plants?: Plant[]; materials?: Material[]; recommendations?: Recommendation[] }) {
  if (data.materials?.length) MATERIALS = data.materials;
  if (data.recommendations?.length) RECOMMENDATIONS = data.recommendations;
  if (data.plants?.length) {
    PLANTS = data.plants;
    for (const p of PLANTS) {
      if (!p.material_count) {
        const mats = MATERIALS.filter((m) => m.plant_id === p.id);
        p.material_count = mats.length;
        p.inventory_value = mats.reduce((n, m) => n + m.current_stock_value, 0);
      }
    }
  }
}

/* ── summary aggregates ─────────────────────────────────────────── */

export function recSummary(recs: Recommendation[]) {
  const byType = (t: RecommendationType) => recs.filter((r) => r.type === t);
  const sum = (rs: Recommendation[]) => rs.reduce((n, r) => n + r.savings_potential, 0);
  const totalSavings = sum(recs);
  return {
    total: recs.length,
    totalSavings,
    emergency: byType('emergency_action').length,
    disposal: byType('dispose').length,
    types: {
      reduce_stock: { count: byType('reduce_stock').length, potential: sum(byType('reduce_stock')) },
      dispose: { count: byType('dispose').length, potential: sum(byType('dispose')) },
      increase_stock: { count: byType('increase_stock').length, potential: sum(byType('increase_stock')) },
      emergency_action: { count: byType('emergency_action').length, potential: sum(byType('emergency_action')) },
    },
  };
}

/* ── forecast series (Demand Forecasting screen) ────────────────── */

export interface ForecastPoint { label: string; actual: number | null; forecast: number; lower: number; upper: number }
export interface ForecastResult {
  material: Material;
  horizonM: number;
  model_accuracy: number;
  avg_monthly_demand: number;
  forecast_confidence: number;
  total_forecast_qty: number;
  demand_pattern: string;
  points: ForecastPoint[];
  insight: string;
}

// Deterministic per material+horizon (hash the id so it's stable without reseeding global rng).
function hash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }

export function makeForecast(material: Material, horizonM: number): ForecastResult {
  const base = material.avg_monthly_demand;
  const seed = hash(material.id + horizonM);
  const variability = material.xyz === 'X' ? 0.08 : material.xyz === 'Y' ? 0.19 : 0.34;
  const points: ForecastPoint[] = [];
  const historyM = 6;
  for (let i = -historyM; i <= horizonM; i++) {
    const season = 1 + 0.25 * Math.sin((i + seed * 12) / 2.2);
    const drift = 1 + (i / (horizonM + historyM)) * (seed > 0.5 ? -0.28 : 0.18);
    const val = Math.max(0, base * season * drift);
    const isHistory = i <= 0;
    const band = val * variability;
    points.push({
      label: i <= 0 ? `M${i}` : `M+${i}`,
      actual: isHistory ? Math.round(val * 10) / 10 : null,
      forecast: Math.round(val * 10) / 10,
      lower: Math.round(Math.max(0, val - band) * 10) / 10,
      upper: Math.round((val + band) * 10) / 10,
    });
  }
  const model_accuracy = Math.round((0.95 - variability) * 100);
  const total = points.filter((p) => p.actual === null).reduce((n, p) => n + p.forecast, 0);
  return {
    material, horizonM,
    model_accuracy,
    avg_monthly_demand: Math.round(base * 10) / 10,
    forecast_confidence: model_accuracy,
    total_forecast_qty: Math.round(total),
    demand_pattern: material.xyz === 'X' ? 'Stable' : material.xyz === 'Y' ? 'Variable' : 'Erratic',
    points,
    insight: `${material.xyz === 'X' ? 'Low' : material.xyz === 'Y' ? 'Moderate' : 'High'} demand variability (${material.xyz}-class) detected. Seasonal patterns visible. The ${horizonM}M forecast carries ±${Math.round(variability * 100)}% uncertainty — recommend reviewing safety stock levels quarterly.`,
  };
}

/* ── regional finance rollup (Finance View screen) ──────────────── */

export interface RegionFinance { region: Region; total_inventory: number; savings: number; wc_release: number; cash_benefit: number; roi: number; priority: 'High' | 'Medium' | 'Low' }

export function regionalFinance(): RegionFinance[] {
  return REGIONS.map((region) => {
    const mats = MATERIALS.filter((m) => m.region === region);
    const recs = RECOMMENDATIONS.filter((r) => r.region === region);
    const total_inventory = mats.reduce((n, m) => n + m.current_stock_value, 0);
    const savings = recs.reduce((n, r) => n + r.savings_potential, 0);
    const wc_release = Math.round(savings * 0.72);
    const cash_benefit = Math.round(wc_release * 0.83);
    const roi = Math.round((savings / Math.max(1, total_inventory)) * 100 * 10) / 10 + 8;
    const priority: RegionFinance['priority'] = savings > total_inventory * 0.15 ? 'High' : savings > total_inventory * 0.08 ? 'Medium' : 'Low';
    return { region, total_inventory, savings, wc_release, cash_benefit, roi: Math.round(roi * 10) / 10, priority };
  }).sort((a, b) => b.savings - a.savings);
}

export function financeTotals() {
  const rf = regionalFinance();
  return {
    wc_release: rf.reduce((n, r) => n + r.wc_release, 0),
    savings: rf.reduce((n, r) => n + r.savings, 0),
    roi: 4.2,
    npv: Math.round(rf.reduce((n, r) => n + r.cash_benefit, 0) * 1.6),
    regions: rf,
  };
}

/* ── Deep dashboard series (Plant Engineer dashboard) ───────────────
 *  All deterministic & plant-scoped. Swapped for Databricks-gold time
 *  series later, behind these same types.
 */
const TREND_MONTHS = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
// 24 trailing month labels (for the time-period drill: 3M / 6M / 12M / 24M).
const TREND_MONTHS_24 = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];

export interface TrendPoint { month: string; inventory: number; service: number; turns: number; deadPct: number; coverage: number; holdingCost: number }
export function plantTrends(plantIds: string[], months = 12): TrendPoint[] {
  const n = Math.min(24, Math.max(3, months));
  const mats = MATERIALS.filter((m) => plantIds.includes(m.plant_id));
  const curInv = mats.reduce((s, m) => s + m.current_stock_value, 0);
  const plants = PLANTS.filter((p) => plantIds.includes(p.id));
  const curService = plants.length ? plants.reduce((s, p) => s + p.service_level, 0) / plants.length : 90;
  const seed = hash(plantIds.join(',') + 'trend');
  const labels = TREND_MONTHS_24.slice(24 - n);
  return labels.map((month, i) => {
    const t = i / (n - 1); // 0 (oldest) → 1 (current)
    const season = 1 + 0.045 * Math.sin((i + seed * 10) / 1.7);
    const inventory = Math.round(curInv * (1.16 - 0.16 * t) * season);
    const service = Math.round((curService - 5.5 + 5.5 * t) * 10) / 10;
    const turns = Math.round((2.2 + 1.4 * t) * 10) / 10;
    const deadPct = Math.round((21 - 7.5 * t) * (1 + 0.03 * Math.sin(i + seed * 7)) * 10) / 10;
    const coverage = Math.round(96 - 22 * t);
    const holdingCost = Math.round((inventory * 0.20) / 12);
    return { month, inventory, service, turns, deadPct, coverage, holdingCost };
  });
}

export interface MixPoint { month: string; fast: number; slow: number; nonMoving: number }
export function stockMixTrend(plantIds: string[]): MixPoint[] {
  const mats = MATERIALS.filter((m) => plantIds.includes(m.plant_id));
  const val = (f: FSN) => mats.filter((m) => m.fsn === f).reduce((n, m) => n + m.current_stock_value, 0);
  const fastV = val('Fast'), slowV = val('Slow'), deadV = val('Non-moving');
  const seed = hash(plantIds.join(',') + 'mix');
  return TREND_MONTHS.map((month, i) => {
    const t = i / 11;
    const wig = 1 + 0.03 * Math.sin(i + seed * 9);
    return {
      month,
      fast: Math.round(fastV * (0.82 + 0.18 * t) * wig),
      slow: Math.round(slowV * (1.12 - 0.12 * t) * wig),
      nonMoving: Math.round(deadV * (1.35 - 0.35 * t) * wig),
    };
  });
}

export interface FunnelType { type: RecommendationType; identified: number; utilized: number }
export interface SavingsFunnel {
  identified: number; approved: number; implemented: number; utilizationPct: number;
  cashReleased: number; backlogValue: number; backlogCount: number;
  byType: FunnelType[];
  realization: { month: string; identified: number; realized: number }[];
}
export function savingsFunnel(recs: Recommendation[]): SavingsFunnel {
  const sum = (rs: Recommendation[]) => rs.reduce((n, r) => n + r.savings_potential, 0);
  const approvedRecs = recs.filter((r) => r.workflow_status !== 'pending' && r.workflow_status !== 'rejected');
  const implementedRecs = recs.filter((r) => r.workflow_status === 'finance_approved' || r.workflow_status === 'implemented');
  const pendingRecs = recs.filter((r) => r.workflow_status === 'pending');
  const identified = sum(recs), approved = sum(approvedRecs), implemented = sum(implementedRecs);
  const types: RecommendationType[] = ['reduce_stock', 'dispose', 'increase_stock', 'emergency_action'];
  const byType = types.map((type) => ({
    type,
    identified: sum(recs.filter((r) => r.type === type)),
    utilized: sum(implementedRecs.filter((r) => r.type === type)),
  }));
  const realization = TREND_MONTHS.map((month, i) => {
    const t = (i + 1) / 12;
    return { month, identified: Math.round(identified * t), realized: Math.round(implemented * Math.pow(t, 1.4)) };
  });
  return {
    identified, approved, implemented,
    utilizationPct: identified ? Math.round((implemented / identified) * 100) : 0,
    cashReleased: implementedRecs.reduce((n, r) => n + r.cash_release, 0),
    backlogValue: sum(pendingRecs), backlogCount: pendingRecs.length,
    byType, realization,
  };
}

export interface CostBreakdown {
  inventoryValue: number; annualHolding: number; carryingPct: number; obsolescenceReserve: number;
  byCategory: { category: string; value: number; holding: number }[];
  bySupplier: { supplier: string; value: number }[];
  tiedUp: { excess: number; slow: number; dead: number };
  holdingTrend: { month: string; holding: number }[];
  outliers: Material[];
}
export function costBreakdown(plantIds: string[]): CostBreakdown {
  const mats = MATERIALS.filter((m) => plantIds.includes(m.plant_id));
  const inventoryValue = mats.reduce((n, m) => n + m.current_stock_value, 0);
  const carryingPct = 20;
  const deadV = mats.filter((m) => m.fsn === 'Non-moving').reduce((n, m) => n + m.current_stock_value, 0);
  const slowV = mats.filter((m) => m.fsn === 'Slow').reduce((n, m) => n + m.current_stock_value, 0);
  const excessV = mats.filter((m) => m.coverage_days > 180 && m.fsn !== 'Fast').reduce((n, m) => n + m.current_stock_value, 0);
  const catMap = new Map<string, number>();
  mats.forEach((m) => catMap.set(m.category, (catMap.get(m.category) || 0) + m.current_stock_value));
  const supMap = new Map<string, number>();
  mats.forEach((m) => supMap.set(m.supplier, (supMap.get(m.supplier) || 0) + m.current_stock_value));
  return {
    inventoryValue,
    annualHolding: Math.round((inventoryValue * carryingPct) / 100),
    carryingPct,
    obsolescenceReserve: Math.round(deadV * 0.5),
    byCategory: Array.from(catMap, ([category, value]) => ({ category, value, holding: Math.round(value * 0.2) })).sort((a, b) => b.value - a.value).slice(0, 8),
    bySupplier: Array.from(supMap, ([supplier, value]) => ({ supplier, value })).sort((a, b) => b.value - a.value).slice(0, 7),
    tiedUp: { excess: excessV, slow: slowV, dead: deadV },
    holdingTrend: plantTrends(plantIds).map((p) => ({ month: p.month, holding: p.holdingCost })),
    outliers: [...mats].sort((a, b) => b.current_stock_value - a.current_stock_value).slice(0, 8),
  };
}

export interface DemandOutlook {
  totalForecastQty: number; modelAccuracy: number; growthCount: number; declineCount: number;
  xyzMix: { x: number; y: number; z: number };
  aggregate: ForecastPoint[];
  movers: { material: Material; changePct: number }[];
}
export function demandOutlook(plantIds: string[]): DemandOutlook {
  const mats = MATERIALS.filter((m) => plantIds.includes(m.plant_id));
  const totalDemand = mats.reduce((n, m) => n + m.avg_monthly_demand, 0);
  const xyzMix = { x: mats.filter((m) => m.xyz === 'X').length, y: mats.filter((m) => m.xyz === 'Y').length, z: mats.filter((m) => m.xyz === 'Z').length };
  const zShare = mats.length ? xyzMix.z / mats.length : 0.33;
  const variability = 0.08 + zShare * 0.3;
  const seed = hash(plantIds.join(',') + 'demand');
  const aggregate: ForecastPoint[] = [];
  const historyM = 6, horizonM = 12;
  for (let i = -historyM; i <= horizonM; i++) {
    const season = 1 + 0.14 * Math.sin((i + seed * 12) / 2.4);
    const drift = 1 + (i / (horizonM + historyM)) * 0.12;
    const val = Math.max(0, totalDemand * season * drift);
    const band = val * variability;
    aggregate.push({ label: i <= 0 ? `M${i}` : `M+${i}`, actual: i <= 0 ? Math.round(val) : null, forecast: Math.round(val), lower: Math.round(Math.max(0, val - band)), upper: Math.round(val + band) });
  }
  const scored = mats.map((m) => ({ material: m, changePct: Math.round((hash(m.id + 'mv') - 0.5) * 80) }));
  return {
    totalForecastQty: Math.round(aggregate.filter((p) => p.actual === null).reduce((n, p) => n + p.forecast, 0)),
    modelAccuracy: Math.round((0.95 - variability) * 100),
    growthCount: scored.filter((s) => s.changePct > 0).length,
    declineCount: scored.filter((s) => s.changePct < 0).length,
    xyzMix,
    aggregate,
    movers: [...scored].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)).slice(0, 8).sort((a, b) => b.changePct - a.changePct),
  };
}

/* ── Reliability cockpit (Plant Engineer command center) ────────── */

export interface HealthScore { score: number; grade: string; components: { label: string; value: number }[]; trend: { month: string; score: number }[] }
export function healthScore(plantIds: string[]): HealthScore {
  const mats = MATERIALS.filter((m) => plantIds.includes(m.plant_id));
  const plants = PLANTS.filter((p) => plantIds.includes(p.id));
  const service = plants.length ? plants.reduce((n, p) => n + p.service_level, 0) / plants.length : 90;
  const vital = mats.filter((m) => m.ved === 'Vital');
  const vitalRisk = vital.filter((m) => m.coverage_days < 15).length;
  const availability = vital.length ? 100 - (vitalRisk / vital.length) * 100 : 100;
  const t = plantTrends(plantIds); const last = t[t.length - 1];
  const serviceScore = Math.min(100, (service / 95) * 100);
  const turnsScore = Math.min(100, (last.turns / 4) * 100);
  const obsoScore = Math.max(0, 100 - last.deadPct * 3);
  const score = Math.round(serviceScore * 0.35 + availability * 0.30 + turnsScore * 0.15 + obsoScore * 0.20);
  const grade = score >= 85 ? 'Excellent' : score >= 70 ? 'Healthy' : score >= 55 ? 'Watch' : 'At risk';
  const components = [
    { label: 'Service', value: Math.round(serviceScore) },
    { label: 'Availability', value: Math.round(availability) },
    { label: 'Turns', value: Math.round(turnsScore) },
    { label: 'Obsolescence', value: Math.round(obsoScore) },
  ];
  const trend = t.map((p, i, arr) => {
    const ss = Math.min(100, (p.service / 95) * 100);
    const ts = Math.min(100, (p.turns / 4) * 100);
    const os = Math.max(0, 100 - p.deadPct * 3);
    const av = Math.max(0, availability - (arr.length - 1 - i) * 1.6);
    return { month: p.month, score: Math.round(ss * 0.35 + av * 0.30 + ts * 0.15 + os * 0.20) };
  });
  return { score, grade, components, trend };
}

export interface MatrixCell { ved: VED; fsn: FSN; value: number; count: number }
export function vedFsnMatrix(plantIds: string[]): MatrixCell[] {
  const mats = MATERIALS.filter((m) => plantIds.includes(m.plant_id));
  const cells: MatrixCell[] = [];
  (['Vital', 'Essential', 'Desirable'] as VED[]).forEach((ved) => {
    (['Fast', 'Slow', 'Non-moving'] as FSN[]).forEach((fsn) => {
      const sub = mats.filter((m) => m.ved === ved && m.fsn === fsn);
      cells.push({ ved, fsn, value: sub.reduce((n, m) => n + m.current_stock_value, 0), count: sub.length });
    });
  });
  return cells;
}

export interface AvailabilityRisk {
  vitalCount: number; atRiskCount: number; atRiskValue: number; safetyBreaches: number;
  coverageBuckets: { bucket: string; count: number }[];
  atRisk: Material[];
  leadTimeExposure: { supplier: string; value: number; count: number }[];
}
export function availabilityRisk(plantIds: string[]): AvailabilityRisk {
  const mats = MATERIALS.filter((m) => plantIds.includes(m.plant_id));
  const vital = mats.filter((m) => m.ved === 'Vital' || m.ved === 'Essential');
  const atRisk = vital.filter((m) => m.coverage_days < 25).sort((a, b) => a.coverage_days - b.coverage_days);
  const supMap = new Map<string, { value: number; count: number }>();
  vital.forEach((m) => { const e = supMap.get(m.supplier) || { value: 0, count: 0 }; e.value += m.current_stock_value; e.count++; supMap.set(m.supplier, e); });
  return {
    vitalCount: vital.length,
    atRiskCount: atRisk.length,
    atRiskValue: atRisk.reduce((n, m) => n + m.current_stock_value, 0),
    safetyBreaches: mats.filter((m) => m.coverage_days < 15).length,
    coverageBuckets: [
      { bucket: '<10d', count: mats.filter((m) => m.coverage_days < 10).length },
      { bucket: '10–25d', count: mats.filter((m) => m.coverage_days >= 10 && m.coverage_days < 25).length },
      { bucket: '25–60d', count: mats.filter((m) => m.coverage_days >= 25 && m.coverage_days < 60).length },
      { bucket: '60–120d', count: mats.filter((m) => m.coverage_days >= 60 && m.coverage_days < 120).length },
      { bucket: '>120d', count: mats.filter((m) => m.coverage_days >= 120).length },
    ],
    atRisk: atRisk.slice(0, 10),
    leadTimeExposure: Array.from(supMap, ([supplier, e]) => ({ supplier, ...e })).sort((a, b) => b.value - a.value).slice(0, 6),
  };
}

export interface PlantMetric { id: string; name: string; service: number; inventory: number; turns: number; deadPct: number; health: number }
export function plantBenchmark(plantIds: string[]): PlantMetric[] {
  return plantIds.map((id) => {
    const p = PLANTS.find((x) => x.id === id)!;
    const inventory = MATERIALS.filter((m) => m.plant_id === id).reduce((n, m) => n + m.current_stock_value, 0);
    const t = plantTrends([id]); const last = t[t.length - 1];
    return { id, name: p.name, service: p.service_level, inventory, turns: last.turns, deadPct: last.deadPct, health: healthScore([id]).score };
  });
}

export function abcMix(plantIds: string[]): { cls: string; count: number; value: number }[] {
  const mats = [...MATERIALS.filter((m) => plantIds.includes(m.plant_id))].sort((a, b) => b.current_stock_value - a.current_stock_value);
  const total = mats.reduce((n, m) => n + m.current_stock_value, 0) || 1;
  const out: Record<string, { count: number; value: number }> = { A: { count: 0, value: 0 }, B: { count: 0, value: 0 }, C: { count: 0, value: 0 } };
  let cum = 0;
  mats.forEach((m) => { cum += m.current_stock_value; const p = cum / total; const cls = p <= 0.7 ? 'A' : p <= 0.9 ? 'B' : 'C'; out[cls].count++; out[cls].value += m.current_stock_value; });
  return [{ cls: 'A', ...out.A }, { cls: 'B', ...out.B }, { cls: 'C', ...out.C }];
}

/* ── Maintenance-planner cockpit helpers ───────────────────────────
 *  Grounded in MRO practice: fill rate, turns (2-3/yr benchmark), stockout
 *  rate, emergency %, ABC×XYZ classification, intermittent (Croston/SBA)
 *  demand, and service↔investment policy simulation. Deterministic; swap
 *  for Databricks-gold later behind these types.
 */
export interface PlannerKpis {
  fillRate: number; turns: number; stockoutRate: number; emergencyPct: number;
  downtimeHrs: number; carryingCostPct: number; inventoryAccuracy: number; forecastAccuracy: number;
}
export function plannerKpis(plantIds: string[]): PlannerKpis {
  const mats = MATERIALS.filter((m) => plantIds.includes(m.plant_id));
  const plants = PLANTS.filter((p) => plantIds.includes(p.id));
  const service = plants.length ? plants.reduce((n, p) => n + p.service_level, 0) / plants.length : 90;
  const t = plantTrends(plantIds).slice(-1)[0];
  const stockouts = mats.filter((m) => m.coverage_days < 10).length;
  const seed = hash(plantIds.join(',') + 'kpi');
  return {
    fillRate: Math.round(service * 10) / 10,
    turns: t.turns,
    stockoutRate: Math.round((stockouts / Math.max(1, mats.length)) * 1000) / 10,
    emergencyPct: Math.round((6 + seed * 6) * 10) / 10,
    downtimeHrs: Math.round(8 + seed * 30),
    carryingCostPct: 20,
    inventoryAccuracy: Math.round((94 + seed * 4) * 10) / 10,
    forecastAccuracy: Math.round(82 + seed * 12),
  };
}

export interface ClassCell { row: string; col: string; value: number; count: number }
export function abcXyzMatrix(plantIds: string[]): ClassCell[] {
  const mats = [...MATERIALS.filter((m) => plantIds.includes(m.plant_id))].sort((a, b) => b.current_stock_value - a.current_stock_value);
  const total = mats.reduce((n, m) => n + m.current_stock_value, 0) || 1;
  let cum = 0;
  const abcOf = new Map<string, string>();
  mats.forEach((m) => { cum += m.current_stock_value; const p = cum / total; abcOf.set(m.id, p <= 0.7 ? 'A' : p <= 0.9 ? 'B' : 'C'); });
  const cells: ClassCell[] = [];
  (['A', 'B', 'C'] as const).forEach((abc) => {
    (['X', 'Y', 'Z'] as const).forEach((xyz) => {
      const sub = mats.filter((m) => abcOf.get(m.id) === abc && m.xyz === xyz);
      cells.push({ row: abc, col: xyz, value: sub.reduce((n, m) => n + m.current_stock_value, 0), count: sub.length });
    });
  });
  return cells;
}

/** Class-level demand pattern (aggregated per category) for the forecasting tab. */
export interface ClassDemand { category: string; avgDemand: number; trendPct: number; accuracy: number; xyz: string; intermittent: boolean }
export function demandByClass(plantIds: string[]): ClassDemand[] {
  const mats = MATERIALS.filter((m) => plantIds.includes(m.plant_id));
  const cats = new Map<string, Material[]>();
  mats.forEach((m) => { const a = cats.get(m.category) || []; a.push(m); cats.set(m.category, a); });
  return Array.from(cats, ([category, list]) => {
    const avgDemand = Math.round(list.reduce((n, m) => n + m.avg_monthly_demand, 0));
    const zShare = list.filter((m) => m.xyz === 'Z').length / list.length;
    const seed = hash(category + plantIds.join(','));
    return {
      category,
      avgDemand,
      trendPct: Math.round((seed - 0.5) * 44),
      accuracy: Math.round(95 - zShare * 28 - seed * 4),
      xyz: zShare > 0.45 ? 'Z' : zShare > 0.28 ? 'Y' : 'X',
      intermittent: zShare > 0.4,
    };
  }).sort((a, b) => b.avgDemand - a.avgDemand);
}

/** Items flagged for the forecasting tab (exceptions: forecast vs cover). */
export function forecastItems(plantIds: string[]): (Material & { fcAccuracy: number; trendPct: number; method: string; understocked: boolean })[] {
  const mats = MATERIALS.filter((m) => plantIds.includes(m.plant_id));
  return mats.map((m) => {
    const seed = hash(m.id + 'fc');
    const variability = m.xyz === 'X' ? 0.08 : m.xyz === 'Y' ? 0.19 : 0.34;
    return {
      ...m,
      fcAccuracy: Math.round((0.95 - variability) * 100 - seed * 3),
      trendPct: Math.round((seed - 0.5) * 70),
      method: m.xyz === 'Z' ? 'Croston / SBA' : m.xyz === 'Y' ? 'Holt-Winters' : 'Exp. smoothing',
      understocked: m.coverage_days < 30 && (m.ved === 'Vital' || m.ved === 'Essential'),
    };
  }).sort((a, b) => Number(b.understocked) - Number(a.understocked) || b.avg_monthly_demand - a.avg_monthly_demand);
}

/** Service-level ↔ inventory-investment tradeoff curve (diminishing returns). */
export interface TradeoffPoint { service: number; investment: number }
export function tradeoffCurve(plantIds: string[]): { curve: TradeoffPoint[]; currentService: number; baseInvestment: number } {
  const mats = MATERIALS.filter((m) => plantIds.includes(m.plant_id));
  const baseInvestment = mats.reduce((n, m) => n + m.current_stock_value, 0);
  const plants = PLANTS.filter((p) => plantIds.includes(p.id));
  const currentService = Math.round(plants.length ? plants.reduce((n, p) => n + p.service_level, 0) / plants.length : 90);
  // investment scales with safety stock ~ inverse of (1 - service); normalized so current service = baseInvestment.
  const factor = (s: number) => 1 / (1 - Math.min(0.985, s / 100));
  const cf = factor(currentService);
  const curve: TradeoffPoint[] = [];
  for (let s = 80; s <= 99; s += 1) curve.push({ service: s, investment: Math.round((baseInvestment * factor(s)) / cf) });
  return { curve, currentService, baseInvestment };
}

/** Simulate a target service level → required investment, safety-stock delta, stockout risk. */
export function simulateService(plantIds: string[], targetService: number): { investment: number; deltaPct: number; stockoutRisk: number } {
  const { curve, baseInvestment } = tradeoffCurve(plantIds);
  const pt = curve.reduce((a, b) => (Math.abs(b.service - targetService) < Math.abs(a.service - targetService) ? b : a), curve[0]);
  return {
    investment: pt.investment,
    deltaPct: Math.round(((pt.investment - baseInvestment) / baseInvestment) * 1000) / 10,
    stockoutRisk: Math.max(0, Math.round((100 - targetService) * 1.4 * 10) / 10),
  };
}

/** Deep 360° insight for a single material — for the Materials drill-down. */
export interface MaterialInsights {
  usageTrend: { month: string; used: number }[];
  crossPlant: { plantId: string; plantName: string; coverage: number; stockValue: number; avgDemand: number; onHand: number }[];
  duplicates: Material[];
  opportunity: { label: string; kind: 'reduce_stock' | 'dispose' | 'increase_stock' | 'expedite' | 'transfer'; savings: number; note: string } | null;
  transferSavings: number;
}
export function materialInsights(m: Material): MaterialInsights {
  const seed = hash(m.id + 'usage');
  const usageTrend = TREND_MONTHS.map((month, i) => {
    const v = m.avg_monthly_demand * (1 + 0.35 * Math.sin((i + seed * 8) / 1.6)) * (0.75 + 0.5 * hash(m.id + i));
    return { month, used: Math.max(0, Math.round(v)) };
  });
  const cross = MATERIALS.filter((x) => x.category === m.category && x.supplier === m.supplier && x.id !== m.id)
    .sort((a, b) => b.current_stock_value - a.current_stock_value);
  const crossPlant = cross.slice(0, 8).map((x) => ({
    plantId: x.plant_id, plantName: PLANTS.find((p) => p.id === x.plant_id)?.name || x.plant_id,
    coverage: x.coverage_days, stockValue: x.current_stock_value, avgDemand: x.avg_monthly_demand, onHand: x.on_hand_qty,
  }));
  // Transfer opportunity: if this material is short, is there excess of the same item elsewhere?
  const excessElsewhere = cross.filter((x) => x.coverage_days > 120);
  const transferSavings = (m.coverage_days < 25 && excessElsewhere.length) ? Math.round(m.avg_monthly_demand * m.unit_cost * 1.2) : 0;

  let opportunity: MaterialInsights['opportunity'] = null;
  if (m.fsn === 'Non-moving') opportunity = { label: 'Obsolete stock', kind: 'dispose', savings: Math.round(m.current_stock_value * 0.5), note: 'Non-moving — dispose / write-off' };
  else if (m.coverage_days > 180) opportunity = { label: 'Excess inventory', kind: 'reduce_stock', savings: Math.round(m.current_stock_value * 0.4), note: `${m.coverage_days}d cover — reduce reorder level` };
  else if ((m.ved === 'Vital' || m.ved === 'Essential') && m.coverage_days < 20) opportunity = { label: transferSavings ? 'Stock transfer' : 'Understock', kind: transferSavings ? 'transfer' : 'expedite', savings: transferSavings || Math.round(m.avg_monthly_demand * m.unit_cost * 1.2), note: transferSavings ? 'Cover from a plant with excess of this item' : `${m.coverage_days}d cover on a ${m.ved} spare — expedite` };
  else if (cross.length >= 1) opportunity = { label: 'Duplicate material', kind: 'reduce_stock', savings: Math.round(m.current_stock_value * 0.15), note: `${cross.length} near-identical ${m.category} SKUs from ${m.supplier}` };

  return { usageTrend, crossPlant, duplicates: cross.slice(0, 6), opportunity, transferSavings };
}

/** Classification breakdown by dimension (ABC / XYZ / FSN / VED / criticality). */
export type ClassDim = 'abc' | 'xyz' | 'fsn' | 'ved' | 'criticality';
export interface ClassBucket { key: string; label: string; count: number; value: number; items: Material[] }
export function classification(plantIds: string[], dim: ClassDim): ClassBucket[] {
  const mats = MATERIALS.filter((m) => plantIds.includes(m.plant_id));
  const make = (order: string[], labels: Record<string, string>, keyOf: (m: Material) => string): ClassBucket[] =>
    order.map((key) => {
      const items = mats.filter((m) => keyOf(m) === key).sort((a, b) => b.current_stock_value - a.current_stock_value);
      return { key, label: labels[key], count: items.length, value: items.reduce((n, m) => n + m.current_stock_value, 0), items };
    });

  if (dim === 'abc') {
    const sorted = [...mats].sort((a, b) => b.current_stock_value - a.current_stock_value);
    const total = sorted.reduce((n, m) => n + m.current_stock_value, 0) || 1;
    let cum = 0; const abcOf = new Map<string, string>();
    sorted.forEach((m) => { cum += m.current_stock_value; const p = cum / total; abcOf.set(m.id, p <= 0.7 ? 'A' : p <= 0.9 ? 'B' : 'C'); });
    return make(['A', 'B', 'C'], { A: 'A · top 70% value', B: 'B · next 20%', C: 'C · last 10%' }, (m) => abcOf.get(m.id)!);
  }
  if (dim === 'xyz') return make(['X', 'Y', 'Z'], { X: 'X · stable', Y: 'Y · variable', Z: 'Z · erratic' }, (m) => m.xyz);
  if (dim === 'fsn') return make(['Fast', 'Slow', 'Non-moving'], { Fast: 'Fast-moving', Slow: 'Slow-moving', 'Non-moving': 'Non-moving' }, (m) => m.fsn);
  if (dim === 'ved') return make(['Vital', 'Essential', 'Desirable'], { Vital: 'Vital', Essential: 'Essential', Desirable: 'Desirable' }, (m) => m.ved);
  return make(['High', 'Medium', 'Low'], { High: 'High · score > 70', Medium: 'Medium · 40–70', Low: 'Low · < 40' }, (m) => (m.criticality_score > 70 ? 'High' : m.criticality_score >= 40 ? 'Medium' : 'Low'));
}

/** Quarterly savings pipeline — grouped bars: identified → approved → implemented → realized. */
export function savingsPipeline(recs: Recommendation[]): { quarter: string; identified: number; approved: number; implemented: number; realized: number }[] {
  const f = savingsFunnel(recs);
  return ['Q1', 'Q2', 'Q3', 'Q4'].map((quarter, i) => {
    const t = (i + 1) / 4;
    return {
      quarter,
      identified: Math.round(f.identified * t),
      approved: Math.round(f.approved * Math.pow(t, 1.15)),
      implemented: Math.round(f.implemented * Math.pow(t, 1.35)),
      realized: Math.round(f.implemented * Math.pow(t, 1.6)),
    };
  });
}

/* ── Opportunity Finder (grouped optimization opportunities) ─────── */
export type OppKind = 'reduce_stock' | 'dispose' | 'transfer' | 'rebalance';
export interface OppItem { material: Material; savings: number; note: string }
export interface OppGroup { key: string; label: string; desc: string; count: number; value: number; actionKind: OppKind; items: OppItem[] }

export function opportunityGroups(plantIds: string[]): OppGroup[] {
  const mats = MATERIALS.filter((m) => plantIds.includes(m.plant_id));
  const groups: OppGroup[] = [];

  // Excess inventory — high cover, not fast-moving
  const excess = mats.filter((m) => m.coverage_days > 180 && m.fsn !== 'Fast').sort((a, b) => b.current_stock_value - a.current_stock_value);
  groups.push({
    key: 'excess', label: 'Excess inventory', desc: 'over 180 days of cover', actionKind: 'reduce_stock',
    count: excess.length, value: excess.reduce((n, m) => n + m.current_stock_value, 0),
    items: excess.slice(0, 20).map((m) => ({ material: m, savings: Math.round(m.current_stock_value * 0.4), note: `${m.coverage_days}d cover — reduce reorder level` })),
  });

  // Obsolete stock — non-moving
  const dead = mats.filter((m) => m.fsn === 'Non-moving').sort((a, b) => b.current_stock_value - a.current_stock_value);
  groups.push({
    key: 'obsolete', label: 'Obsolete stock', desc: 'non-moving · write-off candidates', actionKind: 'dispose',
    count: dead.length, value: dead.reduce((n, m) => n + m.current_stock_value, 0),
    items: dead.slice(0, 20).map((m) => ({ material: m, savings: Math.round(m.current_stock_value * 0.5), note: 'No movement — dispose / write-off' })),
  });

  // Safety-stock overstock — very high cover on non-vital
  const overstock = mats.filter((m) => m.coverage_days > 250 && m.ved !== 'Vital').sort((a, b) => b.coverage_days - a.coverage_days);
  groups.push({
    key: 'overstock', label: 'Safety-stock overstock', desc: 'safety stock set too high', actionKind: 'reduce_stock',
    count: overstock.length, value: overstock.reduce((n, m) => n + m.current_stock_value, 0),
    items: overstock.slice(0, 20).map((m) => ({ material: m, savings: Math.round(m.current_stock_value * 0.3), note: `${m.coverage_days}d cover on ${m.ved} — lower safety stock` })),
  });

  // Stock transfer — vital at risk that could be sourced from another plant
  const transfer = mats.filter((m) => (m.ved === 'Vital' || m.ved === 'Essential') && m.coverage_days < 25).sort((a, b) => a.coverage_days - b.coverage_days);
  groups.push({
    key: 'transfer', label: 'Stock transfer', desc: 'rebalance from a plant with excess', actionKind: 'transfer',
    count: transfer.length, value: transfer.reduce((n, m) => n + m.current_stock_value, 0),
    items: transfer.slice(0, 20).map((m) => ({ material: m, savings: Math.round(m.avg_monthly_demand * m.unit_cost * 1.2), note: `${m.coverage_days}d cover — transfer avoids emergency buy` })),
  });

  // Duplicate materials — same category + supplier clusters
  const dupMap = new Map<string, Material[]>();
  mats.forEach((m) => { const k = `${m.category}|${m.supplier}`; const a = dupMap.get(k) || []; a.push(m); dupMap.set(k, a); });
  const dupClusters = Array.from(dupMap.values()).filter((a) => a.length > 1);
  const dupItems = dupClusters.map((a) => a.sort((x, y) => y.current_stock_value - x.current_stock_value)[0]);
  groups.push({
    key: 'duplicate', label: 'Duplicate materials', desc: 'consolidate near-identical SKUs', actionKind: 'rebalance',
    count: dupClusters.length, value: dupItems.reduce((n, m) => n + m.current_stock_value, 0),
    items: dupItems.slice(0, 20).map((m) => ({ material: m, savings: Math.round(m.current_stock_value * 0.15), note: `${dupMap.get(`${m.category}|${m.supplier}`)!.length} similar ${m.category} SKUs from ${m.supplier}` })),
  });

  // Supplier consolidation — suppliers with many SKUs
  const supMap = new Map<string, Material[]>();
  mats.forEach((m) => { const a = supMap.get(m.supplier) || []; a.push(m); supMap.set(m.supplier, a); });
  const bigSuppliers = Array.from(supMap.entries()).filter(([, a]) => a.length >= 6).sort((a, b) => b[1].length - a[1].length);
  groups.push({
    key: 'supplier', label: 'Supplier consolidation', desc: 'fewer POs · leverage spend', actionKind: 'rebalance',
    count: bigSuppliers.length, value: bigSuppliers.reduce((n, [, a]) => n + a.reduce((s, m) => s + m.current_stock_value, 0), 0),
    items: bigSuppliers.slice(0, 12).map(([, a]) => ({ material: a.sort((x, y) => y.current_stock_value - x.current_stock_value)[0], savings: Math.round(a.reduce((s, m) => s + m.current_stock_value, 0) * 0.05), note: `${a.length} SKUs from ${a[0].supplier} — consolidate POs` })),
  });

  return groups;
}

export { REGIONS };
