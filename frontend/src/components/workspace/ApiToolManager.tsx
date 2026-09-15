import { useState, useEffect } from 'react';
import {
  Plus, Trash2, Save, X, ChevronDown, ChevronRight,
  Plug, Play, Loader2, Check, AlertCircle, ToggleLeft, ToggleRight, Pencil,
} from 'lucide-react';
import {
  listApiTools, addApiTool, updateApiTool, deleteApiTool, testApiTool,
  type ApiToolConfig, type ApiToolParam,
} from '../../services/api';

interface ApiToolManagerProps {
  workspaceId: string;
  onClose: () => void;
}

const EMPTY_PARAM: ApiToolParam = {
  name: '', type: 'string', required: true, description: '', default_value: '',
};

function emptyTool(): Partial<ApiToolConfig> {
  return {
    name: '', tool_name: '', description: '', endpoint_url: '', req_code: '',
    method: 'POST', auth_config: { apikey: '', token: '' },
    input_parameters: [], response_path: '', response_fields: [],
    enabled: true, timeout_seconds: 30,
  };
}

export default function ApiToolManager({ workspaceId, onClose }: ApiToolManagerProps) {
  const [tools, setTools] = useState<ApiToolConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTool, setEditTool] = useState<Partial<ApiToolConfig> | null>(null);
  const [editId, setEditId] = useState<string | null>(null); // null = adding new
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; data: unknown; error?: string } | null>(null);
  const [testParams, setTestParams] = useState<Record<string, string>>({});
  const [expandedTool, setExpandedTool] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    loadTools();
  }, [workspaceId]);

  const loadTools = async () => {
    setLoading(true);
    try {
      const list = await listApiTools(workspaceId);
      setTools(list);
    } catch {
      showToast('Failed to load API tools', 'error');
    }
    setLoading(false);
  };

  const startAdd = () => {
    setEditTool(emptyTool());
    setEditId(null);
  };

  const startEdit = (tool: ApiToolConfig) => {
    setEditTool({ ...tool });
    setEditId(tool.id);
  };

  const cancelEdit = () => {
    setEditTool(null);
    setEditId(null);
  };

  const saveTool = async () => {
    if (!editTool || !editTool.name || !editTool.endpoint_url) {
      showToast('Name and Endpoint URL are required', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        await updateApiTool(workspaceId, editId, editTool);
        showToast('API tool updated');
      } else {
        await addApiTool(workspaceId, editTool);
        showToast('API tool added');
      }
      setEditTool(null);
      setEditId(null);
      await loadTools();
    } catch (e: any) {
      showToast(e.message || 'Failed to save', 'error');
    }
    setSaving(false);
  };

  const removeTool = async (id: string) => {
    try {
      await deleteApiTool(workspaceId, id);
      showToast('API tool deleted');
      await loadTools();
    } catch {
      showToast('Failed to delete', 'error');
    }
  };

  const runTest = async (tool: ApiToolConfig) => {
    setTesting(tool.id);
    setTestResult(null);
    try {
      const res = await testApiTool(workspaceId, tool.id, testParams);
      setTestResult({ id: tool.id, data: res });
      showToast(`Test passed (${res.duration_ms}ms)`);
      await loadTools(); // Refresh test_status
    } catch (e: any) {
      setTestResult({ id: tool.id, data: null, error: e.message });
      showToast('Test failed', 'error');
      await loadTools();
    }
    setTesting(null);
  };

  const updateParam = (idx: number, field: keyof ApiToolParam, value: string | boolean) => {
    if (!editTool) return;
    const params = [...(editTool.input_parameters || [])];
    params[idx] = { ...params[idx], [field]: value };
    setEditTool({ ...editTool, input_parameters: params });
  };

  const addParam = () => {
    if (!editTool) return;
    setEditTool({
      ...editTool,
      input_parameters: [...(editTool.input_parameters || []), { ...EMPTY_PARAM }],
    });
  };

  const removeParam = (idx: number) => {
    if (!editTool) return;
    const params = [...(editTool.input_parameters || [])];
    params.splice(idx, 1);
    setEditTool({ ...editTool, input_parameters: params });
  };

  // Shared class tokens
  const inputCls =
    'w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-[13.5px] text-navy-800 placeholder:text-navy-400 focus:border-accent-400 focus:ring-2 focus:ring-accent-100 focus:outline-none transition-colors';
  const labelCls = 'mb-1.5 block text-[12px] font-semibold uppercase tracking-wider text-navy-500';
  const primaryBtnCls =
    'inline-flex items-center gap-2 rounded-lg bg-accent-500 hover:bg-accent-600 disabled:bg-navy-200 disabled:text-navy-400 px-4 py-2 text-[13.5px] font-semibold text-white transition-colors';
  const secondaryBtnCls =
    'inline-flex items-center gap-2 rounded-lg border border-navy-200 bg-white hover:bg-navy-50 px-4 py-2 text-[13.5px] font-semibold text-navy-700 transition-colors';
  const smallBtnPrimary =
    'inline-flex items-center gap-1.5 rounded-md bg-accent-500 hover:bg-accent-600 disabled:bg-navy-200 disabled:text-navy-400 px-3 py-1.5 text-[12px] font-semibold text-white transition-colors';
  const smallBtnSecondary =
    'inline-flex items-center gap-1.5 rounded-md border border-navy-200 bg-white hover:bg-navy-50 px-3 py-1.5 text-[12px] font-semibold text-navy-700 transition-colors';
  const smallBtnDanger =
    'inline-flex items-center gap-1.5 rounded-md border border-danger-200 bg-white hover:bg-danger-50 px-3 py-1.5 text-[12px] font-semibold text-danger-700 transition-colors';

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/50 backdrop-blur-sm animate-fade-in px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col animate-fade-slide-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-navy-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-50 text-accent-600">
              <Plug size={18} />
            </div>
            <h2 className="text-[17px] font-semibold text-navy-900">External API Tools</h2>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-navy-400 hover:bg-navy-50 hover:text-navy-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <p className="mb-4 text-[13px] text-navy-600">
            Configure external APIs as tools. The AI agent will decide when to call them based on the user's question.
          </p>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-[13.5px] text-navy-500">
              <Loader2 size={20} className="is-spinner" /> Loading...
            </div>
          ) : (
            <>
              {/* Tool list */}
              <div className="flex flex-col gap-2.5">
                {tools.length === 0 && !editTool && (
                  <div className="rounded-xl border border-dashed border-navy-200 bg-navy-50/40 px-4 py-8 text-center text-[13px] text-navy-500">
                    No API tools configured yet.
                  </div>
                )}
                {tools.map((tool) => {
                  const isExpanded = expandedTool === tool.id;
                  const statusTone =
                    tool.test_status === 'success'
                      ? 'bg-success-50 text-success-700 ring-success-500/25'
                      : tool.test_status === 'failed'
                      ? 'bg-danger-50 text-danger-700 ring-danger-500/25'
                      : 'bg-navy-100 text-navy-600 ring-navy-300/40';
                  return (
                    <div
                      key={tool.id}
                      className="rounded-xl border border-navy-100 bg-white shadow-sm overflow-hidden"
                    >
                      <button
                        className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-navy-50/60 transition-colors text-left"
                        onClick={() => setExpandedTool(isExpanded ? null : tool.id)}
                      >
                        {isExpanded ? (
                          <ChevronDown size={14} className="text-navy-500" />
                        ) : (
                          <ChevronRight size={14} className="text-navy-500" />
                        )}
                        <span className="flex-1 min-w-0 text-[13.5px] font-semibold text-navy-900 truncate">
                          {tool.name}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider ring-1 ring-inset ${statusTone}`}
                        >
                          {tool.test_status === 'success' ? (
                            <Check size={10} />
                          ) : tool.test_status === 'failed' ? (
                            <AlertCircle size={10} />
                          ) : null}
                          {tool.test_status}
                        </span>
                        {tool.enabled ? (
                          <span className="inline-flex items-center rounded-full bg-success-50 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-success-700 ring-1 ring-inset ring-success-500/25">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-navy-100 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-navy-600 ring-1 ring-inset ring-navy-300/40">
                            Disabled
                          </span>
                        )}
                      </button>
                      {isExpanded && (
                        <div className="flex flex-col gap-3 border-t border-navy-100 bg-navy-50/30 px-4 py-4">
                          <div className="text-[13px] text-navy-700">
                            <strong className="text-navy-900">Description:</strong> {tool.description}
                          </div>
                          <div className="text-[13px] text-navy-700">
                            <strong className="text-navy-900">Endpoint:</strong>{' '}
                            <code className="rounded bg-navy-100 px-1.5 py-0.5 text-[12px] font-mono text-navy-800 break-all">
                              {tool.endpoint_url}
                            </code>
                          </div>
                          {tool.req_code && (
                            <div className="text-[13px] text-navy-700">
                              <strong className="text-navy-900">reqCode:</strong>{' '}
                              <code className="rounded bg-navy-100 px-1.5 py-0.5 text-[12px] font-mono text-navy-800">
                                {tool.req_code}
                              </code>
                            </div>
                          )}
                          <div className="text-[13px] text-navy-700">
                            <strong className="text-navy-900">Method:</strong>{' '}
                            <span className="inline-flex items-center rounded-md bg-accent-50 px-1.5 py-0.5 text-[11px] font-semibold uppercase text-accent-700 ring-1 ring-inset ring-accent-500/25">
                              {tool.method}
                            </span>
                          </div>
                          <div className="text-[13px] text-navy-700">
                            <strong className="text-navy-900">Response path:</strong>{' '}
                            <code className="rounded bg-navy-100 px-1.5 py-0.5 text-[12px] font-mono text-navy-800">
                              {tool.response_path || '(root)'}
                            </code>
                          </div>
                          {tool.input_parameters.length > 0 && (
                            <div className="text-[13px] text-navy-700">
                              <strong className="text-navy-900">Input Parameters:</strong>
                              <div className="mt-2 flex flex-col gap-1.5">
                                {tool.input_parameters.map((p, i) => (
                                  <div
                                    key={i}
                                    className="flex items-center gap-2 flex-wrap rounded-md border border-navy-100 bg-white px-2.5 py-1.5"
                                  >
                                    <code className="rounded bg-navy-100 px-1.5 py-0.5 text-[12px] font-mono text-navy-800">
                                      {p.name}
                                    </code>
                                    <span
                                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider ring-1 ring-inset ${
                                        p.required
                                          ? 'bg-warn-50 text-warn-700 ring-warn-500/25'
                                          : 'bg-navy-100 text-navy-600 ring-navy-300/40'
                                      }`}
                                    >
                                      {p.required ? 'required' : 'optional'}
                                    </span>
                                    <span className="text-[12.5px] text-navy-600">{p.description}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Test section */}
                          <div className="rounded-lg border border-navy-100 bg-white p-3 flex flex-col gap-2">
                            <strong className="text-[13px] text-navy-900">Test API:</strong>
                            {tool.input_parameters.filter(p => p.required).map((p) => (
                              <div key={p.name} className="flex items-center gap-2">
                                <label className="w-32 shrink-0 text-[12px] font-semibold text-navy-600">{p.name}:</label>
                                <input
                                  className={inputCls}
                                  type="text"
                                  placeholder={p.description || p.name}
                                  value={testParams[p.name] || ''}
                                  onChange={(e) => setTestParams({ ...testParams, [p.name]: e.target.value })}
                                />
                              </div>
                            ))}
                            <button
                              className={smallBtnPrimary + ' self-start'}
                              onClick={() => runTest(tool)}
                              disabled={testing === tool.id}
                            >
                              {testing === tool.id ? (
                                <Loader2 size={12} className="is-spinner" />
                              ) : (
                                <Play size={12} />
                              )}
                              {testing === tool.id ? 'Testing...' : 'Run Test'}
                            </button>
                            {testResult && testResult.id === tool.id && (
                              <div
                                className={`rounded-lg border px-3 py-2 text-[12px] ${
                                  testResult.error
                                    ? 'border-danger-200 bg-danger-50 text-danger-700'
                                    : 'border-success-200 bg-success-50 text-success-700'
                                }`}
                              >
                                {testResult.error ? (
                                  <span>Error: {testResult.error}</span>
                                ) : (
                                  <pre className="font-mono text-[12px] whitespace-pre-wrap break-all max-h-60 overflow-y-auto custom-scrollbar">
                                    {JSON.stringify(testResult.data, null, 2).slice(0, 500)}
                                  </pre>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <button className={smallBtnSecondary} onClick={() => startEdit(tool)}>
                              <Pencil size={12} /> Edit
                            </button>
                            <button className={smallBtnDanger} onClick={() => removeTool(tool.id)}>
                              <Trash2 size={12} /> Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add button */}
              {!editTool && (
                <button className={primaryBtnCls + ' mt-4'} onClick={startAdd}>
                  <Plus size={14} /> Add API Tool
                </button>
              )}

              {/* Edit/Add form */}
              {editTool && (
                <div className="mt-4 rounded-xl border border-navy-100 bg-white shadow-sm p-5 flex flex-col gap-4">
                  <h3 className="text-[15px] font-semibold text-navy-900">
                    {editId ? 'Edit API Tool' : 'Add API Tool'}
                  </h3>

                  <div>
                    <label className={labelCls}>Name *</label>
                    <input
                      className={inputCls}
                      value={editTool.name || ''}
                      onChange={(e) => setEditTool({ ...editTool, name: e.target.value })}
                      placeholder="e.g. SKU Stock Info"
                    />
                  </div>

                  <div>
                    <label className={labelCls}>Description *</label>
                    <textarea
                      className={inputCls + ' resize-y min-h-[4rem]'}
                      value={editTool.description || ''}
                      onChange={(e) => setEditTool({ ...editTool, description: e.target.value })}
                      placeholder="What does this API do? The AI reads this to decide when to use it."
                      rows={2}
                    />
                  </div>

                  <div>
                    <label className={labelCls}>Endpoint URL *</label>
                    <input
                      className={inputCls}
                      value={editTool.endpoint_url || ''}
                      onChange={(e) => setEditTool({ ...editTool, endpoint_url: e.target.value })}
                      placeholder="https://app.example.com/ediApiAction.do"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>reqCode</label>
                      <input
                        className={inputCls}
                        value={editTool.req_code || ''}
                        onChange={(e) => setEditTool({ ...editTool, req_code: e.target.value })}
                        placeholder="e.g. getSKUWiseStockInfo"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Method</label>
                      <select
                        className={inputCls}
                        value={editTool.method || 'POST'}
                        onChange={(e) => setEditTool({ ...editTool, method: e.target.value })}
                      >
                        <option value="POST">POST</option>
                        <option value="GET">GET</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>API Key</label>
                      <input
                        className={inputCls}
                        type="password"
                        value={editTool.auth_config?.apikey || ''}
                        onChange={(e) => setEditTool({
                          ...editTool,
                          auth_config: { ...(editTool.auth_config || {}), apikey: e.target.value },
                        })}
                        placeholder="APIKEY value"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Token</label>
                      <input
                        className={inputCls}
                        type="password"
                        value={editTool.auth_config?.token || ''}
                        onChange={(e) => setEditTool({
                          ...editTool,
                          auth_config: { ...(editTool.auth_config || {}), token: e.target.value },
                        })}
                        placeholder="TOKEN value"
                      />
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}>Response Data Path</label>
                    <input
                      className={inputCls}
                      value={editTool.response_path || ''}
                      onChange={(e) => setEditTool({ ...editTool, response_path: e.target.value })}
                      placeholder="e.g. PIECE_DETAILS or STOCK_DETAILS.STOCK_ARRAY"
                    />
                  </div>

                  <div>
                    <label className={labelCls}>Response Fields (comma-separated)</label>
                    <input
                      className={inputCls}
                      value={(editTool.response_fields || []).join(', ')}
                      onChange={(e) => setEditTool({
                        ...editTool,
                        response_fields: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                      })}
                      placeholder="e.g. PIECE_NO, PIECE_VALUE, WAREHOUSE_NAME"
                    />
                  </div>

                  {/* Input Parameters */}
                  <div className="rounded-lg border border-navy-100 bg-navy-50/40 p-3 flex flex-col gap-2">
                    <label className="text-[12px] font-semibold uppercase tracking-wider text-navy-500">
                      Input Parameters (what the AI must provide)
                    </label>
                    {(editTool.input_parameters || []).map((p, i) => (
                      <div key={i} className="flex items-center gap-2 flex-wrap">
                        <input
                          className={inputCls + ' flex-1 min-w-[8rem]'}
                          placeholder="Name (e.g. ITEM_ID)"
                          value={p.name}
                          onChange={(e) => updateParam(i, 'name', e.target.value)}
                        />
                        <input
                          className={inputCls + ' flex-[2] min-w-[12rem]'}
                          placeholder="Description"
                          value={p.description}
                          onChange={(e) => updateParam(i, 'description', e.target.value)}
                        />
                        <label className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-navy-700 select-none">
                          <input
                            type="checkbox"
                            checked={p.required}
                            onChange={(e) => updateParam(i, 'required', e.target.checked)}
                            className="h-4 w-4 rounded border-navy-300 text-accent-500 focus:ring-accent-100"
                          />
                          Req
                        </label>
                        <button
                          className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-navy-200 bg-white text-navy-500 hover:text-danger-600 hover:border-danger-200 hover:bg-danger-50 transition-colors"
                          onClick={() => removeParam(i)}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                    <button
                      className={smallBtnSecondary + ' self-start mt-1'}
                      onClick={addParam}
                    >
                      <Plus size={12} /> Add Parameter
                    </button>
                  </div>

                  <div>
                    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                      {editTool.enabled ? (
                        <ToggleRight size={22} className="text-success-600" />
                      ) : (
                        <ToggleLeft size={22} className="text-navy-400" />
                      )}
                      <span
                        className="text-[13.5px] font-semibold text-navy-700"
                        onClick={() => setEditTool({ ...editTool, enabled: !editTool.enabled })}
                      >
                        {editTool.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </label>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-navy-100">
                    <button className={secondaryBtnCls} onClick={cancelEdit}>Cancel</button>
                    <button className={primaryBtnCls} onClick={saveTool} disabled={saving}>
                      {saving ? <Loader2 size={14} className="is-spinner" /> : <Save size={14} />}
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {toast && (
          <div
            className={`absolute bottom-6 right-6 z-10 rounded-lg border px-4 py-2.5 text-[13px] font-semibold shadow-lg animate-fade-slide-in ${
              toast.type === 'success'
                ? 'border-success-200 bg-success-50 text-success-700'
                : 'border-danger-200 bg-danger-50 text-danger-700'
            }`}
          >
            {toast.msg}
          </div>
        )}
      </div>
    </div>
  );
}
