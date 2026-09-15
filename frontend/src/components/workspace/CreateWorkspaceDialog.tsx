import { useState, useRef, useEffect } from 'react';
import {
  X, BarChart3, Users, Settings, Wallet, Database, FolderOpen,
  ArrowLeft, ArrowRight, Upload, FileText, Key, ChevronDown, ChevronRight,
  Check, Loader2, CheckCircle2, AlertCircle, Server, Globe, Layers,
  Brain, Sparkles,
} from 'lucide-react';
import type {
  ConnectionConfig, ConnectorType, SchemaInfo,
  SqlConnectionConfig, CosmosDbConnectionConfig, MongoDbConnectionConfig,
} from '../../types/connection';
import {
  addConnection, testConnection, getConnectionSchema,
  generateProfile, createProfileEventSource,
} from '../../services/api';

/* ─── Result type ─── */
export interface CreateWorkspaceResult {
  name: string;
  description: string;
  icon: string;
  connection?: {
    id: string;
    config: ConnectionConfig;
    selectedTables: string[];
    schema?: SchemaInfo;
  };
}

/* ─── Constants ─── */
type WizardStep =
  | 'workspace-info'
  | 'choose-type'
  | 'configure'
  | 'test'
  | 'schema'
  | 'select-tables'
  | 'profiling';

const WIZARD_STEPS: { key: WizardStep; label: string }[] = [
  { key: 'workspace-info', label: 'Workspace' },
  { key: 'choose-type', label: 'Source' },
  { key: 'configure', label: 'Configure' },
  { key: 'test', label: 'Test' },
  { key: 'schema', label: 'Schema' },
  { key: 'select-tables', label: 'Tables' },
  { key: 'profiling', label: 'Profiling' },
];

const WS_ICONS = [
  { id: 'bar-chart-3', icon: BarChart3, label: 'Analytics' },
  { id: 'users', icon: Users, label: 'Customers' },
  { id: 'settings', icon: Settings, label: 'Operations' },
  { id: 'wallet', icon: Wallet, label: 'Finance' },
  { id: 'database', icon: Database, label: 'Database' },
  { id: 'folder', icon: FolderOpen, label: 'General' },
];

/* Per-connector tint classes for the icon tile (bg + text) */
const CONNECTOR_TYPES: {
  type: ConnectorType;
  label: string;
  desc: string;
  tintClass: string;
}[] = [
  { type: 'postgresql', label: 'PostgreSQL', desc: 'Relational database', tintClass: 'bg-accent-50 text-accent-700' },
  { type: 'mysql', label: 'MySQL', desc: 'Relational database', tintClass: 'bg-warn-50 text-warn-700' },
  { type: 'sqlserver', label: 'SQL Server', desc: 'Microsoft SQL', tintClass: 'bg-danger-50 text-danger-600' },
  { type: 'cosmosdb', label: 'Cosmos DB', desc: 'Azure NoSQL', tintClass: 'bg-accent-50 text-accent-700' },
  { type: 'mongodb', label: 'MongoDB', desc: 'Document database', tintClass: 'bg-success-50 text-success-700' },
  { type: 'file', label: 'File Upload', desc: 'CSV, Excel, JSON', tintClass: 'bg-navy-100 text-navy-700' },
];

const PORT_DEFAULTS: Record<string, number> = { postgresql: 5432, mysql: 3306, sqlserver: 1433 };

function getConnectorIcon(type: ConnectorType) {
  if (type === 'file') return <Upload size={22} />;
  if (type === 'cosmosdb') return <Globe size={22} />;
  if (type === 'mongodb') return <Layers size={22} />;
  return <Server size={22} />;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function detectFileFormat(fileName: string): 'csv' | 'excel' | 'json' {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'json') return 'json';
  if (ext === 'xlsx' || ext === 'xls') return 'excel';
  return 'csv';
}

/* ─── Profiling step messages ─── */
const PROFILING_STEPS = [
  { icon: Database, text: 'Discovering schema...', color: '#0EA5E9' },
  { icon: BarChart3, text: 'Sampling & profiling tables...', color: '#8b5cf6' },
  { icon: Brain, text: 'Detecting data nuances...', color: '#F59E0B' },
  { icon: Sparkles, text: 'Building directional analysis plan...', color: '#10B981' },
];

/* ─── Shared class bundles ─── */
const INPUT_CLASS =
  'w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-[13.5px] text-navy-800 placeholder:text-navy-400 focus:outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-100 transition-colors';
