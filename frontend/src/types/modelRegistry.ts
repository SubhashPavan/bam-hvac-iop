/** Model Registry — admin-managed inference endpoints.
 *
 * No forced task taxonomy. Models are classified via free-form tags
 * (HuggingFace-style). The only structured field the platform routes
 * on is `provider` — it decides which adapter handles invocation.
 */

export type ModelProvider =
  | 'mlflow'
  | 'azure_ml'
  | 'databricks'
  | 'sagemaker'
  | 'vertex'
  | 'huggingface'
  | 'foundry'
  | 'anthropic'
  | 'openai'
  | 'bedrock'
  | 'custom';

export type AuthMethod = 'api_key' | 'bearer_token' | 'managed_identity' | 'none';
export type ServingMode = 'batch' | 'realtime' | 'both';
export type ModelStatus = 'active' | 'inactive' | 'drift' | 'error' | 'training' | 'deprecated';
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RegisteredModel {
  id: string;
  name: string;
  display_name: string;
  description: string;

  algorithm: string;
  framework: string;

  provider: ModelProvider;
  endpoint_url: string;
  http_method: HttpMethod;
  auth_method: AuthMethod;
  credentials_ref: string;
  custom_headers: Record<string, string>;

  version: string;
  status: ModelStatus;

  training_data_ref: string;
  last_trained_at: string | null;
  metrics: Record<string, number | string>;

  tags: string[];
  sample_payload: Record<string, unknown>;
  sample_response: Record<string, unknown>;
  serving_mode: ServingMode;
  cost_hint_usd: number;

  created_at: string;
  created_by: string;
  updated_at: string;
  usage_count: number;
  last_invoked_at: string | null;
}

export interface RegisterModelInput {
  name: string;
  display_name: string;
  description?: string;
  algorithm?: string;
  framework?: string;
  provider: ModelProvider;
  endpoint_url: string;
  http_method?: HttpMethod;
  auth_method?: AuthMethod;
  credentials_ref?: string;
  custom_headers?: Record<string, string>;
  version?: string;
  training_data_ref?: string;
  metrics?: Record<string, number | string>;
  tags?: string[];
  sample_payload?: Record<string, unknown>;
  sample_response?: Record<string, unknown>;
  serving_mode?: ServingMode;
  cost_hint_usd?: number;
}

export interface UpdateModelInput {
  display_name?: string;
  description?: string;
  algorithm?: string;
  framework?: string;
  endpoint_url?: string;
  http_method?: HttpMethod;
  auth_method?: AuthMethod;
  credentials_ref?: string;
  custom_headers?: Record<string, string>;
  version?: string;
  status?: ModelStatus;
  training_data_ref?: string;
  metrics?: Record<string, number | string>;
  tags?: string[];
  sample_payload?: Record<string, unknown>;
  sample_response?: Record<string, unknown>;
  serving_mode?: ServingMode;
  cost_hint_usd?: number;
}

/* ── UI labels ─────────────────────────────────────────────────── */

export const PROVIDER_LABELS: Record<ModelProvider, string> = {
  mlflow: 'MLflow',
  azure_ml: 'Azure ML',
  databricks: 'Databricks Model Serving',
  sagemaker: 'AWS SageMaker',
  vertex: 'Google Vertex AI',
  huggingface: 'HuggingFace',
  foundry: 'Azure AI Foundry',
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  bedrock: 'AWS Bedrock',
  custom: 'Custom endpoint',
};

export const AUTH_LABELS: Record<AuthMethod, string> = {
  api_key: 'API key',
  bearer_token: 'Bearer token',
  managed_identity: 'Managed identity',
  none: 'None (public)',
};

/** ── Invocation history + stats ─────────────────────────────── */

export interface ModelInvocation {
  id: string;
  model_id: string;
  workspace_id: string;
  user_id: string;
  user_email: string;
  success: boolean;
  status_code: number;
  duration_ms: number;
  error: string;
  source: 'test' | 'pipeline' | 'api';
  timestamp: string;
  payload_size: number;
}

export interface WorkspaceUsageRow {
  workspace_id: string;
  workspace_name: string;
  calls: number;
  success_rate: number;
  avg_ms: number;
}

export interface DailyUsageRow {
  date: string;
  calls: number;
  success_rate: number;
  avg_ms: number;
}

export interface ModelStats {
  model_id: string;
  total: number;
  success: number;
  failed: number;
  success_rate: number;
  avg_duration_ms: number;
  p95_duration_ms: number;
  by_workspace: WorkspaceUsageRow[];
  by_day: DailyUsageRow[];
  recent: ModelInvocation[];
  first_invoked_at: string | null;
  last_invoked_at: string | null;
}

export interface TestResult {
  ok: boolean;
  status_code: number;
  duration_ms: number;
  endpoint: string;
  response_preview: string;
  error?: string;
  note?: string;
}

/** Common tag suggestions — surfaced in the dialog as chips to click.
 *  Not enforced; user can type anything. */
export const TAG_SUGGESTIONS: string[] = [
  'forecasting',
  'classification',
  'regression',
  'anomaly-detection',
  'clustering',
  'recommendation',
  'nlp',
  'computer-vision',
  'statistical',
  'rules',
  'llm',
  'agent',
  'batch',
  'realtime',
  'inventory',
  'customer',
  'finance',
];
