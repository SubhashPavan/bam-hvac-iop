/**
 * Client for the Inventory Optimization backend (FastAPI, app/ml + agent).
 * Base URL via VITE_INVENTORY_API_URL, defaults to the local dev server.
 *
 * Callers should treat every function as best-effort: on failure the UI falls
 * back to the deterministic mock so the demo never breaks.
 */
import type { SageBlock, SageItem, SageReply } from '../pages/inventory/sageEngine';
import type { ActionKind } from '../store/requestStore';
import type { Material, Plant, Recommendation } from '../types/inventory';

const API_BASE =
  import.meta.env.VITE_INVENTORY_API_URL || 'http://localhost:8020/api/v1';

// ── Global in-flight tracker ─────────────────────────────────────────
// Every request bumps a counter; the top progress bar + panel loaders
// subscribe to it, so any populating API shows a loading indicator with
// zero per-view wiring.
let _inflight = 0;
const _subs = new Set<(n: number) => void>();
function _bump(delta: number) {
  _inflight = Math.max(0, _inflight + delta);
  _subs.forEach((fn) => fn(_inflight));
}
/** Subscribe to the count of API requests currently in flight. Returns an unsubscribe fn. */
export function onInflight(cb: (n: number) => void): () => void {
  _subs.add(cb);
  cb(_inflight);
  return () => { _subs.delete(cb); };
}

async function get<T>(path: string): Promise<T> {
  _bump(1);
  try {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
    return await res.json();
  } finally {
    _bump(-1);
  }
}
async function post<T>(path: string, body: unknown): Promise<T> {
  _bump(1);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`POST ${path} → ${res.status}`);
    return await res.json();
  } finally {
    _bump(-1);
  }
}

/** Is the backend reachable? (used to decide live vs mock) */
export async function inventoryApiHealthy(): Promise<boolean> {
  try {
    const r = await fetch(`${API_BASE.replace(/\/api\/v1$/, '')}/health`);
    return r.ok;
  } catch {
    return false;
  }
}

// ── Sage agent ───────────────────────────────────────────────────────
interface AgentBlock { type: string; data: any }
interface AgentResponse {
  answer: string;
  blocks: AgentBlock[];
  tools_used: string[];
  engine: string;
  suggestions: string[];
}

