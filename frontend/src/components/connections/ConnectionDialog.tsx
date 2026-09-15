import { useState, useRef } from 'react';
import {
  X, Database, Loader2, CheckCircle2, AlertCircle, ArrowLeft,
  ArrowRight, Upload, FileText, Key, ChevronDown, ChevronRight, Check,
  Server, Globe, Layers, BarChart3,
} from 'lucide-react';
import type {
  ConnectionConfig, ConnectionInfo, ConnectorType, SchemaInfo,
  SqlConnectionConfig, CosmosDbConnectionConfig, MongoDbConnectionConfig,
  PowerBiConnectionConfig,
} from '../../types/connection';
import { addConnection, testConnection, getConnectionSchema } from '../../services/api';

type WizardStep = 'choose-type' | 'configure' | 'test' | 'schema' | 'select-tables';

const STEPS: { key: WizardStep; label: string }[] = [
  { key: 'choose-type', label: 'Type' },
  { key: 'configure', label: 'Configure' },
  { key: 'test', label: 'Test' },
  { key: 'schema', label: 'Schema' },
  { key: 'select-tables', label: 'Tables' },
];

const CONNECTOR_TYPES: { type: ConnectorType; label: string; desc: string; iconBg: string; iconText: string }[] = [
  { type: 'postgresql', label: 'PostgreSQL', desc: 'Relational database', iconBg: 'bg-accent-50', iconText: 'text-accent-600' },
  { type: 'mysql', label: 'MySQL', desc: 'Relational database', iconBg: 'bg-accent-50', iconText: 'text-accent-600' },
  { type: 'sqlserver', label: 'SQL Server', desc: 'Microsoft SQL', iconBg: 'bg-navy-100', iconText: 'text-navy-700' },
  { type: 'cosmosdb', label: 'Cosmos DB', desc: 'Azure NoSQL', iconBg: 'bg-accent-50', iconText: 'text-accent-600' },
  { type: 'mongodb', label: 'MongoDB', desc: 'Document database', iconBg: 'bg-success-50', iconText: 'text-success-700' },
  { type: 'powerbi', label: 'Power BI', desc: 'Microsoft Power BI', iconBg: 'bg-warn-50', iconText: 'text-warn-700' },
  { type: 'file', label: 'File Upload', desc: 'CSV, Excel, JSON', iconBg: 'bg-navy-100', iconText: 'text-navy-700' },
];

const PORT_DEFAULTS: Record<string, number> = { postgresql: 5432, mysql: 3306, sqlserver: 1433 };

function getConnectorIcon(type: ConnectorType) {
  if (type === 'file') return <Upload size={22} />;
  if (type === 'cosmosdb') return <Globe size={22} />;
  if (type === 'mongodb') return <Layers size={22} />;
  if (type === 'powerbi') return <BarChart3 size={22} />;
  return <Server size={22} />;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function detectFileFormat(name: string): 'csv' | 'excel' | 'json' {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'json') return 'json';
  if (ext === 'xlsx' || ext === 'xls') return 'excel';
  return 'csv';
}

interface ConnectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (connection: ConnectionInfo) => void;
  connections: ConnectionInfo[];
  activeConnectionId: string | null;
  onSelectConnection: (id: string) => void;
}

