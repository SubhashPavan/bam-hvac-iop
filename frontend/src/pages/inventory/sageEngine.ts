/**
 * Sage query engine — turns a natural-language question about the stock base
 * into a structured, actionable reply (KPIs, opportunity lists, simulations,
 * classification, forecasts). Every item carries an ActionSeed so the chat can
 * push it straight into the approval workflow. Deterministic over the mock data;
 * swap the data helpers for Databricks-gold behind the same shapes.
 */
import {
  MATERIALS, RECOMMENDATIONS, PLANTS, opportunityGroups, availabilityRisk, demandOutlook,
  classification, plannerKpis, type OppKind,
} from '../../data/inventoryMock';
import { REC_TYPE_LABEL, type Material, type Recommendation, type RecommendationType } from '../../types/inventory';
import type { ActionSeed, ActionKind } from '../../store/requestStore';

const money = (n: number) => (Math.abs(n) >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : Math.abs(n) >= 1_000 ? `$${(n / 1_000).toFixed(1)}K` : `$${Math.round(n)}`);

export interface SageItem { seed: ActionSeed; badge: string; value: number; sub: string; act: string }
export type SageBlock =
  | { kind: 'kpis'; tiles: { label: string; value: string; tone?: string }[] }
  | { kind: 'oppGroups'; groups: { key: string; label: string; count: number; value: number; savings: number }[] }
  | { kind: 'items'; title: string; items: SageItem[] }
  | { kind: 'scenario'; title: string; points: number[]; stats: { label: string; value: string; tone?: string }[] }
  | { kind: 'forecast'; growth: number; decline: number; accuracy: number; movers: { desc: string; plant: string; changePct: number }[] };
export interface SageReply { steps?: string[]; text: string; blocks: SageBlock[]; navTo?: string; chips?: string[] }

const KIND_FROM_REC: Record<RecommendationType, ActionKind> = {
  reduce_stock: 'reduce_stock', dispose: 'dispose', increase_stock: 'increase_stock', keep_unchanged: 'param_change', emergency_action: 'expedite',
};
const recSeed = (r: Recommendation): ActionSeed => ({
  materialId: r.material_id, materialDesc: r.material_desc, plantId: r.plant_id, kind: KIND_FROM_REC[r.type],
  currentValue: r.current_stock_value, proposedValue: r.recommended_value, savings: r.savings_potential, cashRelease: r.cash_release, justification: r.ai_reasoning,
});
const matSeed = (m: Material, kind: ActionKind, savings: number, note: string): ActionSeed => ({
  materialId: m.id, materialDesc: m.description, plantId: m.plant_id, kind,
  currentValue: m.current_stock_value,
  proposedValue: kind === 'dispose' ? 0 : kind === 'reduce_stock' ? Math.round(m.current_stock_value * 0.6) : kind === 'increase_stock' ? Math.round(m.current_stock_value * 1.3) : Math.round(m.current_stock_value * 0.85),
  savings, cashRelease: kind === 'dispose' ? Math.round(m.current_stock_value * 0.5) : savings, justification: note,
});
const serviceDelay = () => [92, 90, 87, 84, 84, 86, 89, 91, 92];