const money = (n: number) =>
  Math.abs(n) >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M`
    : Math.abs(n) >= 1_000 ? `$${(n / 1_000).toFixed(1)}K`
    : `$${Math.round(n)}`;

const TOOL_STEP: Record<string, string> = {
  get_kpis: 'Pulled the KPIs',
  savings_matrix: 'Read the savings matrix',
  find_opportunities: 'Scanned optimization opportunities',
  forecast_material: 'Ran the demand forecast',
  demand_outlook: 'Aggregated the demand outlook',
  classify: 'Classified the portfolio',
  run_simulation: 'Simulated the scenario',
  tradeoff: 'Computed the service/investment tradeoff',
  search_materials: 'Searched the stock base',
  create_action: 'Raised the workflow request',
};

const ACT_LABEL: Partial<Record<ActionKind, string>> = {
  reduce_stock: 'Reduce', dispose: 'Dispose', increase_stock: 'Increase',
  transfer: 'Transfer', rebalance: 'Rebalance', expedite: 'Expedite', param_change: 'Adjust',
};

function mapBlocks(blocks: AgentBlock[]): SageBlock[] {
  const out: SageBlock[] = [];
  for (const b of blocks) {
    const d = b.data || {};
    if (b.type === 'kpis') {
      out.push({ kind: 'kpis', tiles: [
        { label: 'Inventory value', value: money(d.total_inventory_value) },
        { label: 'Savings potential', value: money(d.savings_potential), tone: 'amber' },
        { label: 'Service level', value: `${d.service_level}%` },
        { label: 'Working capital', value: money(d.working_capital_released) },
        { label: 'Obsolete', value: money(d.obsolete_stock_value), tone: 'rose' },
        { label: 'Stockouts', value: String(d.stockouts), tone: d.stockouts > 0 ? 'rose' : undefined },
      ] });
    } else if (b.type === 'savings_matrix') {
      const k = d.kpis || {};
      out.push({ kind: 'kpis', tiles: [
        { label: 'Total inventory', value: money(k.total_inventory || 0) },
        { label: 'Total opportunity', value: money(k.total_opportunity || 0), tone: 'amber' },
        { label: 'Working capital', value: money(k.working_capital_release || 0) },
        { label: 'Obsolete', value: money(k.obsolete_stock || 0), tone: 'rose' },
        { label: 'Service level', value: `${k.service_level ?? '—'}%` },
        { label: 'At risk', value: String(k.at_risk_skus ?? 0), tone: (k.at_risk_skus || 0) > 0 ? 'rose' : undefined },
      ] });
      // Roll the FSN × tier cells up to the three FSN columns for the chat summary.
      const byFsn = new Map<string, { count: number; savings: number }>();
      for (const c of (d.cells || [])) {
        if (!c.opp_count) continue;
        const g = byFsn.get(c.fsn) || { count: 0, savings: 0 };
        g.count += c.opp_count; g.savings += c.savings || 0;
        byFsn.set(c.fsn, g);
      }
      const groups = [...byFsn.entries()].map(([fsn, g]) => ({
        key: fsn, label: `${fsn}-moving`, count: g.count, value: g.savings, savings: g.savings,
      })).filter((g) => g.count).sort((a, b) => b.savings - a.savings);
      if (groups.length) out.push({ kind: 'oppGroups', groups });
    } else if (b.type === 'opportunities') {
      const groups = (d.groups || []).filter((g: any) => g.count > 0);
      if (groups.length) {
        out.push({ kind: 'oppGroups', groups: groups.map((g: any) => ({
          key: g.type, label: g.label, count: g.count,
          value: g.total_cash_release, savings: g.total_savings,
        })) });
        const top = [...groups].sort((a, b) => b.total_savings - a.total_savings)
          .find((g) => (g.items || []).length);
        if (top) {
          const items: SageItem[] = top.items.slice(0, 5).map((it: any) => ({
            seed: it.action_seed,
            badge: top.label,
            value: it.savings_potential,
            sub: String(it.rationale || '').slice(0, 72),
            act: ACT_LABEL[it.action_seed?.kind as ActionKind] || 'Act',
          }));
          out.push({ kind: 'items', title: `Top ${top.label.toLowerCase()}`, items });
        }
      }
    } else if (b.type === 'scenario') {
      const svc = d.attained_service_level ?? 95;
      const pts = Array.from({ length: 8 }, (_, i) => Math.round((96 - (96 - svc) * (i / 7)) * 10) / 10);
      out.push({ kind: 'scenario', title: d.scenario || 'What-if scenario', points: pts, stats: [
        { label: 'Attained service', value: `${svc}%`, tone: svc < 90 ? 'rose' : undefined },
        { label: 'Stockout risk', value: `${d.stockout_risk}%`, tone: 'amber' },
        { label: 'At risk', value: `${d.at_risk_count} items`, tone: 'rose' },
        { label: 'Invest→target', value: money(d.scenario_investment) },
      ] });
    } else if (b.type === 'demand_outlook') {
      out.push({ kind: 'forecast', growth: d.growth_count, decline: d.decline_count,
        accuracy: d.model_accuracy, movers: [] });
    }
    // forecast(single) / classification / materials / tradeoff / action → carried by the text answer
  }
  return out;
}

/** Ask Sage via the backend; maps to the SageReply the dock renders. Throws on failure. */
export async function askSage(query: string, plantIds: string[]): Promise<SageReply> {
  const r = await post<AgentResponse>('/agent/query', {
    query,
    plant_ids: plantIds.length ? plantIds : undefined,
  });
  const steps = (r.tools_used || []).map((t) => TOOL_STEP[t]).filter(Boolean);
  return {
    text: r.answer || 'Done.',
    blocks: mapBlocks(r.blocks || []),
    chips: r.suggestions?.length ? r.suggestions : undefined,
    steps: steps.length ? Array.from(new Set(steps)) : undefined,
  };
}

// ── Typed reads (for wiring dashboards next) ──────────────────────────
const scope = (plantIds?: string[]) =>
  plantIds?.length ? '?' + plantIds.map((p) => `plant_id=${encodeURIComponent(p)}`).join('&') : '';

async function fetchAllPaged<T>(path: string, size = 200): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= 40; page++) {
    const sep = path.includes('?') ? '&' : '?';
    const r = await get<{ items: T[]; total: number }>(`${path}${sep}page=${page}&page_size=${size}`);
    out.push(...(r.items || []));
    if (out.length >= (r.total || 0) || !r.items?.length) break;
  }
  return out;
}

/**
 * Load the full base dataset (plants + all materials + all recommendations)
 * from the backend, to hydrate the accelerator's in-memory arrays. Every
 * downstream view then reflects live (seeded or ingested) data.
 */
export async function loadInventoryBase(): Promise<{
  plants: Plant[]; materials: Material[]; recommendations: Recommendation[];
}> {
  const [plants, materials, recommendations] = await Promise.all([
    get<Plant[]>('/plants'),
    fetchAllPaged<Material>('/materials', 500),
    fetchAllPaged<Recommendation>('/recommendations', 500),
  ]);
  return { plants, materials, recommendations };
}

export const getSavingsMatrix = (plantIds?: string[]) => get<any>(`/savings-matrix${scope(plantIds)}`);
export const getMatrixNarrative = (plantIds?: string[]) => get<any>(`/savings-matrix/narrative${scope(plantIds)}`);
export const getKpis = (plantIds?: string[]) => get<any>(`/kpis${scope(plantIds)}`);
export const getOpportunities = (plantIds?: string[]) => get<any>(`/opportunities${scope(plantIds)}`);
export const getClassification = (plantIds?: string[]) => get<any>(`/classification${scope(plantIds)}`);
export const getForecast = (materialId: string, serviceLevel?: number, historyWindow = 12) =>
  get<any>(`/forecast/${materialId}?horizon=6&history_window=${historyWindow}` +
    (serviceLevel ? `&service_level=${Math.min(0.9998, Math.max(0.5001, serviceLevel))}` : ''));
export const getDemandOutlook = (plantIds?: string[]) => get<any>(`/forecast/aggregate${scope(plantIds)}`);
export interface MaterialInsight { insight: string; actions: string[] }
export const getMaterialInsight = (materialId: string, serviceLevel?: number) =>
  get<MaterialInsight>(`/forecast/${materialId}/insight` +
    (serviceLevel ? `?service_level=${Math.min(0.9998, Math.max(0.5001, serviceLevel))}` : ''));

// ── Network pooling & vendor analytics (Oniqua-style) ─────────────────
export const getNetworkPooling = (plantIds?: string[]) => get<any>(`/network/pooling${scope(plantIds)}`);
export const getVendors = (plantIds?: string[]) => get<any>(`/vendors${scope(plantIds)}`);

// ── Deep Insight (multi-step staged report) ───────────────────────────
export interface DeepPlanStep { id: string; title: string; tool: string }
export interface DeepSection { id: string; title: string; tool: string; finding: string; block: { type: string; data: any } | null }
export interface DeepAction { title: string; detail: string }
export interface DeepInsight {
  title: string; objective: string; narrative: string;
  plan: DeepPlanStep[]; sections: DeepSection[]; actions: DeepAction[];
  engine: string; generated_at: string;
}
export const runDeepInsight = (query: string, plantIds?: string[], preset?: string) =>
  post<DeepInsight>('/agent/deep', { query, plant_ids: plantIds?.length ? plantIds : undefined, preset });

// ── Inventory stocking policy (our standard method) ───────────────────
export interface PolicyRow {
  id: string; active: boolean; status_tag: string;
  unit_rate: number | string; data_status: string; data_error_qty: number | string; data_error_value: number | string;
  fsn: string; cv: number | string; cv_band: string; service_level: number | string; z_score: number | string;
  lead_time_days: number | string; annual_consumption_value: number | string; abc: string;
  safety_stock: number | string; rol: number | string; roq: number | string; max_stock: number | string; avg_stock: number | string;
  ss_value: number | string; rol_value: number | string; roq_value: number | string; max_value: number | string; avg_value: number | string;
  avg_monthly_consumption: number | string; consumption_months: number | string;
}
export const getInventoryPolicy = (plantIds?: string[]) => get<PolicyRow[]>(`/forecast/policy${scope(plantIds)}`);

// ── CSV ingestion (real upload → activate → the whole accelerator runs on it) ──
export interface IngestPreview {
  filename: string; headers: string[]; row_count: number; sample_rows: any[];
  suggested_mapping: Record<string, string | null>; required: string[]; core_fields: string[];
  history_columns: string[];
}
export interface IngestResult {
  source_id: string | null; filename: string; row_count: number; material_count: number;
  plant_count: number; recommendation_count: number; history_periods: number; issues: string[]; activated: boolean;
}
export const ingestPreview = (csvText: string, filename = 'upload.csv') =>
  post<IngestPreview>('/ingest/preview', { csv_text: csvText, filename });
export const ingestCsv = (csvText: string, mapping: Record<string, string | null> | null, filename = 'upload.csv', activate = true) =>
  post<IngestResult>('/ingest/csv', { csv_text: csvText, mapping, filename, activate });

// ── Forecasting / simulation (real ML) ────────────────────────────────
export interface ForecastSummaryRow {
  material_id: string; demand_pattern: string; method: string; per_period_demand: number;
  model_accuracy: number; trend_pct: number; understocked: boolean; coverage_days: number;
  on_hand_qty: number; stock_value: number; unit_cost: number; safety_stock: number;
  reorder_point: number; reorder_qty: number; target_units: number;
  recommended_coverage_days: number | null; lead_time_days: number; service_level: number; savings: number;
}
/** All per-material forecast summaries for a plant selection (real Croston/SBA/TSB). */
export const fetchForecastSummaries = (plantIds?: string[]) =>
  fetchAllPaged<ForecastSummaryRow>(`/forecast${scope(plantIds)}`);

/** Service-level ↔ investment tradeoff curve, mapped to the view's shape. */
export async function fetchTradeoff(plantIds?: string[]): Promise<{
  curve: { service: number; investment: number }[]; currentService: number; baseInvestment: number;
}> {
  const d = await get<any>(`/simulate/tradeoff${scope(plantIds)}`);
  return {
    curve: d.curve || [],
    currentService: Math.round(d.current_service ?? 90),
    baseInvestment: d.current_investment ?? 0,
  };
}

/** Monte-Carlo simulation for a target service level, mapped to the view's shape. */
export async function fetchSimulate(plantIds: string[] | undefined, targetPct: number): Promise<{
  investment: number; deltaPct: number; stockoutRisk: number; attainedService: number; atRisk: number;
}> {
  const d = await post<any>('/simulate', {
    plant_id: plantIds?.length ? plantIds : undefined,
    target_service_level: Math.min(0.9999, Math.max(0.5, targetPct / 100)),
    label: `Target service ${targetPct}%`,
  });
  const base = d.baseline_investment || 1;
  return {
    investment: d.scenario_investment,
    deltaPct: Math.round(((d.scenario_investment - base) / base) * 100),
    stockoutRisk: d.stockout_risk,
    attainedService: d.attained_service_level,
    atRisk: d.at_risk_count,
  };
}
