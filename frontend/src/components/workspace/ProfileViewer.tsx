import { useState, useEffect } from 'react';
import {
  X,
  Brain,
  Database,
  Table2,
  Columns3,
  Lightbulb,
  Link2,
  ChevronDown,
  ChevronRight,
  Hash,
  Type,
  Clock,
  FileText,
  GitBranch,
  BookOpen,
  Pencil,
  Plus,
  Trash2,
  Save,
  Loader2,
  Check,
  AlertCircle,
} from 'lucide-react';
import { getProfileStatus, updateProfileQuestions } from '../../services/api';

interface ProfileViewerProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  connectionId: string;
  connectionName: string;
}

interface ColumnProfile {
  name: string;
  type: string;
  distinct_count: number;
  null_pct: number;
  top_values: string[];
  min_val: number | null;
  max_val: number | null;
  avg_val: number | null;
}

interface TableProfile {
  name: string;
  row_count: number;
  columns: ColumnProfile[];
  sample_rows: Record<string, unknown>[];
  business_summary: string;
  analysis_angles: string[];
}

interface PlaybookEntry {
  title: string;
  question: string;
  narrative: string;
  query_template: string;
  tables: string[];
  key_columns: string[];
}

interface RawProfile {
  executive_summary: string;
  data_architecture: string;
  tables: TableProfile[];
  cross_table_insights: string[];
  suggested_questions: string[];
  directional_plan: PlaybookEntry[];
}

function isNumericType(type: string): boolean {
  const t = type.toLowerCase();
  return (
    t.includes('int') ||
    t.includes('numeric') ||
    t.includes('decimal') ||
    t.includes('float') ||
    t.includes('double') ||
    t.includes('real') ||
    t.includes('money') ||
    t.includes('bigint') ||
    t.includes('smallint')
  );
}

function getTypeIcon(type: string) {
  const t = type.toLowerCase();
  if (isNumericType(t)) return <Hash size={12} className="text-accent-500 shrink-0" />;
  if (t.includes('date') || t.includes('time') || t.includes('timestamp'))
    return <Clock size={12} className="text-amber-500 shrink-0" />;
  return <Type size={12} className="text-emerald-500 shrink-0" />;
}

