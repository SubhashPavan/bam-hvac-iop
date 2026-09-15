/** Inventory Optimization accelerator — domain model.
 *  Modeled on the LEAP Intelligence reference app (MRO spare-parts inventory).
 *  Mock-only for now; the same interfaces will later be served from Databricks gold.
 */

export type Region = 'Europe' | 'NORAM' | 'South Africa' | 'India' | 'ANZ' | 'LATAM';

export type RecommendationType =
  | 'reduce_stock'
  | 'dispose'
  | 'increase_stock'
  | 'keep_unchanged'
  | 'emergency_action';

export type WorkflowStatus =
  | 'pending'
  | 'eng_approved'
  | 'maint_approved'
  | 'finance_approved'
  | 'implemented'
  | 'rejected';

export type XYZ = 'X' | 'Y' | 'Z'; // demand variability
export type FSN = 'Fast' | 'Slow' | 'Non-moving'; // movement
export type VED = 'Vital' | 'Essential' | 'Desirable'; // criticality
export type RiskLevel = 'low' | 'medium' | 'high';

export interface Plant {
  id: string; // e.g. IN-LAL-01
  name: string;
  region: Region;
  country: string;
  material_count: number;
  inventory_value: number;
  service_level: number; // 0–100
}

export interface Material {
  id: string; // 8-digit code
  description: string; // "Bearings – Grundfos I935"
  category: string;
  supplier: string;
  plant_id: string;
  region: Region;
  country: string;
  xyz: XYZ;
  fsn: FSN;
  ved: VED;
  criticality_score: number; // 0–100
  coverage_days: number;
  on_hand_qty: number;
  unit_cost: number;
  current_stock_value: number;
  avg_monthly_demand: number;
}

export interface Recommendation {
  id: string;
  material_id: string;
  material_desc: string;
  category: string;
  plant_id: string;
  region: Region;
  country: string;
  type: RecommendationType;
  confidence: number; // 0–100
  current_stock_value: number;
  recommended_value: number;
  savings_potential: number;
  cash_release: number;
  risk: RiskLevel;
  ai_reasoning: string;
  coverage_days: number;
  fsn: FSN;
  ved: VED;
  criticality_score: number;
  workflow_status: WorkflowStatus;
}

/* ── UI labels / tones ─────────────────────────────────────────── */

export const REC_TYPE_LABEL: Record<RecommendationType, string> = {
  reduce_stock: 'Reduce Stock',
  dispose: 'Dispose',
  increase_stock: 'Increase Stock',
  keep_unchanged: 'Keep Unchanged',
  emergency_action: 'Emergency Action',
};

export const WORKFLOW_LABEL: Record<WorkflowStatus, string> = {
  pending: 'Pending',
  eng_approved: 'Eng. Approved',
  maint_approved: 'Maintenance Approved',
  finance_approved: 'Finance Approved',
  implemented: 'Implemented',
  rejected: 'Rejected',
};