export function sageAnswer(q: string, plantIds: string[]): SageReply {
  const s = q.toLowerCase();

  // Plant scoping — narrow if a plant name is mentioned.
  let scope = plantIds; let scopeLabel = 'your plants';
  for (const p of PLANTS) if (plantIds.includes(p.id) && s.includes(p.name.toLowerCase())) { scope = [p.id]; scopeLabel = p.name; }
  const mats = MATERIALS.filter((m) => scope.includes(m.plant_id));
  const recs = RECOMMENDATIONS.filter((r) => scope.includes(r.plant_id));
  const nMatch = s.match(/top\s*(\d+)|\b(\d+)\s*(?:items|opportunit|material|spare|sku)/);
  const N = Math.min(12, Math.max(1, nMatch ? +(nMatch[1] || nMatch[2]) : 5));

  // ── Simulation / what-if ──
  if (/simulat|what.?if|supplier delay|shutdown|scenario|stress/.test(s)) {
    return {
      steps: ['Built the scenario', `Propagated across ${scopeLabel}`, 'Computed service, cover & cost impact'],
      text: `Here's a 3-week supplier-delay simulation for ${scopeLabel}:`,
      blocks: [{ kind: 'scenario', title: 'What-if: 3-week supplier delay', points: serviceDelay(), stats: [
        { label: 'Service', value: '92% → 84%', tone: 'rose' }, { label: 'Vital breaches', value: '7 spares', tone: 'rose' },
        { label: 'Extra cost', value: '$310K', tone: 'amber' }, { label: 'Recovery', value: '~6 wks' },
      ] }],
      chips: ['Draft safety-stock actions', 'Show me the risks', 'Optimization opportunities'],
    };
  }

  // ── Specific opportunity types ──
  const groups = opportunityGroups(scope);
  const groupBy = (key: string) => groups.find((g) => g.key === key)!;
  const oppItems = (key: string, act: string, badge: string): SageItem[] => groupBy(key).items.slice(0, N).map((it) => ({
    seed: matSeed(it.material, groupBy(key).actionKind as ActionKind, it.savings, `${groupBy(key).label}: ${it.note}.`),
    badge, value: it.savings, sub: `${it.material.plant_id} · ${it.note}`, act,
  }));
  if (/excess|overstock|too much|sitting/.test(s) && !/safety/.test(s)) {
    const g = groupBy('excess');
    return { text: `${g.count} excess-inventory positions in ${scopeLabel} — ${money(g.value)} tied up, ${money(g.items.reduce((n, i) => n + i.savings, 0))} recoverable:`, blocks: [{ kind: 'items', title: 'Excess inventory', items: oppItems('excess', 'Reduce', 'Excess') }], chips: ['Obsolete stock', 'Stock transfers', 'Show all opportunities'] };
  }
  if (/obsolete|dead stock|write.?off|dispose|scrap/.test(s)) {
    const g = groupBy('obsolete');
    return { text: `${g.count} obsolete (non-moving) items in ${scopeLabel} — ${money(g.value)} to write off:`, blocks: [{ kind: 'items', title: 'Obsolete stock', items: oppItems('obsolete', 'Dispose', 'Obsolete') }], chips: ['Excess inventory', 'Free up capital', 'Show all opportunities'] };
  }
  if (/transfer|rebalanc|move stock|redistribut/.test(s)) {
    const g = groupBy('transfer');
    return { text: `${g.count} stock-transfer opportunities — rebalance to cover at-risk vital spares:`, blocks: [{ kind: 'items', title: 'Stock transfer', items: oppItems('transfer', 'Transfer', 'Transfer') }], chips: ['Show the risks', 'Show all opportunities'] };
  }
  if (/duplicate|consolidat.*(sku|material)|near.?identical/.test(s)) {
    const g = groupBy('duplicate');
    return { text: `${g.count} duplicate-material clusters to consolidate:`, blocks: [{ kind: 'items', title: 'Duplicate materials', items: oppItems('duplicate', 'Consolidate', 'Duplicate') }], chips: ['Supplier consolidation', 'Show all opportunities'] };
  }
  if (/supplier consolidat|too many supplier|fewer po/.test(s)) {
    const g = groupBy('supplier');
    return { text: `${g.count} suppliers are candidates for consolidation:`, blocks: [{ kind: 'items', title: 'Supplier consolidation', items: oppItems('supplier', 'Consolidate', 'Supplier') }], chips: ['Duplicate materials', 'Show all opportunities'] };
  }

  // ── Broad optimization opportunities ──
  if (/optimi|opportunit|where can i save|free.*capital|reduce.*(cost|inventory|stock)|save money|cash.*trap|lean/.test(s)) {
    const totalSavings = groups.reduce((n, g) => n + g.items.reduce((x, i) => x + i.savings, 0), 0);
    const totalCount = groups.reduce((n, g) => n + g.count, 0);
    const top = [...groups.flatMap((g) => g.items.map((it) => ({ g, it })))].sort((a, b) => b.it.savings - a.it.savings).slice(0, N);
    return {
      steps: ['Scanned all stock positions', `Ranked ${mats.length} SKUs across ${scopeLabel}`, 'Grouped into optimization plays'],
      text: `I found **${totalCount} optimization opportunities** worth **${money(totalSavings)}** across ${scopeLabel}. Here's the breakdown, and the highest-value moves to act on:`,
      blocks: [
        { kind: 'oppGroups', groups: groups.map((g) => ({ key: g.key, label: g.label, count: g.count, value: g.value, savings: g.items.reduce((n, i) => n + i.savings, 0) })) },
        { kind: 'items', title: 'Top moves', items: top.map(({ g, it }) => ({ seed: matSeed(it.material, g.actionKind as ActionKind, it.savings, `${g.label}: ${it.note}.`), badge: g.label.split(' ')[0], value: it.savings, sub: `${it.material.plant_id} · ${it.note}`, act: 'Act' })) },
      ],
      chips: ['Obsolete stock', 'Excess inventory', 'Simulate a supplier delay'],
    };
  }

  // ── Top savings / recommendations ──
  if (/\btop\b|biggest|best|highest.*(saving|value)|savings?\b/.test(s)) {
    const top = [...recs].sort((a, b) => b.savings_potential - a.savings_potential).slice(0, N);
    const total = recs.reduce((n, r) => n + r.savings_potential, 0);
    return {
      steps: ['Ranked recommendations by savings', 'Prepared each for one-click action'],
      text: `Top ${N} savings across ${scopeLabel} — ${money(total)} identified in total:`,
      blocks: [{ kind: 'items', title: `Top ${N} savings`, items: top.map((r) => ({ seed: recSeed(r), badge: REC_TYPE_LABEL[r.type], value: r.savings_potential, sub: `${r.plant_id} · ${r.confidence}% conf.`, act: 'Act' })) }],
      chips: ['Show all opportunities', 'What’s at risk?'],
    };
  }

  // ── Risk / stockout ──
  if (/risk|stockout|shortage|at risk|breach|run out|expedite|critical spare/.test(s)) {
    const ar = availabilityRisk(scope);
    return {
      text: `${ar.atRiskCount} vital/essential spares at stockout risk in ${scopeLabel} (${money(ar.atRiskValue)} exposure). Lowest cover first — act to expedite:`,
      blocks: [
        { kind: 'kpis', tiles: [{ label: 'At risk', value: String(ar.atRiskCount), tone: 'rose' }, { label: 'Exposure', value: money(ar.atRiskValue), tone: 'amber' }, { label: 'Safety breaches', value: String(ar.safetyBreaches), tone: 'rose' }] },
        { kind: 'items', title: 'Vital spares at risk', items: ar.atRisk.slice(0, N).map((m) => ({ seed: matSeed(m, 'expedite', Math.round(m.avg_monthly_demand * m.unit_cost * 1.2), `Only ${m.coverage_days}d cover on a ${m.ved} spare — expedite replenishment.`), badge: 'Expedite', value: m.current_stock_value, sub: `${m.plant_id} · ${m.coverage_days}d cover · crit ${m.criticality_score}`, act: 'Expedite' })) },
      ],
      chips: ['Simulate a supplier delay', 'Stock transfers', 'Optimization opportunities'],
    };
  }

  // ── Forecast / demand ──
  if (/forecast|demand|trend|moving up|growing|declin|movers/.test(s)) {
    const o = demandOutlook(scope);
    return {
      text: `Demand outlook for ${scopeLabel} — ${o.modelAccuracy}% model accuracy, ${o.growthCount} SKUs rising, ${o.declineCount} falling. Biggest movers:`,
      blocks: [{ kind: 'forecast', growth: o.growthCount, decline: o.declineCount, accuracy: o.modelAccuracy, movers: o.movers.slice(0, N).map((mv) => ({ desc: mv.material.description, plant: mv.material.plant_id, changePct: mv.changePct })) }],
      chips: ['Optimization opportunities', 'What’s at risk?'],
    };
  }

  // ── Classification ──
  const dim = /\babc\b/.test(s) ? 'abc' : /\bxyz\b/.test(s) ? 'xyz' : /\bfsn\b|fast.?mov|slow.?mov/.test(s) ? 'fsn' : /\bved\b|vital|essential|desirable/.test(s) ? 'ved' : /critical/.test(s) ? 'criticality' : null;
  if (dim) {
    const buckets = classification(scope, dim as 'abc');
    return {
      text: `${dim.toUpperCase()} classification across ${scopeLabel}:`,
      blocks: [{ kind: 'kpis', tiles: buckets.map((b) => ({ label: b.label.split(' ')[0], value: money(b.value), tone: undefined })) }],
      navTo: 'classification', chips: ['Optimization opportunities', 'Show the scorecard'],
    };
  }

  // ── KPIs / health / status ──
  if (/how am i doing|kpis?|health|status|service level|inventory value|turns|dashboard|summary|overview/.test(s)) {
    const k = plannerKpis(scope);
    const inv = mats.reduce((n, m) => n + m.current_stock_value, 0);
    const savings = recs.reduce((n, r) => n + r.savings_potential, 0);
    const dead = mats.filter((m) => m.fsn === 'Non-moving').reduce((n, m) => n + m.current_stock_value, 0);
    return {
      text: `Snapshot for ${scopeLabel}:`,
      blocks: [{ kind: 'kpis', tiles: [
        { label: 'Inventory value', value: money(inv) }, { label: 'Savings potential', value: money(savings), tone: 'amber' },
        { label: 'Fill rate', value: `${k.fillRate}%`, tone: k.fillRate < 92 ? 'rose' : 'mint' }, { label: 'Turns', value: `${k.turns}×` },
        { label: 'Dead stock', value: money(dead), tone: 'rose' }, { label: 'Stockout rate', value: `${k.stockoutRate}%`, tone: k.stockoutRate > 5 ? 'rose' : 'mint' },
      ] }],
      navTo: 'dashboard', chips: ['Optimization opportunities', 'What’s at risk?', 'Show the forecast'],
    };
  }

  // ── Material lookup ──
  const idMatch = s.match(/\b(\d{6,})\b/);
  const found = idMatch ? mats.find((m) => m.id.includes(idMatch[1])) : mats.find((m) => s.includes(m.description.toLowerCase().split(' – ')[0].toLowerCase()) && s.length > 12 && /about|tell me|show me|what.*about|detail/.test(s));
  if (found) {
    const rec = recs.find((r) => r.material_id === found.id);
    return {
      text: `${found.description} (${found.id}) at ${found.plant_id}:`,
      blocks: [
        { kind: 'kpis', tiles: [{ label: 'Stock value', value: money(found.current_stock_value) }, { label: 'Cover', value: `${found.coverage_days}d`, tone: found.coverage_days < 15 ? 'rose' : undefined }, { label: 'Class', value: `${found.xyz}·${found.fsn[0]}·${found.ved[0]}` }, { label: 'Criticality', value: `${found.criticality_score}` }] },
        ...(rec ? [{ kind: 'items' as const, title: 'Recommended action', items: [{ seed: recSeed(rec), badge: REC_TYPE_LABEL[rec.type], value: rec.savings_potential, sub: rec.ai_reasoning.slice(0, 80), act: 'Act' }] }] : []),
      ],
    };
  }

  // ── Navigation ──
  const nav = /dashboard|home/.test(s) ? 'dashboard' : /recommend/.test(s) ? 'recommendations' : /material/.test(s) ? 'materials' : /classif/.test(s) ? 'classification' : /plant|network|map/.test(s) ? 'network' : /workflow|approv/.test(s) ? 'workflow' : /saving/.test(s) ? 'savings' : null;
  if (nav && /open|go to|take me|show me the|navigate|switch to/.test(s)) {
    return { text: `Opening ${nav}.`, blocks: [], navTo: nav };
  }

  // ── Fallback ──
  return {
    text: `I can optimize your entire stock base. Ask me for **optimization opportunities**, "what's at risk", "show obsolete stock", "top 5 savings at Pune", "simulate a supplier delay", or "tell me about material 10553…". I'll surface the moves and you can act on any of them.`,
    blocks: [], chips: ['Show optimization opportunities', 'What’s at risk?', 'Top 5 savings', 'Simulate a supplier delay'],
  };
}

export const oppGroupSavings = (key: string, plantIds: string[]) => opportunityGroups(plantIds).find((g) => g.key === key)?.items.reduce((n, i) => n + i.savings, 0) || 0;
export { money as sageMoney };
export type { OppKind };
