/**
 * Model Registry API client. Admin-only endpoints (backend enforces).
 */
import type {
  RegisteredModel,
  RegisterModelInput,
  UpdateModelInput,
  ModelStats,
  TestResult,
} from '../types/modelRegistry';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const stored = localStorage.getItem('insightsmart-auth');
    if (stored) {
      const token = JSON.parse(stored)?.state?.token;
      if (token) headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    /* ignore */
  }
  return headers;
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.detail) detail = String(body.detail);
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export async function listModels(): Promise<RegisteredModel[]> {
  const res = await fetch(`${API_BASE}/api/model-registry/models`, {
    headers: authHeaders(),
  });
  return jsonOrThrow<RegisteredModel[]>(res);
}

export async function getModel(id: string): Promise<RegisteredModel> {
  const res = await fetch(`${API_BASE}/api/model-registry/models/${id}`, {
    headers: authHeaders(),
  });
  return jsonOrThrow<RegisteredModel>(res);
}

export async function registerModel(input: RegisterModelInput): Promise<RegisteredModel> {
  const res = await fetch(`${API_BASE}/api/model-registry/models`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  return jsonOrThrow<RegisteredModel>(res);
}

export async function updateModel(id: string, input: UpdateModelInput): Promise<RegisteredModel> {
  const res = await fetch(`${API_BASE}/api/model-registry/models/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  return jsonOrThrow<RegisteredModel>(res);
}

export async function deleteModel(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/model-registry/models/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok && res.status !== 204) {
    let detail = `Delete failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.detail) detail = String(body.detail);
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
}

export async function testModel(
  id: string,
  payload?: Record<string, unknown>,
  workspaceId?: string,
): Promise<TestResult> {
  const res = await fetch(`${API_BASE}/api/model-registry/models/${id}/test`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ payload, workspace_id: workspaceId }),
  });
  return jsonOrThrow<TestResult>(res);
}

export async function getModelStats(id: string): Promise<ModelStats> {
  const res = await fetch(`${API_BASE}/api/model-registry/models/${id}/stats`, {
    headers: authHeaders(),
  });
  return jsonOrThrow<ModelStats>(res);
}

export async function saveSample(
  id: string,
  payload: unknown,
  response: unknown,
): Promise<{ ok: boolean; sample_payload: unknown; sample_response: unknown }> {
  const res = await fetch(`${API_BASE}/api/model-registry/models/${id}/save-sample`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ payload, response }),
  });
  return jsonOrThrow(res);
}