const LABEL_CLASS =
  'mb-1.5 block text-[12px] font-semibold uppercase tracking-wider text-navy-500';
const PRIMARY_BTN =
  'bg-accent-500 hover:bg-accent-600 disabled:bg-navy-200 disabled:text-navy-400 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-[13.5px] font-semibold inline-flex items-center gap-2 transition-colors';
const SECONDARY_BTN =
  'border border-navy-200 bg-white text-navy-700 hover:bg-navy-50 px-4 py-2 rounded-lg text-[13.5px] font-semibold inline-flex items-center gap-2 transition-colors';

/* ─── Props ─── */
interface CreateWorkspaceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Creates workspace + connection. Returns the workspace ID. */
  onCreate: (data: CreateWorkspaceResult) => string | Promise<string>;
  /** Called when profiling completes (or is skipped) — parent should navigate. */
  onNavigate: (workspaceId: string) => void;
}

/* ─── Component ─── */
export default function CreateWorkspaceDialog({ isOpen, onClose, onCreate, onNavigate }: CreateWorkspaceDialogProps) {
  // Wizard step
  const [step, setStep] = useState<WizardStep>('workspace-info');

  // Step 1: Workspace info
  const [wsName, setWsName] = useState('');
  const [wsDescription, setWsDescription] = useState('');
  const [wsIcon, setWsIcon] = useState('bar-chart-3');

  // Step 2+: Connection type
  const [connectorType, setConnectorType] = useState<ConnectorType | null>(null);

  // SQL form fields
  const [connName, setConnName] = useState('');
  const [host, setHost] = useState('localhost');
  const [port, setPort] = useState(5432);
  const [database, setDatabase] = useState('');
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [ssl, setSsl] = useState(false);

  // CosmoDB
  const [endpoint, setEndpoint] = useState('');
  const [accountKey, setAccountKey] = useState('');
  const [container, setContainer] = useState('');

  // MongoDB
  const [connectionString, setConnectionString] = useState('');
  const [authSource, setAuthSource] = useState('');

  // File
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Test
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState('');

  // Schema
  const [schema, setSchema] = useState<SchemaInfo | null>(null);
  const [expandedTable, setExpandedTable] = useState<string | null>(null);

  // Table selection
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());

  // Loading
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Connection ID created during test step
  const [testedConnectionId, setTestedConnectionId] = useState<string | null>(null);

  // Profiling state
  const [createdWorkspaceId, setCreatedWorkspaceId] = useState<string | null>(null);
  const [profilingStatus, setProfilingStatus] = useState<'idle' | 'running' | 'ready' | 'failed'>('idle');
  const [profilingMessage, setProfilingMessage] = useState('');
  const [profilingStepIndex, setProfilingStepIndex] = useState(0);
  const [profilingError, setProfilingError] = useState('');

  // Cleanup SSE on unmount
  const eventSourceRef = useRef<EventSource | null>(null);
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  if (!isOpen) return null;

  /* ─── Reset ─── */
  const resetAll = () => {
    setStep('workspace-info');
    setWsName('');
    setWsDescription('');
    setWsIcon('bar-chart-3');
    setConnectorType(null);
    setConnName('');
    setHost('localhost');
    setPort(5432);
    setDatabase('');
    setUser('');
    setPassword('');
    setSsl(false);
    setEndpoint('');
    setAccountKey('');
    setContainer('');
    setConnectionString('');
    setAuthSource('');
    setUploadedFile(null);
    setDragActive(false);
    setTestStatus('idle');
    setTestError('');
    setSchema(null);
    setExpandedTable(null);
    setSelectedTables(new Set());
    setIsSubmitting(false);
    setTestedConnectionId(null);
    setCreatedWorkspaceId(null);
    setProfilingStatus('idle');
    setProfilingMessage('');
    setProfilingStepIndex(0);
    setProfilingError('');
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  };

  const handleClose = () => {
    resetAll();
    onClose();
  };

  /* ─── Type selection ─── */
  const handleSelectType = (type: ConnectorType) => {
    setConnectorType(type);
    if (['postgresql', 'mysql', 'sqlserver'].includes(type)) {
      setPort(PORT_DEFAULTS[type] || 5432);
    }
    setStep('configure');
  };

  /* ─── Build config ─── */
  const buildConfig = (): ConnectionConfig | null => {
    if (!connectorType) return null;

    if (connectorType === 'postgresql' || connectorType === 'mysql' || connectorType === 'sqlserver') {
      return {
        connectorType,
        name: connName || database,
        host,
        port,
        database,
        user,
        password,
        ssl,
      } as SqlConnectionConfig;
    }
    if (connectorType === 'cosmosdb') {
      return {
        connectorType: 'cosmosdb',
        name: connName || database,
        endpoint,
        accountKey,
        database,
        container: container || undefined,
      } as CosmosDbConnectionConfig;
    }
    if (connectorType === 'mongodb') {
      return {
        connectorType: 'mongodb',
        name: connName || database,
        connectionString,
        database,
        authSource: authSource || undefined,
      } as MongoDbConnectionConfig;
    }
    if (connectorType === 'file' && uploadedFile) {
      return {
        connectorType: 'file',
        name: connName || uploadedFile.name,
        fileSource: {
          fileName: uploadedFile.name,
          fileSize: uploadedFile.size,
          fileFormat: detectFileFormat(uploadedFile.name),
          file: uploadedFile,
        },
      };
    }
    return null;
  };

  const canProceedFromConfigure = (): boolean => {
    if (!connectorType) return false;
    if (['postgresql', 'mysql', 'sqlserver'].includes(connectorType)) {
      return !!database && !!user && !!password;
    }
    if (connectorType === 'cosmosdb') return !!endpoint && !!accountKey && !!database;
    if (connectorType === 'mongodb') return !!connectionString && !!database;
    if (connectorType === 'file') return !!uploadedFile;
    return false;
  };

  /* ─── Test ─── */
  const handleTest = async () => {
    setTestStatus('testing');
    setTestError('');

    try {
      // 1. Register connection with backend
      const config = buildConfig();
      if (!config) throw new Error('Invalid connection configuration');
      const rawInfo = await addConnection(config);
      setTestedConnectionId(rawInfo.id);

      // 2. Test the connection
      const testResult = await testConnection(rawInfo.id);
      if (testResult.status !== 'connected') {
        throw new Error('Database connection failed. Check your credentials and try again.');
      }

      setTestStatus('success');

      // 3. Fetch real schema
      const rawSchema = await getConnectionSchema(rawInfo.id);

      // Map backend snake_case fields to frontend camelCase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const realSchema: SchemaInfo = {
        tables: (rawSchema.tables as any[]).map((t) => ({
          name: String(t.name ?? ''),
          rowCount: t.rowCount ?? t.row_count ?? 0,
          columns: ((t.columns ?? []) as any[]).map((c: any) => ({
            name: String(c.name ?? ''),
            type: String(c.type ?? ''),
            isPrimaryKey: Boolean(c.isPrimaryKey ?? c.is_primary_key ?? false),
          })),
        })),
      };

      setSchema(realSchema);
      setSelectedTables(new Set(realSchema.tables.map((t) => t.name)));
      setStep('schema');
    } catch (err) {
      setTestStatus('error');
      setTestError(err instanceof Error ? err.message : 'Connection failed');
    }
  };

  const handleRetryTest = () => {
    setTestStatus('idle');
    setTestError('');
    setStep('configure');
  };

  /* ─── Finish: Create workspace + start profiling ─── */
  const handleFinish = async () => {
    const config = buildConfig();
    if (!config || !testedConnectionId) return;
    setIsSubmitting(true);

    // 1. Create workspace (returns workspace ID)
    const wsId = await onCreate({
      name: wsName.trim(),
      description: wsDescription.trim(),
      icon: wsIcon,
      connection: {
        id: testedConnectionId,
        config,
        selectedTables: Array.from(selectedTables),
        schema: schema || undefined,
      },
    });

    setCreatedWorkspaceId(wsId);
    setIsSubmitting(false);

    // 2. Transition to profiling step
    setStep('profiling');
    setProfilingStatus('running');
    setProfilingStepIndex(0);
    setProfilingMessage('Starting data profiling...');

    // 3. Kick off profiling in the backend
    try {
      await generateProfile(wsId, testedConnectionId);

      // 4. Stream progress via SSE
      const es = createProfileEventSource(wsId, testedConnectionId);
      eventSourceRef.current = es;

      es.addEventListener('thinking', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          const content = data.content || '';
          setProfilingMessage(content);

          // Map step names to step indices for progress display
          if (data.step === 'discover') setProfilingStepIndex(0);
          else if (data.step === 'sampling') setProfilingStepIndex(1);
          else if (data.step === 'analyzing') {
            // Nuance detection vs plan building
            if (content.toLowerCase().includes('nuance')) setProfilingStepIndex(2);
            else setProfilingStepIndex(3);
          }
          else if (data.step === 'complete') setProfilingStepIndex(4);
        } catch { /* ignore parse errors */ }
      });

      es.addEventListener('error', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          setProfilingError(data.message || 'Profiling failed');
          setProfilingStatus('failed');
        } catch { /* ignore */ }
      });

      es.addEventListener('done', () => {
        es.close();
        eventSourceRef.current = null;
        setProfilingStatus('ready');
        setProfilingMessage('Intelligence profile ready!');
        setProfilingStepIndex(4);
      });

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;
        // If we haven't received a done event, mark as ready anyway
        // (the profile may have completed before SSE connected)
        setProfilingStatus((prev) => prev === 'running' ? 'ready' : prev);
        setProfilingMessage('Profile generation completed.');
        setProfilingStepIndex(4);
      };
    } catch (err) {
      setProfilingStatus('failed');
      setProfilingError(err instanceof Error ? err.message : 'Failed to start profiling');
    }
  };

  /* ─── Navigate to workspace (after profiling) ─── */
  const handleOpenWorkspace = () => {
    const wsId = createdWorkspaceId;
    resetAll();
    if (wsId) onNavigate(wsId);
  };

  /* ─── File handlers ─── */
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) setUploadedFile(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setUploadedFile(file);
  };

  /* ─── Table helpers ─── */
  const toggleTable = (tableName: string) => {
    setSelectedTables((prev) => {
      const next = new Set(prev);
      if (next.has(tableName)) next.delete(tableName);
      else next.add(tableName);
      return next;
    });
  };

  const selectAllTables = () => {
    if (schema) setSelectedTables(new Set(schema.tables.map((t) => t.name)));
  };
  const deselectAllTables = () => setSelectedTables(new Set());

  /* ─── Stepper helpers ─── */
  const currentStepIndex = WIZARD_STEPS.findIndex((s) => s.key === step);

  const goBack = () => {
    if (step === 'choose-type') setStep('workspace-info');
    else if (step === 'configure') { setStep('choose-type'); setConnectorType(null); }
    else if (step === 'test') setStep('configure');
    else if (step === 'schema') setStep('test');
    else if (step === 'select-tables') setStep('schema');
    // No going back from profiling — workspace is already created
  };

  /* ─── Render ─── */
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/50 backdrop-blur-sm animate-fade-in p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-navy-100">
          <h2 className="text-[17px] font-semibold text-navy-900">
            {step === 'workspace-info'
              ? 'Create Workspace'
              : step === 'profiling'
                ? 'Intelligence Profiling'
                : 'Connect Data Source'}
          </h2>
          {step !== 'profiling' && (
            <button
              onClick={handleClose}
              className="h-8 w-8 rounded-lg text-navy-400 hover:bg-navy-50 hover:text-navy-700 inline-flex items-center justify-center transition-colors"
              aria-label="Close dialog"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-1 px-6 py-3 border-b border-navy-100 bg-navy-50/50 overflow-x-auto">
          {WIZARD_STEPS.map((s, i) => {
            const isActive = s.key === step;
            const isDone = currentStepIndex > i;
            const pillClasses = isActive
              ? 'bg-accent-500 text-white'
              : isDone
                ? 'bg-success-500 text-white'
                : 'bg-navy-100 text-navy-400';
            return (
              <div key={s.key} className="flex items-center gap-1 shrink-0">
                {i > 0 && (
                  <div
                    className={`h-px w-4 ${isDone || isActive ? 'bg-success-500' : 'bg-navy-200'}`}
                  />
                )}
                <div
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${pillClasses}`}
                >
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-[10px]">
                    {isDone ? <Check size={10} /> : i + 1}
                  </span>
                  <span>{s.label}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {/* ─── Step 1: Workspace Info ─── */}
          {step === 'workspace-info' && (
            <div className="flex flex-col gap-5">
              <div>
                <label className={LABEL_CLASS}>Workspace Name</label>
                <input
                  type="text"
                  value={wsName}
                  onChange={(e) => setWsName(e.target.value)}
                  placeholder="e.g., Sales Analytics"
                  autoFocus
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label className={LABEL_CLASS}>Description</label>
                <textarea
                  value={wsDescription}
                  onChange={(e) => setWsDescription(e.target.value)}
                  placeholder="Brief description of this workspace..."
                  rows={2}
                  className={`${INPUT_CLASS} resize-none`}
                />
              </div>

              <div>
                <label className={LABEL_CLASS}>Icon</label>
                <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
                  {WS_ICONS.map(({ id, icon: Icon, label }) => {
                    const selected = wsIcon === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setWsIcon(id)}
                        title={label}
                        className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-colors ${
                          selected
                            ? 'border-accent-500 bg-accent-50 ring-2 ring-accent-100 text-accent-700'
                            : 'border-navy-200 bg-white text-navy-600 hover:border-accent-300 hover:bg-accent-50/50'
                        }`}
                      >
                        <Icon size={20} />
                        <span className="text-[11px] font-medium">{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ─── Step 2: Choose Type ─── */}
          {step === 'choose-type' && (
            <>
              <p className="mb-4 text-[12px] font-semibold uppercase tracking-wider text-navy-500">
                Choose Data Source
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {CONNECTOR_TYPES.map((ct) => (
                  <button
                    key={ct.type}
                    className="group flex flex-col items-start gap-2 rounded-xl border border-navy-200 bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:border-accent-300 hover:shadow-md"
                    onClick={() => handleSelectType(ct.type)}
                  >
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-lg ${ct.tintClass}`}
                    >
                      {getConnectorIcon(ct.type)}
                    </div>
                    <span className="text-[13.5px] font-semibold text-navy-900">{ct.label}</span>
                    <span className="text-[11.5px] text-navy-500">{ct.desc}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ─── Step 3: Configure ─── */}
          {step === 'configure' && connectorType && (
            <>
              {/* SQL Connectors */}
              {['postgresql', 'mysql', 'sqlserver'].includes(connectorType) && (
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className={LABEL_CLASS}>Connection Name</label>
                      <input
                        type="text"
                        value={connName}
                        onChange={(e) => setConnName(e.target.value)}
                        placeholder="My Database"
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label className={LABEL_CLASS}>Host</label>
                      <input
                        type="text"
                        value={host}
                        onChange={(e) => setHost(e.target.value)}
                        placeholder="localhost"
                        className={INPUT_CLASS}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <label className={LABEL_CLASS}>Port</label>
                      <input
                        type="number"
                        value={port}
                        onChange={(e) => setPort(parseInt(e.target.value) || port)}
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={LABEL_CLASS}>Database</label>
                      <input
                        type="text"
                        value={database}
                        onChange={(e) => setDatabase(e.target.value)}
                        placeholder="mydb"
                        className={INPUT_CLASS}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className={LABEL_CLASS}>Username</label>
                      <input
                        type="text"
                        value={user}
                        onChange={(e) => setUser(e.target.value)}
                        placeholder="postgres"
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label className={LABEL_CLASS}>Password</label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className={INPUT_CLASS}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-navy-100 bg-navy-50/50 px-4 py-3">
                    <span className="text-[13px] font-medium text-navy-700">Use SSL</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={ssl}
                      onClick={() => setSsl(!ssl)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        ssl ? 'bg-accent-500' : 'bg-navy-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                          ssl ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )}

              {/* Cosmos DB */}
              {connectorType === 'cosmosdb' && (
                <div className="flex flex-col gap-4">
                  <div>
                    <label className={LABEL_CLASS}>Connection Name</label>
                    <input
                      type="text"
                      value={connName}
                      onChange={(e) => setConnName(e.target.value)}
                      placeholder="My Cosmos DB"
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Endpoint</label>
                    <input
                      type="text"
                      value={endpoint}
                      onChange={(e) => setEndpoint(e.target.value)}
                      placeholder="https://myaccount.documents.azure.com:443/"
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Account Key</label>
                    <input
                      type="password"
                      value={accountKey}
                      onChange={(e) => setAccountKey(e.target.value)}
                      placeholder="Primary or secondary key"
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className={LABEL_CLASS}>Database</label>
                      <input
                        type="text"
                        value={database}
                        onChange={(e) => setDatabase(e.target.value)}
                        placeholder="mydb"
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label className={LABEL_CLASS}>
                        Container <span className="font-normal normal-case text-navy-300">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={container}
                        onChange={(e) => setContainer(e.target.value)}
                        placeholder="mycontainer"
                        className={INPUT_CLASS}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* MongoDB */}
              {connectorType === 'mongodb' && (
                <div className="flex flex-col gap-4">
                  <div>
                    <label className={LABEL_CLASS}>Connection Name</label>
                    <input
                      type="text"
                      value={connName}
                      onChange={(e) => setConnName(e.target.value)}
                      placeholder="My MongoDB"
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Connection String</label>
                    <input
                      type="text"
                      value={connectionString}
                      onChange={(e) => setConnectionString(e.target.value)}
                      placeholder="mongodb+srv://user:pass@cluster.mongodb.net/"
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className={LABEL_CLASS}>Database</label>
                      <input
                        type="text"
                        value={database}
                        onChange={(e) => setDatabase(e.target.value)}
                        placeholder="mydb"
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label className={LABEL_CLASS}>
                        Auth Source <span className="font-normal normal-case text-navy-300">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={authSource}
                        onChange={(e) => setAuthSource(e.target.value)}
                        placeholder="admin"
                        className={INPUT_CLASS}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* File Upload */}
              {connectorType === 'file' && (
                <div className="flex flex-col gap-4">
                  <div>
                    <label className={LABEL_CLASS}>Connection Name</label>
                    <input
                      type="text"
                      value={connName}
                      onChange={(e) => setConnName(e.target.value)}
                      placeholder="My Dataset"
                      className={INPUT_CLASS}
                    />
                  </div>

                  {!uploadedFile ? (
                    <div
                      className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors cursor-pointer ${
                        dragActive
                          ? 'border-accent-500 bg-accent-50'
                          : 'border-navy-200 bg-navy-50/50 hover:border-accent-400 hover:bg-accent-50/30'
                      }`}
                      onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                      onDragLeave={() => setDragActive(false)}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-accent-50 text-accent-600">
                        <Upload size={22} />
                      </div>
                      <p className="text-[14px] font-semibold text-navy-800">Drag & drop your file here</p>
                      <p className="my-1.5 text-[12px] text-navy-400">or</p>
                      <span className="inline-flex items-center rounded-lg bg-accent-500 px-4 py-1.5 text-[12.5px] font-semibold text-white">
                        Browse Files
                      </span>
                      <p className="mt-3 text-[11.5px] text-navy-500">Supports CSV, Excel (.xlsx), JSON</p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,.xlsx,.xls,.json"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 rounded-xl border border-navy-200 bg-white p-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-warn-50 text-warn-600">
                        <FileText size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-[13.5px] font-semibold text-navy-800">
                          {uploadedFile.name}
                        </div>
                        <div className="text-[11.5px] text-navy-500">
                          {formatBytes(uploadedFile.size)}
                        </div>
                      </div>
                      <button
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-navy-400 hover:bg-navy-50 hover:text-danger-600 transition-colors"
                        onClick={() => setUploadedFile(null)}
                        aria-label="Remove file"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ─── Step 4: Test ─── */}
          {step === 'test' && (
            <div className="flex flex-col items-center justify-center gap-3 py-6">
              {testStatus === 'testing' && (
                <>
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-50 text-accent-600">
                    <Loader2 size={24} className="is-spinner" />
                  </div>
                  <p className="text-[15px] font-semibold text-navy-900">Testing connection...</p>
                  <p className="text-[13px] text-navy-500">Verifying credentials and connectivity</p>
                </>
              )}
              {testStatus === 'success' && (
                <>
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success-50 text-success-600">
                    <CheckCircle2 size={24} />
                  </div>
                  <p className="text-[15px] font-semibold text-navy-900">Connection successful!</p>
                  <p className="text-[13px] text-navy-500">Loading schema...</p>
                </>
              )}
              {testStatus === 'error' && (
                <>
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger-50 text-danger-600">
                    <AlertCircle size={24} />
                  </div>
                  <p className="text-[15px] font-semibold text-navy-900">Connection failed</p>
                  <p className="max-w-md text-center text-[13px] text-danger-600">
                    {testError || 'Unable to connect. Check your credentials and try again.'}
                  </p>
                </>
              )}
              {testStatus === 'idle' && (
                <div className="w-full">
                  <div className="rounded-xl border border-navy-100 bg-navy-50/50 p-4">
                    {connectorType && connectorType !== 'file' && (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-4">
                          <span className="text-[12px] font-semibold uppercase tracking-wider text-navy-500">
                            Type
                          </span>
                          <span className="text-[13px] font-medium text-navy-800">
                            {CONNECTOR_TYPES.find((c) => c.type === connectorType)?.label}
                          </span>
                        </div>
                        {host && (
                          <div className="flex items-start justify-between gap-4">
                            <span className="text-[12px] font-semibold uppercase tracking-wider text-navy-500">
                              Host
                            </span>
                            <span className="text-[13px] font-medium text-navy-800">
                              {host}:{port}
                            </span>
                          </div>
                        )}
                        {endpoint && (
                          <div className="flex items-start justify-between gap-4">
                            <span className="text-[12px] font-semibold uppercase tracking-wider text-navy-500">
                              Endpoint
                            </span>
                            <span className="break-all text-right text-[12px] font-medium text-navy-800">
                              {endpoint}
                            </span>
                          </div>
                        )}
                        <div className="flex items-start justify-between gap-4">
                          <span className="text-[12px] font-semibold uppercase tracking-wider text-navy-500">
                            Database
                          </span>
                          <span className="text-[13px] font-medium text-navy-800">{database}</span>
                        </div>
                      </div>
                    )}
                    {connectorType === 'file' && uploadedFile && (
                      <div className="flex items-start justify-between gap-4">
                        <span className="text-[12px] font-semibold uppercase tracking-wider text-navy-500">
                          File
                        </span>
                        <span className="text-right text-[13px] font-medium text-navy-800">
                          {uploadedFile.name} ({formatBytes(uploadedFile.size)})
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── Step 5: Schema ─── */}
          {step === 'schema' && schema && (
            <>
              <p className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-navy-500">
                {schema.tables.length} tables found
              </p>
              <div className="flex flex-col gap-2">
                {schema.tables.map((table) => {
                  const isExpanded = expandedTable === table.name;
                  return (
                    <div
                      key={table.name}
                      className="rounded-lg border border-navy-100 bg-white transition-colors hover:bg-navy-50"
                    >
                      <button
                        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
                        onClick={() => setExpandedTable(isExpanded ? null : table.name)}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="text-navy-400">
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </span>
                          <span className="truncate text-[13.5px] font-semibold text-navy-800">
                            {table.name}
                          </span>
                          <span className="rounded-full bg-navy-100 px-2 py-0.5 text-[10.5px] font-semibold text-navy-600">
                            {table.columns.length} cols
                          </span>
                        </span>
                        {table.rowCount != null && (
                          <span className="shrink-0 text-[11.5px] text-navy-500">
                            {table.rowCount.toLocaleString()} rows
                          </span>
                        )}
                      </button>
                      {isExpanded && (
                        <div className="border-t border-navy-100 bg-navy-50/40 px-3 py-2">
                          <div className="flex flex-col gap-1">
                            {table.columns.map((col) => (
                              <div
                                key={col.name}
                                className="flex items-center gap-2 rounded-md px-2 py-1 text-[12.5px]"
                              >
                                {col.isPrimaryKey && (
                                  <Key size={11} className="text-warn-500" />
                                )}
                                <span className="font-medium text-navy-800">{col.name}</span>
                                <span className="ml-auto font-mono text-[11px] text-navy-500">
                                  {col.type}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ─── Step 6: Select Tables ─── */}
          {step === 'select-tables' && schema && (
            <>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[12.5px] font-medium text-navy-600">
                  {selectedTables.size} of {schema.tables.length} selected
                </span>
                <button
                  className="text-[12.5px] font-semibold text-accent-600 hover:text-accent-700 transition-colors"
                  onClick={
                    selectedTables.size === schema.tables.length
                      ? deselectAllTables
                      : selectAllTables
                  }
                >
                  {selectedTables.size === schema.tables.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {schema.tables.map((table) => {
                  const checked = selectedTables.has(table.name);
                  return (
                    <button
                      key={table.name}
                      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                        checked
                          ? 'border-accent-200 bg-accent-50 ring-1 ring-accent-200'
                          : 'border-navy-100 bg-white hover:bg-navy-50'
                      }`}
                      onClick={() => toggleTable(table.name)}
                    >
                      <div
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                          checked
                            ? 'border-accent-500 bg-accent-500 text-white'
                            : 'border-navy-300 bg-white'
                        }`}
                      >
                        {checked && <Check size={12} strokeWidth={3} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13.5px] font-semibold text-navy-800">
                          {table.name}
                        </div>
                        <div className="text-[11.5px] text-navy-500">
                          {table.columns.length} columns
                          {table.rowCount != null
                            ? ` · ${table.rowCount.toLocaleString()} rows`
                            : ''}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* ─── Step 7: Profiling ─── */}
          {step === 'profiling' && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              {/* Animated hero icon */}
              <div
                className={`flex h-20 w-20 items-center justify-center rounded-full transition-colors ${
                  profilingStatus === 'ready'
                    ? 'bg-success-50'
                    : profilingStatus === 'failed'
                      ? 'bg-danger-50'
                      : 'bg-accent-50'
                }`}
              >
                {profilingStatus === 'ready' ? (
                  <CheckCircle2 size={40} className="text-success-600" />
                ) : profilingStatus === 'failed' ? (
                  <AlertCircle size={40} className="text-danger-600" />
                ) : (
                  <Brain size={40} className="text-accent-600 animate-pulse" />
                )}
              </div>

              <h3 className="text-[17px] font-semibold text-navy-900">
                {profilingStatus === 'ready'
                  ? 'Intelligence Profile Ready!'
                  : profilingStatus === 'failed'
                    ? 'Profiling Failed'
                    : 'Building Intelligence Profile'}
              </h3>

              <p className="max-w-md text-[13px] leading-relaxed text-navy-500">
                {profilingStatus === 'ready'
                  ? 'Your AI assistant now understands your data structure and is ready to answer questions.'
                  : profilingStatus === 'failed'
                    ? profilingError || 'An error occurred during profiling. You can still use the workspace.'
                    : 'Analyzing your data to create a directional analysis plan...'}
              </p>

              {/* Progress steps */}
              {profilingStatus !== 'failed' && (
                <div className="mt-2 flex w-full max-w-sm flex-col gap-2">
                  {PROFILING_STEPS.map((ps, i) => {
                    const Icon = ps.icon;
                    const isDone = profilingStepIndex > i;
                    const isCurrent = profilingStepIndex === i && profilingStatus === 'running';
                    return (
                      <div
                        key={i}
                        className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                          isDone
                            ? 'border-success-500/30 bg-success-50/50'
                            : isCurrent
                              ? 'border-accent-300 bg-accent-50'
                              : 'border-navy-100 bg-white'
                        }`}
                      >
                        <div
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                            isDone
                              ? 'bg-success-500 text-white'
                              : isCurrent
                                ? 'bg-accent-500 text-white'
                                : 'bg-navy-100 text-navy-400'
                          }`}
                        >
                          {isDone ? (
                            <Check size={14} strokeWidth={3} />
                          ) : isCurrent ? (
                            <Loader2 size={14} className="is-spinner" />
                          ) : (
                            <Icon size={14} />
                          )}
                        </div>
                        <span
                          className={`text-[13px] font-medium ${
                            isDone
                              ? 'text-success-700'
                              : isCurrent
                                ? 'text-accent-700'
                                : 'text-navy-400'
                          }`}
                        >
                          {ps.text}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Live message */}
              {profilingStatus === 'running' && profilingMessage && (
                <p className="mt-1 max-w-md text-[12px] italic text-navy-400">
                  {profilingMessage}
                </p>
              )}
            </div>
          )}
        </div>

        {/* ─── Footer ─── */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-navy-100 bg-navy-50/50">
          {step === 'workspace-info' ? (
            <>
              <button className={SECONDARY_BTN} onClick={handleClose}>
                Cancel
              </button>
              <button
                className={PRIMARY_BTN}
                disabled={!wsName.trim()}
                onClick={() => setStep('choose-type')}
              >
                Next: Connect Data <ArrowRight size={14} />
              </button>
            </>
          ) : step === 'profiling' ? (
            <>
              <div />
              {profilingStatus === 'ready' || profilingStatus === 'failed' ? (
                <button className={PRIMARY_BTN} onClick={handleOpenWorkspace}>
                  <Sparkles size={14} /> Open Workspace <ArrowRight size={14} />
                </button>
              ) : (
                <button className={PRIMARY_BTN} disabled>
                  <Loader2 size={14} className="is-spinner" /> Profiling...
                </button>
              )}
            </>
          ) : (
            <>
              <button className={SECONDARY_BTN} onClick={goBack}>
                <ArrowLeft size={14} /> Back
              </button>

              {step === 'choose-type' && <div />}

              {step === 'configure' && (
                <button
                  className={PRIMARY_BTN}
                  disabled={!canProceedFromConfigure()}
                  onClick={() => { setStep('test'); setTestStatus('idle'); }}
                >
                  Next <ArrowRight size={14} />
                </button>
              )}

              {step === 'test' && testStatus === 'idle' && (
                <button className={PRIMARY_BTN} onClick={handleTest}>
                  <Database size={14} /> Test Connection
                </button>
              )}

              {step === 'test' && testStatus === 'error' && (
                <button className={PRIMARY_BTN} onClick={handleRetryTest}>
                  Retry
                </button>
              )}

              {step === 'schema' && (
                <button className={PRIMARY_BTN} onClick={() => setStep('select-tables')}>
                  Select Tables <ArrowRight size={14} />
                </button>
              )}

              {step === 'select-tables' && (
                <button
                  className={PRIMARY_BTN}
                  disabled={selectedTables.size === 0 || isSubmitting}
                  onClick={handleFinish}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={14} className="is-spinner" /> Creating...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={14} /> Create Workspace
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
