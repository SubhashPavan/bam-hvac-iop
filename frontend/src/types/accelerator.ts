/** Accelerator catalog — published, versioned solution IP from CoEs.
 *  Currently mock-only. Backend will follow the same shape.
 */

export type AcceleratorIndustry =
  | 'retail'
  | 'manufacturing'
  | 'bfsi'
  | 'healthcare'
  | 'cross';

export type AcceleratorBackend = 'fabric' | 'databricks' | 'open';

export type AcceleratorStatus = 'ga' | 'beta' | 'preview';

export interface Accelerator {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  industry: AcceleratorIndustry;
  functional_area: string;
  coe: string;
  version: string;
  status: AcceleratorStatus;
  backends: AcceleratorBackend[];
  installed: boolean;
  installed_workspaces?: string[];
  install_count: number;
  pipeline_success_pct: number;
  updated_at: string;
  contents: {
    entities: number;
    pipeline_tasks: number;
    models: number;
    dashboards: number;
    agent_tools: number;
    config_params: number;
  };
  repo: string;
  signed_by: string;
}

export const INDUSTRY_LABELS: Record<AcceleratorIndustry, string> = {
  retail: 'Retail / CPG',
  manufacturing: 'Manufacturing',
  bfsi: 'BFSI',
  healthcare: 'Healthcare',
  cross: 'Cross-industry',
};

export const BACKEND_LABELS: Record<AcceleratorBackend, string> = {
  fabric: 'Fabric',
  databricks: 'Databricks',
  open: 'Open (Prefect + Delta)',
};

export const STATUS_LABELS: Record<AcceleratorStatus, string> = {
  ga: 'GA',
  beta: 'Beta',
  preview: 'Preview',
};