export default function ConnectionDialog({
  isOpen,
  onClose,
  onConnect,
  connections,
  activeConnectionId,
  onSelectConnection,
}: ConnectionDialogProps) {
  // Wizard state
  const [step, setStep] = useState<WizardStep>('choose-type');
  const [connectorType, setConnectorType] = useState<ConnectorType | null>(null);

  // Form state for SQL connectors
  const [name, setName] = useState('');
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

  // Power BI
  const [tenantId, setTenantId] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [pbiWorkspaceId, setPbiWorkspaceId] = useState('');
  const [datasetId, setDatasetId] = useState('');

  // File upload
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Test state
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState('');

  // Schema state
  const [schema, setSchema] = useState<SchemaInfo | null>(null);
  const [expandedTable, setExpandedTable] = useState<string | null>(null);

  // Table selection
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());

  // Loading
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Connection info created during test step
  const [, setTestedConnectionId] = useState<string | null>(null);
  const [testedConnectionInfo, setTestedConnectionInfo] = useState<ConnectionInfo | null>(null);

  if (!isOpen) return null;

  const resetWizard = () => {
    setStep('choose-type');
    setConnectorType(null);
    setName('');
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
    setTenantId('');
    setClientId('');
    setClientSecret('');
    setPbiWorkspaceId('');
    setDatasetId('');
    setUploadedFile(null);
    setTestStatus('idle');
    setTestError('');
    setSchema(null);
    setExpandedTable(null);
    setSelectedTables(new Set());
    setIsSubmitting(false);
    setTestedConnectionId(null);
    setTestedConnectionInfo(null);
  };

  const handleClose = () => {
    resetWizard();
    onClose();
  };

  const handleSelectType = (type: ConnectorType) => {
    setConnectorType(type);
    if (['postgresql', 'mysql', 'sqlserver'].includes(type)) {
      setPort(PORT_DEFAULTS[type] || 5432);
    }
    setStep('configure');
  };

  const buildConfig = (): ConnectionConfig | null => {
    if (!connectorType) return null;

    if (connectorType === 'postgresql' || connectorType === 'mysql' || connectorType === 'sqlserver') {
      return {
        connectorType,
        name: name || database,
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
        name: name || database,
        endpoint,
        accountKey,
        database,
        container: container || undefined,
      } as CosmosDbConnectionConfig;
    }
    if (connectorType === 'mongodb') {
      return {
        connectorType: 'mongodb',
        name: name || database,
        connectionString,
        database,
        authSource: authSource || undefined,
      } as MongoDbConnectionConfig;
    }
    if (connectorType === 'powerbi') {
      return {
        connectorType: 'powerbi',
        name: name || `Power BI - ${datasetId}`,
        tenantId,
        clientId,
        clientSecret,
        pbiWorkspaceId,
        datasetId,
      } as PowerBiConnectionConfig;
    }
    if (connectorType === 'file' && uploadedFile) {
      return {
        connectorType: 'file',
        name: name || uploadedFile.name,
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
    if (connectorType === 'powerbi') return !!tenantId && !!clientId && !!clientSecret && !!pbiWorkspaceId && !!datasetId;
    if (connectorType === 'file') return !!uploadedFile;
    return false;
  };

  const handleTest = async () => {
    setTestStatus('testing');
    setTestError('');

    try {
      // 1. Register connection with backend
      const config = buildConfig();
      if (!config) throw new Error('Invalid connection configuration');
      const rawInfo = await addConnection(config);
      const connectionId = rawInfo.id;
      setTestedConnectionId(connectionId);
      setTestedConnectionInfo({
        id: connectionId,
        name: rawInfo.name || config.name,
        connectorType: config.connectorType,
        host: rawInfo.host || ('host' in config ? config.host : ''),
        database: rawInfo.database || ('database' in config ? config.database : config.name),
        status: 'connected',
        selectedTableNames: [],
      });

      // 2. Test the connection
      const testResult = await testConnection(connectionId);
      if (testResult.status !== 'connected') {
        throw new Error('Database connection failed. Check your credentials and try again.');
      }

      setTestStatus('success');

      // 3. Fetch real schema
      const rawSchema = await getConnectionSchema(connectionId);

      // Map backend snake_case fields to frontend camelCase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const schema: SchemaInfo = {
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

      setSchema(schema);
      setSelectedTables(new Set(schema.tables.map((t) => t.name)));
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

  const handleFinish = async () => {
    setIsSubmitting(true);
    try {
      if (testedConnectionInfo) {
        const connectionWithTables: ConnectionInfo = {
          ...testedConnectionInfo,
          selectedTableNames: Array.from(selectedTables),
          schema: schema || undefined,
        };
        onConnect(connectionWithTables);
        handleClose();
      } else {
        // Fallback: shouldn't normally happen since test step creates the connection
        throw new Error('No tested connection found. Please test the connection first.');
      }
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'Failed to save connection');
      setTestStatus('error');
      setStep('test');
    } finally {
      setIsSubmitting(false);
    }
  };

  // File handlers
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

  const currentStepIndex = STEPS.findIndex((s) => s.key === step);

  // Shared class tokens
  const inputCls =
    'w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-[13.5px] text-navy-800 placeholder:text-navy-400 focus:border-accent-400 focus:ring-2 focus:ring-accent-100 focus:outline-none transition-colors';
  const labelCls = 'mb-1.5 block text-[12px] font-semibold uppercase tracking-wider text-navy-500';
  const primaryBtnCls =
    'inline-flex items-center gap-2 rounded-lg bg-accent-500 hover:bg-accent-600 disabled:bg-navy-200 disabled:text-navy-400 px-4 py-2 text-[13.5px] font-semibold text-white transition-colors';
  const secondaryBtnCls =
    'inline-flex items-center gap-2 rounded-lg border border-navy-200 bg-white hover:bg-navy-50 px-4 py-2 text-[13.5px] font-semibold text-navy-700 transition-colors';
  const sectionLabelCls = 'mb-2 text-[11px] font-semibold uppercase tracking-wider text-navy-500';

  // ─── Render ───

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/50 backdrop-blur-sm animate-fade-in px-4">
      <div className="w-full max-w-xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col animate-fade-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-navy-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-50 text-accent-600">
              <Database size={18} />
            </div>
            <h2 className="text-[17px] font-semibold text-navy-900">Data Connection</h2>
          </div>
          <button
            onClick={handleClose}
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-navy-400 hover:bg-navy-50 hover:text-navy-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Stepper — only show after choosing type */}
        {step !== 'choose-type' && (
          <div className="flex items-center gap-2 border-b border-navy-100 bg-navy-50/40 px-6 py-3 overflow-x-auto custom-scrollbar">
            {STEPS.slice(1).map((s, i) => {
              const stepIdx = i + 1;
              const isActive = s.key === step;
              const isDone = currentStepIndex > stepIdx;
              return (
                <div key={s.key} className="flex items-center">
                  {i > 0 && (
                    <div
                      className={`h-px w-6 mx-1.5 ${isDone || isActive ? 'bg-accent-400' : 'bg-navy-200'}`}
                    />
                  )}
                  <div
                    className={`flex items-center gap-2 rounded-full px-3 py-1 text-[12px] font-semibold whitespace-nowrap ${
                      isActive
                        ? 'bg-accent-500 text-white'
                        : isDone
                        ? 'bg-accent-50 text-accent-700'
                        : 'bg-white text-navy-500 border border-navy-200'
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-[10.5px] ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : isDone
                          ? 'bg-accent-500 text-white'
                          : 'bg-navy-100 text-navy-500'
                      }`}
                    >
                      {isDone ? <Check size={10} /> : i + 1}
                    </span>
                    <span>{s.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          {/* ─── Step 1: Choose Type ─── */}
          {step === 'choose-type' && (
            <>
              {connections.length > 0 && (
                <div className="mb-5">
                  <p className={sectionLabelCls}>Saved Connections</p>
                  <div className="flex flex-col gap-2">
                    {connections.map((conn) => {
                      const isActive = conn.id === activeConnectionId;
                      const isConnected = conn.status === 'connected';
                      return (
                        <button
                          key={conn.id}
                          onClick={() => { onSelectConnection(conn.id); handleClose(); }}
                          className={`flex items-center gap-3 p-3 rounded-xl border bg-white hover:shadow-sm transition-all text-left ${
                            isActive
                              ? 'border-accent-500 bg-accent-50 ring-2 ring-accent-100'
                              : 'border-navy-100 hover:border-accent-200'
                          }`}
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-600">
                            <Database size={16} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13.5px] font-semibold text-navy-900 truncate">
                              {conn.name || conn.database}
                            </p>
                            <p className="text-[12px] text-navy-500 truncate">
                              {conn.host} / {conn.database}
                            </p>
                          </div>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider ring-1 ring-inset ${
                              isConnected
                                ? 'bg-success-50 text-success-700 ring-success-500/25'
                                : 'bg-danger-50 text-danger-700 ring-danger-500/25'
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                isConnected ? 'bg-success-500' : 'bg-danger-500'
                              }`}
                            />
                            {isConnected ? 'connected' : 'disconnected'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <p className={sectionLabelCls}>New Connection</p>
              <div className="grid grid-cols-2 gap-2.5">
                {CONNECTOR_TYPES.map((ct) => (
                  <button
                    key={ct.type}
                    onClick={() => handleSelectType(ct.type)}
                    className="flex flex-col items-start gap-2 p-4 rounded-xl border border-navy-100 bg-white hover:border-accent-200 hover:shadow-sm transition-all text-left"
                  >
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-lg ${ct.iconBg} ${ct.iconText}`}
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

          {/* ─── Step 2: Configure ─── */}
          {step === 'configure' && connectorType && (
            <>
              {/* SQL Connectors */}
              {['postgresql', 'mysql', 'sqlserver'].includes(connectorType) && (
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Connection Name</label>
                      <input className={inputCls} type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="My Database" />
                    </div>
                    <div>
                      <label className={labelCls}>Host</label>
                      <input className={inputCls} type="text" value={host} onChange={(e) => setHost(e.target.value)} placeholder="localhost" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className={labelCls}>Port</label>
                      <input className={inputCls} type="number" value={port} onChange={(e) => setPort(parseInt(e.target.value) || port)} />
                    </div>
                    <div className="col-span-2">
                      <label className={labelCls}>Database</label>
                      <input className={inputCls} type="text" value={database} onChange={(e) => setDatabase(e.target.value)} placeholder="mydb" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Username</label>
                      <input className={inputCls} type="text" value={user} onChange={(e) => setUser(e.target.value)} placeholder="postgres" />
                    </div>
                    <div>
                      <label className={labelCls}>Password</label>
                      <input className={inputCls} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-navy-100 bg-navy-50/50 px-3 py-2.5">
                    <span className="text-[13px] font-medium text-navy-700">Use SSL</span>
                    <button
                      type="button"
                      onClick={() => setSsl(!ssl)}
                      className={`relative h-6 w-11 rounded-full transition-colors ${ssl ? 'bg-accent-500' : 'bg-navy-200'}`}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
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
                    <label className={labelCls}>Connection Name</label>
                    <input className={inputCls} type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="My Cosmos DB" />
                  </div>
                  <div>
                    <label className={labelCls}>Endpoint</label>
                    <input className={inputCls} type="text" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="https://myaccount.documents.azure.com:443/" />
                  </div>
                  <div>
                    <label className={labelCls}>Account Key</label>
                    <input className={inputCls} type="password" value={accountKey} onChange={(e) => setAccountKey(e.target.value)} placeholder="Primary or secondary key" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Database</label>
                      <input className={inputCls} type="text" value={database} onChange={(e) => setDatabase(e.target.value)} placeholder="mydb" />
                    </div>
                    <div>
                      <label className={labelCls}>
                        Container <span className="font-normal normal-case tracking-normal text-navy-400">(optional)</span>
                      </label>
                      <input className={inputCls} type="text" value={container} onChange={(e) => setContainer(e.target.value)} placeholder="mycontainer" />
                    </div>
                  </div>
                </div>
              )}

              {/* MongoDB */}
              {connectorType === 'mongodb' && (
                <div className="flex flex-col gap-4">
                  <div>
                    <label className={labelCls}>Connection Name</label>
                    <input className={inputCls} type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="My MongoDB" />
                  </div>
                  <div>
                    <label className={labelCls}>Connection String</label>
                    <input className={inputCls} type="text" value={connectionString} onChange={(e) => setConnectionString(e.target.value)} placeholder="mongodb+srv://user:pass@cluster.mongodb.net/" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Database</label>
                      <input className={inputCls} type="text" value={database} onChange={(e) => setDatabase(e.target.value)} placeholder="mydb" />
                    </div>
                    <div>
                      <label className={labelCls}>
                        Auth Source <span className="font-normal normal-case tracking-normal text-navy-400">(optional)</span>
                      </label>
                      <input className={inputCls} type="text" value={authSource} onChange={(e) => setAuthSource(e.target.value)} placeholder="admin" />
                    </div>
                  </div>
                </div>
              )}

              {/* Power BI */}
              {connectorType === 'powerbi' && (
                <div className="flex flex-col gap-4">
                  <div>
                    <label className={labelCls}>Connection Name</label>
                    <input className={inputCls} type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="My Power BI Dataset" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Tenant ID</label>
                      <input className={inputCls} type="text" value={tenantId} onChange={(e) => setTenantId(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
                    </div>
                    <div>
                      <label className={labelCls}>Client ID</label>
                      <input className={inputCls} type="text" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="App (Service Principal) ID" />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Client Secret</label>
                    <input className={inputCls} type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} placeholder="••••••••" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Workspace ID</label>
                      <input className={inputCls} type="text" value={pbiWorkspaceId} onChange={(e) => setPbiWorkspaceId(e.target.value)} placeholder="Power BI workspace/group ID" />
                    </div>
                    <div>
                      <label className={labelCls}>Dataset ID</label>
                      <input className={inputCls} type="text" value={datasetId} onChange={(e) => setDatasetId(e.target.value)} placeholder="Power BI dataset ID" />
                    </div>
                  </div>
                </div>
              )}

              {/* File Upload */}
              {connectorType === 'file' && (
                <div className="flex flex-col gap-4">
                  <div>
                    <label className={labelCls}>Connection Name</label>
                    <input className={inputCls} type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="My Dataset" />
                  </div>

                  {!uploadedFile ? (
                    <div
                      className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-6 py-10 cursor-pointer transition-colors ${
                        dragActive
                          ? 'border-accent-400 bg-accent-50'
                          : 'border-navy-200 bg-navy-50/40 hover:border-accent-300 hover:bg-accent-50/40'
                      }`}
                      onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                      onDragLeave={() => setDragActive(false)}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload size={28} className="text-accent-500" />
                      <p className="text-[13.5px] font-semibold text-navy-800">Drag & drop your file here</p>
                      <p className="text-[11.5px] text-navy-400">or</p>
                      <span className="inline-flex items-center gap-1 rounded-lg bg-accent-500 hover:bg-accent-600 px-3 py-1.5 text-[12.5px] font-semibold text-white transition-colors">
                        Browse Files
                      </span>
                      <p className="mt-1 text-[11.5px] text-navy-500">Supports CSV, Excel (.xlsx), JSON</p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,.xlsx,.xls,.json"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 rounded-xl border border-navy-100 bg-white px-3 py-2.5 shadow-sm">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-warn-50 text-warn-700">
                        <FileText size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13.5px] font-semibold text-navy-900 truncate">{uploadedFile.name}</div>
                        <div className="text-[11.5px] text-navy-500">{formatBytes(uploadedFile.size)}</div>
                      </div>
                      <button
                        className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-navy-400 hover:bg-navy-50 hover:text-danger-600 transition-colors"
                        onClick={() => setUploadedFile(null)}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ─── Step 3: Test Connection ─── */}
          {step === 'test' && (
            <div className="flex flex-col items-center gap-3 py-6">
              {testStatus === 'testing' && (
                <>
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-50 text-accent-600">
                    <Loader2 size={24} className="is-spinner" />
                  </div>
                  <p className="text-[15px] font-semibold text-navy-900">Testing connection...</p>
                  <p className="text-[12.5px] text-navy-500">Verifying credentials and connectivity</p>
                </>
              )}
              {testStatus === 'success' && (
                <>
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success-50 text-success-600">
                    <CheckCircle2 size={24} />
                  </div>
                  <p className="text-[15px] font-semibold text-navy-900">Connection successful!</p>
                  <p className="text-[12.5px] text-navy-500">Loading schema...</p>
                </>
              )}
              {testStatus === 'error' && (
                <>
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger-50 text-danger-600">
                    <AlertCircle size={24} />
                  </div>
                  <p className="text-[15px] font-semibold text-navy-900">Connection failed</p>
                  <p className="text-center text-[12.5px] text-navy-500 max-w-sm">
                    {testError || 'Unable to connect. Check your credentials and try again.'}
                  </p>
                </>
              )}
              {testStatus === 'idle' && (
                <>
                  {/* Connection summary */}
                  <div className="w-full flex flex-col gap-2 rounded-xl border border-navy-100 bg-navy-50/40 p-4">
                    {connectorType && !['file', 'powerbi'].includes(connectorType) && (
                      <>
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-navy-500">Type</span>
                          <span className="text-[13px] font-medium text-navy-800 text-right">
                            {CONNECTOR_TYPES.find((c) => c.type === connectorType)?.label}
                          </span>
                        </div>
                        {host && (
                          <div className="flex items-start justify-between gap-3">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-navy-500">Host</span>
                            <span className="text-[13px] font-medium text-navy-800 text-right">{host}:{port}</span>
                          </div>
                        )}
                        {endpoint && (
                          <div className="flex items-start justify-between gap-3">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-navy-500">Endpoint</span>
                            <span className="text-[12px] font-medium text-navy-800 text-right break-all">{endpoint}</span>
                          </div>
                        )}
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-navy-500">Database</span>
                          <span className="text-[13px] font-medium text-navy-800 text-right">{database}</span>
                        </div>
                      </>
                    )}
                    {connectorType === 'powerbi' && (
                      <>
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-navy-500">Type</span>
                          <span className="text-[13px] font-medium text-navy-800 text-right">Power BI</span>
                        </div>
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-navy-500">Workspace</span>
                          <span className="text-[12px] font-medium text-navy-800 text-right break-all">{pbiWorkspaceId}</span>
                        </div>
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-navy-500">Dataset</span>
                          <span className="text-[12px] font-medium text-navy-800 text-right break-all">{datasetId}</span>
                        </div>
                      </>
                    )}
                    {connectorType === 'file' && uploadedFile && (
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-navy-500">File</span>
                        <span className="text-[13px] font-medium text-navy-800 text-right">
                          {uploadedFile.name} ({formatBytes(uploadedFile.size)})
                        </span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ─── Step 4: Schema Viewer ─── */}
          {step === 'schema' && schema && (
            <>
              <p className={sectionLabelCls}>{schema.tables.length} tables found</p>
              <div className="flex flex-col gap-2">
                {schema.tables.map((table) => (
                  <div key={table.name} className="rounded-xl border border-navy-100 bg-white overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-navy-50/60 transition-colors"
                      onClick={() => setExpandedTable(expandedTable === table.name ? null : table.name)}
                    >
                      <span className="flex items-center gap-2 text-[13.5px] font-semibold text-navy-900">
                        {expandedTable === table.name ? (
                          <ChevronDown size={14} className="text-navy-500" />
                        ) : (
                          <ChevronRight size={14} className="text-navy-500" />
                        )}
                        {table.name}
                        <span className="ml-1 inline-flex items-center rounded-full bg-navy-100 px-2 py-0.5 text-[10.5px] font-semibold text-navy-600">
                          {table.columns.length} cols
                        </span>
                      </span>
                      {table.rowCount != null && (
                        <span className="inline-flex items-center rounded-full bg-accent-50 px-2 py-0.5 text-[10.5px] font-semibold text-accent-700 ring-1 ring-inset ring-accent-500/25">
                          {table.rowCount.toLocaleString()} rows
                        </span>
                      )}
                    </button>
                    {expandedTable === table.name && (
                      <div className="flex flex-col border-t border-navy-100 bg-navy-50/40">
                        {table.columns.map((col) => (
                          <div
                            key={col.name}
                            className="flex items-center gap-2 px-4 py-1.5 text-[12.5px] border-b border-navy-100 last:border-b-0"
                          >
                            {col.isPrimaryKey && <Key size={11} className="text-warn-600" />}
                            <span className="font-medium text-navy-800">{col.name}</span>
                            <span className="ml-auto text-[11.5px] font-mono text-navy-500">{col.type}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ─── Step 5: Select Tables ─── */}
          {step === 'select-tables' && schema && (
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[12.5px] font-medium text-navy-600">
                  {selectedTables.size} of {schema.tables.length} selected
                </span>
                <button
                  className="text-[12px] font-semibold text-accent-600 hover:text-accent-700 transition-colors"
                  onClick={selectedTables.size === schema.tables.length ? deselectAllTables : selectAllTables}
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
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                        checked
                          ? 'border-accent-500 bg-accent-50 ring-2 ring-accent-100'
                          : 'border-navy-100 bg-white hover:border-accent-200 hover:shadow-sm'
                      }`}
                      onClick={() => toggleTable(table.name)}
                    >
                      <div
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                          checked
                            ? 'border-accent-500 bg-accent-500 text-white'
                            : 'border-navy-300 bg-white'
                        }`}
                      >
                        {checked && <Check size={12} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13.5px] font-semibold text-navy-900 truncate">{table.name}</div>
                        <div className="text-[11.5px] text-navy-500 truncate">
                          {table.columns.length} columns{table.rowCount != null ? ` · ${table.rowCount.toLocaleString()} rows` : ''}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer — navigation buttons */}
        {step !== 'choose-type' && (
          <div className="flex items-center justify-between gap-3 border-t border-navy-100 bg-navy-50/50 px-6 py-4">
            <button
              className={secondaryBtnCls}
              onClick={() => {
                if (step === 'configure') { setStep('choose-type'); setConnectorType(null); }
                else if (step === 'test') setStep('configure');
                else if (step === 'schema') setStep('test');
                else if (step === 'select-tables') setStep('schema');
              }}
            >
              <ArrowLeft size={14} /> Back
            </button>

            {step === 'configure' && (
              <button
                className={primaryBtnCls}
                disabled={!canProceedFromConfigure()}
                onClick={() => { setStep('test'); setTestStatus('idle'); }}
              >
                Next <ArrowRight size={14} />
              </button>
            )}

            {step === 'test' && testStatus === 'idle' && (
              <button className={primaryBtnCls} onClick={handleTest}>
                <Database size={14} /> Test Connection
              </button>
            )}

            {step === 'test' && testStatus === 'error' && (
              <button className={primaryBtnCls} onClick={handleRetryTest}>
                Retry
              </button>
            )}

            {step === 'schema' && (
              <button className={primaryBtnCls} onClick={() => setStep('select-tables')}>
                Select Tables <ArrowRight size={14} />
              </button>
            )}

            {step === 'select-tables' && (
              <button
                className={primaryBtnCls}
                disabled={selectedTables.size === 0 || isSubmitting}
                onClick={handleFinish}
              >
                {isSubmitting ? (
                  <><Loader2 size={14} className="is-spinner" /> Saving...</>
                ) : (
                  <><CheckCircle2 size={14} /> Save & Connect</>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