export default function ProfileViewer({
  isOpen,
  onClose,
  workspaceId,
  connectionId,
  connectionName,
}: ProfileViewerProps) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<RawProfile | null>(null);
  const [generatedAt, setGeneratedAt] = useState('');
  const [durationMs, setDurationMs] = useState(0);
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());

  // Edit mode state
  const [editMode, setEditMode] = useState(false);
  const [editPlan, setEditPlan] = useState<PlaybookEntry[]>([]);
  const [editQuestions, setEditQuestions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [expandedEdit, setExpandedEdit] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen || !workspaceId || !connectionId) return;

    setLoading(true);
    getProfileStatus(workspaceId, connectionId)
      .then((res: Record<string, unknown>) => {
        if (res.raw_profile) {
          setProfile(res.raw_profile as unknown as RawProfile);
          // Expand first table by default
          const tables = (res.raw_profile as unknown as RawProfile).tables;
          if (tables.length > 0) {
            setExpandedTables(new Set([tables[0].name]));
          }
        }
        if (res.generated_at) setGeneratedAt(res.generated_at as string);
        if (res.generation_duration_ms) setDurationMs(res.generation_duration_ms as number);
      })
      .catch(() => {
        setProfile(null);
      })
      .finally(() => setLoading(false));
  }, [isOpen, workspaceId, connectionId]);

  if (!isOpen) return null;

  const toggleTable = (name: string) => {
    setExpandedTables((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const startEdit = () => {
    if (!profile) return;
    setEditPlan(profile.directional_plan.map((e) => ({ ...e, tables: [...e.tables], key_columns: [...e.key_columns] })));
    setEditQuestions([...profile.suggested_questions]);
    setEditMode(true);
    setExpandedEdit(null);
  };

  const cancelEdit = () => {
    setEditMode(false);
    setEditPlan([]);
    setExpandedEdit(null);
  };

  const updateEntry = (idx: number, field: keyof PlaybookEntry, value: string | string[]) => {
    setEditPlan((prev) => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));
  };

  const addEntry = () => {
    const newEntry: PlaybookEntry = {
      title: '', question: '', narrative: '', query_template: '',
      tables: [], key_columns: [],
    };
    setEditPlan((prev) => [...prev, newEntry]);
    setExpandedEdit(editPlan.length);
  };

  const removeEntry = (idx: number) => {
    setEditPlan((prev) => prev.filter((_, i) => i !== idx));
    setExpandedEdit(null);
  };

  const moveEntry = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= editPlan.length) return;
    setEditPlan((prev) => {
      const arr = [...prev];
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return arr;
    });
    setExpandedEdit(newIdx);
  };

  const saveEdits = async () => {
    setSaving(true);
    try {
      await updateProfileQuestions(workspaceId, connectionId, editPlan, editQuestions);
      // Update local profile
      if (profile) {
        setProfile({ ...profile, directional_plan: editPlan, suggested_questions: editQuestions });
      }
      setEditMode(false);
      setSaveToast('Questions saved successfully');
      setTimeout(() => setSaveToast(null), 3000);
    } catch (e: any) {
      setSaveToast(`Error: ${e.message}`);
      setTimeout(() => setSaveToast(null), 4000);
    }
    setSaving(false);
  };

  const totalRows = profile?.tables.reduce((sum, t) => sum + t.row_count, 0) || 0;
  const totalColumns = profile?.tables.reduce((sum, t) => sum + t.columns.length, 0) || 0;

  const formattedDate = generatedAt
    ? new Date(generatedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/50 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col animate-fade-slide-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-navy-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <Brain size={20} className="text-accent-500 shrink-0" />
            <div>
              <h2 className="text-[17px] font-semibold text-navy-900 leading-tight">
                Data Intelligence Profile
              </h2>
              <p className="text-[12.5px] text-navy-500 mt-0.5">{connectionName}</p>
            </div>
          </div>
          <button
            className="h-8 w-8 rounded-lg text-navy-400 hover:bg-navy-50 hover:text-navy-700 flex items-center justify-center transition-colors"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-navy-50/40">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-navy-500">
              <Loader2 className="is-spinner h-6 w-6 text-accent-600" />
              <span className="text-[13px]">Loading profile…</span>
            </div>
          ) : !profile ? (
            <div className="max-w-3xl mx-auto flex flex-col items-center justify-center py-16 gap-3 text-navy-400">
              <Brain size={40} className="text-navy-300" />
              <span className="text-[13px] text-navy-500">No profile data available</span>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {/* Summary strip */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-accent-50 text-accent-700 ring-1 ring-accent-200 px-2.5 py-1 text-[12px] font-medium">
                  <Database size={13} />
                  <span>{profile.tables.length} tables</span>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-accent-50 text-accent-700 ring-1 ring-accent-200 px-2.5 py-1 text-[12px] font-medium">
                  <Columns3 size={13} />
                  <span>{totalColumns} columns</span>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-accent-50 text-accent-700 ring-1 ring-accent-200 px-2.5 py-1 text-[12px] font-medium">
                  <Table2 size={13} />
                  <span>{totalRows.toLocaleString()} rows</span>
                </div>
                {durationMs > 0 && (
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-navy-100 text-navy-600 ring-1 ring-navy-200 px-2.5 py-1 text-[12px] font-medium">
                    <Clock size={13} />
                    <span>Profiled in {(durationMs / 1000).toFixed(1)}s</span>
                  </div>
                )}
                {formattedDate && (
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-navy-100 text-navy-600 ring-1 ring-navy-200 px-2.5 py-1 text-[12px] font-medium">
                    <span>{formattedDate}</span>
                  </div>
                )}
              </div>

              {/* Executive Summary */}
              {profile.executive_summary && (
                <section className="space-y-2">
                  <h3 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-navy-600">
                    <FileText size={15} className="text-accent-500" />
                    Executive Summary
                  </h3>
                  <div className="rounded-xl border border-navy-100 bg-white shadow-sm p-4">
                    <p className="is-prose text-[13.5px] text-navy-700 leading-relaxed">
                      {profile.executive_summary}
                    </p>
                  </div>
                </section>
              )}

              {/* Data Architecture */}
              {profile.data_architecture && (
                <section className="space-y-2">
                  <h3 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-navy-600">
                    <GitBranch size={15} className="text-accent-500" />
                    Data Architecture &amp; Relationships
                  </h3>
                  <div className="rounded-xl border border-navy-100 bg-white shadow-sm p-4">
                    <p className="is-prose text-[13.5px] text-navy-700 leading-relaxed">
                      {profile.data_architecture}
                    </p>
                  </div>
                </section>
              )}

              {/* Tables */}
              <section className="space-y-2">
                <h3 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-navy-600">
                  <Database size={15} className="text-accent-500" />
                  Table Intelligence
                </h3>

                <div className="space-y-2">
                  {profile.tables.map((table) => {
                    const isExpanded = expandedTables.has(table.name);
                    return (
                      <div
                        key={table.name}
                        className="rounded-xl border border-navy-100 bg-white shadow-sm overflow-hidden"
                      >
                        <button
                          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-navy-50/60 transition-colors"
                          onClick={() => toggleTable(table.name)}
                        >
                          {isExpanded ? (
                            <ChevronDown size={16} className="text-navy-400 shrink-0" />
                          ) : (
                            <ChevronRight size={16} className="text-navy-400 shrink-0" />
                          )}
                          <span className="flex-1 text-[13.5px] font-semibold text-navy-900 truncate">
                            {table.name}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-navy-100 text-navy-600 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider">
                            {table.row_count.toLocaleString()} rows
                          </span>
                        </button>

                        {isExpanded && (
                          <div className="border-t border-navy-100 px-4 py-3 space-y-4">
                            {table.business_summary && (
                              <p className="is-prose text-[13px] text-navy-700 leading-relaxed">
                                {table.business_summary}
                              </p>
                            )}

                            {/* Columns */}
                            <div className="rounded-lg border border-navy-100 overflow-hidden">
                              <div className="grid grid-cols-[auto_1fr_auto_auto] gap-3 items-center px-4 py-2 bg-navy-50/60 text-[11px] font-semibold uppercase tracking-wider text-navy-500">
                                <span className="w-3" />
                                <span>Column</span>
                                <span>Nulls</span>
                                <span>Distinct</span>
                              </div>
                              {table.columns
                                .filter((c) => !c.name.startsWith('_'))
                                .map((col) => (
                                  <div
                                    key={col.name}
                                    className="grid grid-cols-[auto_1fr_auto_auto] gap-3 items-center border-t border-navy-100 px-4 py-2 text-[12.5px]"
                                  >
                                    {getTypeIcon(col.type)}
                                    <div className="min-w-0">
                                      <div className="flex items-baseline gap-2">
                                        <span className="font-semibold text-navy-900 truncate">
                                          {col.name}
                                        </span>
                                        <span className="text-[11px] text-navy-500 font-mono truncate">
                                          {col.type}
                                        </span>
                                      </div>
                                      {col.top_values.length > 0 && (
                                        <div className="text-[11.5px] text-navy-500 mt-0.5 truncate">
                                          <span className="text-navy-400">Values: </span>
                                          {col.top_values.slice(0, 5).join(', ')}
                                          {col.distinct_count > 5 && (
                                            <span className="text-navy-400">
                                              {' '}+{col.distinct_count - 5} more
                                            </span>
                                          )}
                                        </div>
                                      )}
                                      {col.min_val !== null && (
                                        <div className="text-[11.5px] text-navy-500 mt-0.5">
                                          <span className="text-navy-400">Range: </span>
                                          {col.min_val} – {col.max_val}
                                          {col.avg_val !== null && (
                                            <span className="text-navy-400"> (avg: {col.avg_val})</span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                    <span
                                      className={
                                        col.null_pct > 10
                                          ? 'inline-flex items-center rounded-full bg-warn-50 text-warn-700 ring-1 ring-warn-200 px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider'
                                          : 'inline-flex items-center rounded-full bg-navy-100 text-navy-600 px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider'
                                      }
                                    >
                                      {col.null_pct}%
                                    </span>
                                    <span className="inline-flex items-center rounded-full bg-navy-100 text-navy-600 px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider">
                                      {col.distinct_count.toLocaleString()}
                                    </span>
                                  </div>
                                ))}
                            </div>

                            {/* Sample rows */}
                            {table.sample_rows.length > 0 && (
                              <div className="rounded-lg border border-navy-100 bg-navy-50/60 p-3">
                                <div className="text-[11px] font-semibold uppercase tracking-wider text-navy-500 mb-1.5">
                                  Sample record
                                </div>
                                <pre className="text-[11.5px] text-navy-700 font-mono whitespace-pre-wrap break-words overflow-x-auto custom-scrollbar">
                                  {JSON.stringify(table.sample_rows[0], null, 2)}
                                </pre>
                              </div>
                            )}

                            {/* Analysis angles */}
                            {table.analysis_angles.length > 0 && (
                              <div className="rounded-lg border-l-[3px] border-l-accent-500 bg-accent-50/40 p-3">
                                <div className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-accent-700 mb-1.5">
                                  <Lightbulb size={13} />
                                  Analysis angles
                                </div>
                                <ul className="space-y-1 text-[12.5px] text-navy-700 list-disc pl-5">
                                  {table.analysis_angles.map((angle, i) => (
                                    <li key={i}>{angle}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Cross-table insights */}
              {profile.cross_table_insights.length > 0 && (
                <section className="space-y-2">
                  <h3 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-navy-600">
                    <Link2 size={15} className="text-accent-500" />
                    Cross-Table Relationships
                  </h3>
                  <div className="rounded-lg border-l-[3px] border-l-accent-500 bg-accent-50/40 p-3">
                    <div className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-accent-700 mb-1.5">
                      <Lightbulb size={13} />
                      Key findings
                    </div>
                    <ul className="space-y-1 text-[12.5px] text-navy-700 list-disc pl-5">
                      {profile.cross_table_insights.map((insight, i) => (
                        <li key={i}>{insight}</li>
                      ))}
                    </ul>
                  </div>
                </section>
              )}

              {/* Intelligence Playbook */}
              <section className="space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-navy-600">
                    <BookOpen size={15} className="text-accent-500" />
                    Intelligence Playbook
                    <span className="text-[11.5px] font-medium normal-case tracking-normal text-navy-400 ml-1">
                      ({editMode ? editPlan.length : (profile.directional_plan?.length || 0)} questions)
                    </span>
                  </h3>
                  {!editMode ? (
                    <button
                      className="inline-flex items-center gap-1.5 rounded-lg border border-navy-200 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-navy-700 hover:border-accent-300 hover:text-accent-700 transition-colors"
                      onClick={startEdit}
                    >
                      <Pencil size={13} /> Edit Questions
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        className="inline-flex items-center rounded-lg border border-navy-200 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-navy-700 hover:bg-navy-50 transition-colors"
                        onClick={cancelEdit}
                      >
                        Cancel
                      </button>
                      <button
                        className="inline-flex items-center gap-1.5 rounded-lg bg-accent-500 hover:bg-accent-600 text-white px-3 py-1.5 text-[12.5px] font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        onClick={saveEdits}
                        disabled={saving}
                      >
                        {saving ? <Loader2 size={13} className="is-spinner" /> : <Save size={13} />}
                        {saving ? 'Saving…' : 'Save Changes'}
                      </button>
                    </div>
                  )}
                </div>

                {editMode ? (
                  /* ── EDIT MODE ── */
                  <div className="space-y-2">
                    {editPlan.map((entry, i) => {
                      const isExpanded = expandedEdit === i;
                      return (
                        <div
                          key={i}
                          className={`rounded-xl border bg-white shadow-sm transition-colors ${
                            isExpanded ? 'border-accent-300' : 'border-navy-100'
                          }`}
                        >
                          <div
                            className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                            onClick={() => setExpandedEdit(isExpanded ? null : i)}
                          >
                            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-50 text-accent-700 ring-1 ring-accent-200 text-[11.5px] font-semibold">
                              {i + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="text-[13.5px] font-semibold text-navy-900 truncate">
                                {entry.title || (
                                  <span className="text-navy-300 italic font-normal">Untitled question…</span>
                                )}
                              </div>
                              <div className="text-[12px] text-navy-500 truncate mt-0.5">
                                {entry.question || 'No question text'}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                className="h-7 w-7 rounded-md text-navy-400 hover:bg-navy-50 hover:text-navy-700 disabled:opacity-40 disabled:hover:bg-transparent flex items-center justify-center text-[10px]"
                                title="Move up"
                                onClick={(e) => { e.stopPropagation(); moveEntry(i, -1); }}
                                disabled={i === 0}
                              >
                                &#9650;
                              </button>
                              <button
                                className="h-7 w-7 rounded-md text-navy-400 hover:bg-navy-50 hover:text-navy-700 disabled:opacity-40 disabled:hover:bg-transparent flex items-center justify-center text-[10px]"
                                title="Move down"
                                onClick={(e) => { e.stopPropagation(); moveEntry(i, 1); }}
                                disabled={i === editPlan.length - 1}
                              >
                                &#9660;
                              </button>
                              <button
                                className="h-7 w-7 rounded-md text-danger-600 hover:bg-danger-50 flex items-center justify-center"
                                title="Remove"
                                onClick={(e) => { e.stopPropagation(); removeEntry(i); }}
                              >
                                <Trash2 size={13} />
                              </button>
                              <ChevronDown
                                size={16}
                                className={`text-navy-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                              />
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="border-t border-navy-100 px-4 py-4 space-y-3">
                              <label className="block">
                                <span className="block text-[11.5px] font-semibold uppercase tracking-wider text-navy-600 mb-1">
                                  Title
                                </span>
                                <input
                                  type="text"
                                  className="w-full rounded-lg border border-navy-200 bg-white px-3 py-1.5 text-[13px] text-navy-900 placeholder:text-navy-300 focus:outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-100"
                                  value={entry.title}
                                  placeholder="e.g. Top 10 Customers by Invoice Amount"
                                  onChange={(e) => updateEntry(i, 'title', e.target.value)}
                                />
                              </label>
                              <label className="block">
                                <span className="block text-[11.5px] font-semibold uppercase tracking-wider text-navy-600 mb-1">
                                  Question
                                </span>
                                <input
                                  type="text"
                                  className="w-full rounded-lg border border-navy-200 bg-white px-3 py-1.5 text-[13px] text-navy-900 placeholder:text-navy-300 focus:outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-100"
                                  value={entry.question}
                                  placeholder="e.g. Which are our top 10 customers by total invoice amount?"
                                  onChange={(e) => updateEntry(i, 'question', e.target.value)}
                                />
                              </label>
                              <label className="block">
                                <span className="block text-[11.5px] font-semibold uppercase tracking-wider text-navy-600 mb-1">
                                  Description / Narrative
                                </span>
                                <textarea
                                  className="w-full rounded-lg border border-navy-200 bg-white px-3 py-1.5 text-[13px] text-navy-900 placeholder:text-navy-300 focus:outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-100 resize-y"
                                  rows={3}
                                  value={entry.narrative}
                                  placeholder="Describe what this query does, data caveats, and how to interpret results…"
                                  onChange={(e) => updateEntry(i, 'narrative', e.target.value)}
                                />
                              </label>
                              <label className="block">
                                <span className="block text-[11.5px] font-semibold uppercase tracking-wider text-navy-600 mb-1">
                                  SQL Query Template
                                </span>
                                <textarea
                                  className="w-full rounded-lg border border-navy-200 bg-navy-50/40 px-3 py-1.5 text-[12px] font-mono text-navy-900 placeholder:text-navy-300 focus:outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-100 resize-y"
                                  rows={6}
                                  value={entry.query_template}
                                  placeholder={"SELECT\n  cm.customer_name,\n  SUM(i.inv_amount) AS total\nFROM invoice i\nJOIN customer_master cm ON i.customer_id = cm.customer_id\nGROUP BY cm.customer_name\nORDER BY total DESC\nLIMIT 10;"}
                                  onChange={(e) => updateEntry(i, 'query_template', e.target.value)}
                                />
                              </label>
                              <div className="flex gap-3">
                                <label className="block flex-1">
                                  <span className="block text-[11.5px] font-semibold uppercase tracking-wider text-navy-600 mb-1">
                                    Tables <span className="normal-case tracking-normal text-navy-400 font-normal">(comma-separated)</span>
                                  </span>
                                  <input
                                    type="text"
                                    className="w-full rounded-lg border border-navy-200 bg-white px-3 py-1.5 text-[13px] text-navy-900 placeholder:text-navy-300 focus:outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-100"
                                    value={entry.tables.join(', ')}
                                    placeholder="invoice, customer_master"
                                    onChange={(e) => updateEntry(i, 'tables', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                                  />
                                </label>
                                <label className="block flex-1">
                                  <span className="block text-[11.5px] font-semibold uppercase tracking-wider text-navy-600 mb-1">
                                    Key Columns <span className="normal-case tracking-normal text-navy-400 font-normal">(comma-separated)</span>
                                  </span>
                                  <input
                                    type="text"
                                    className="w-full rounded-lg border border-navy-200 bg-white px-3 py-1.5 text-[13px] text-navy-900 placeholder:text-navy-300 focus:outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-100"
                                    value={entry.key_columns.join(', ')}
                                    placeholder="customer_id, inv_amount"
                                    onChange={(e) => updateEntry(i, 'key_columns', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                                  />
                                </label>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    <button
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-navy-200 bg-white hover:border-accent-300 hover:bg-accent-50/40 hover:text-accent-700 text-navy-600 px-3 py-2.5 text-[12.5px] font-semibold transition-colors"
                      onClick={addEntry}
                    >
                      <Plus size={16} /> Add New Question
                    </button>
                  </div>
                ) : (
                  /* ── VIEW MODE ── */
                  profile.directional_plan && profile.directional_plan.length > 0 ? (
                    <div className="space-y-2">
                      {profile.directional_plan.map((entry, i) => (
                        <div
                          key={i}
                          className="rounded-xl border border-navy-100 bg-white shadow-sm p-4 space-y-2"
                        >
                          <div className="flex items-start gap-3">
                            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-50 text-accent-700 ring-1 ring-accent-200 text-[11.5px] font-semibold mt-0.5">
                              {i + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-[14px] font-semibold text-navy-900">
                                {entry.title || `Analysis ${i + 1}`}
                              </h4>
                              <p className="text-[12.5px] text-navy-500 mt-0.5">{entry.question}</p>
                            </div>
                          </div>
                          {entry.narrative && (
                            <p className="is-prose text-[13px] text-navy-700 leading-relaxed pl-9">
                              {entry.narrative}
                            </p>
                          )}
                          {entry.query_template && (
                            <div className="pl-9">
                              <div className="text-[11px] font-semibold uppercase tracking-wider text-navy-500 mb-1">
                                Query template
                              </div>
                              <pre className="rounded-lg border border-navy-100 bg-navy-50/60 p-3 text-[11.5px] font-mono text-navy-800 whitespace-pre-wrap break-words overflow-x-auto custom-scrollbar">
                                {entry.query_template}
                              </pre>
                            </div>
                          )}
                          {(entry.tables.length > 0 || entry.key_columns.length > 0) && (
                            <div className="flex flex-wrap gap-1.5 pl-9">
                              {entry.tables.length > 0 && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-navy-100 text-navy-700 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider">
                                  <Database size={11} />
                                  {entry.tables.join(', ')}
                                </span>
                              )}
                              {entry.key_columns.length > 0 && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-navy-100 text-navy-700 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider">
                                  <Columns3 size={11} />
                                  {entry.key_columns.join(', ')}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : profile.suggested_questions.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {profile.suggested_questions.map((q, i) => (
                        <button
                          key={i}
                          type="button"
                          className="rounded-lg border border-navy-100 bg-navy-50/60 px-3 py-1.5 text-[12.5px] text-navy-700 hover:border-accent-200 hover:bg-accent-50 hover:text-accent-700 transition-colors text-left"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[13px] text-navy-400">
                      No questions yet. Click "Edit Questions" to add some.
                    </p>
                  )
                )}
              </section>

              {/* Save toast */}
              {saveToast && (
                <div
                  className={
                    saveToast.startsWith('Error')
                      ? 'flex items-center gap-2 rounded-xl bg-danger-50 text-danger-700 ring-1 ring-inset ring-danger-500/20 p-4 text-[13px]'
                      : 'flex items-center gap-2 rounded-xl bg-success-50 text-success-700 ring-1 ring-inset ring-success-500/20 p-4 text-[13px]'
                  }
                >
                  {saveToast.startsWith('Error') ? (
                    <AlertCircle size={14} className="shrink-0" />
                  ) : (
                    <Check size={14} className="shrink-0" />
                  )}
                  <span>{saveToast}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
