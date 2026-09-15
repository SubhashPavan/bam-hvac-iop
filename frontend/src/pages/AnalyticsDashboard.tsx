import { useState, useEffect, useCallback } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  ArrowLeft,
  Brain,
  Coins,
  Cpu,
  Crown,
  ExternalLink,
  Loader2,
  RefreshCw,
  TrendingUp,
  Users,
  Wallet,
  Zap,
  X,
} from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import { useAuthStore } from '../store/authStore';
import {
  getBreakdowns,
  getOverview,
  getTimeseries,
  getUserDetail,
  getWorkspaceDetail,
  type AnalyticsBreakdowns,
  type AnalyticsOverview,
  type AnalyticsTimeseries,
  type AnalyticsPeriod,
  type UserUsageDetail,
  type WorkspaceUsageDetail,
} from '../services/analytics';

/* ─── Number formatters ───────────────────────────────────────────── */

function fmtNum(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toFixed(2);
}
function fmtCost(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  if (Math.abs(n) >= 100) return `$${n.toFixed(2)}`;
  if (Math.abs(n) >= 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(4)}`;
}
function fmtDuration(ms: number | undefined | null): string {
  if (!ms || !Number.isFinite(ms)) return '—';
  if (ms >= 60_000) return `${(ms / 60_000).toFixed(1)}m`;
  if (ms >= 1_000) return `${(ms / 1_000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}
function prettyEvent(t: string): string {
  return ({
    quick_insight: 'Quick Insight',
    deep_insight: 'Deep Insight',
    deep_followup: 'Deep follow-up',
    dashboard_build: 'Dashboard build',
    dashboard_refresh: 'Dashboard refresh',
    dashboard_replan: 'Dashboard re-plan',
    dashboard_add_tab: 'Add tab',
    dashboard_add_block: 'Add insight',
    data_profile: 'Data profile',
  } as Record<string, string>)[t] || t;
}
function prettyModel(raw: string): string {
  if (!raw) return '—';
  const s = raw.toLowerCase();
  if (s.includes('haiku')) return 'Haiku';
  if (s.includes('sonnet')) return 'Sonnet';
  if (s.includes('opus')) return 'Opus';
  if (s.includes('gpt-4o')) return 'GPT-4o';
  return raw;
}
function formatRelative(iso: string): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

/* ─── Page ────────────────────────────────────────────────────────── */

export default function AnalyticsDashboard() {
  const role = useAuthStore((s) => s.user?.role || 'user');
  const isAdmin = role === 'admin';
  const isPrivileged = role === 'admin' || role === 'manager';

  const [period, setPeriod] = useState<AnalyticsPeriod>('30d');
  const [workspaceFilter, setWorkspaceFilter] = useState<string>('');

  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [timeseries, setTimeseries] = useState<AnalyticsTimeseries | null>(null);
  const [breakdowns, setBreakdowns] = useState<AnalyticsBreakdowns | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drillUser, setDrillUser] = useState<string | null>(null);
  const [drillWorkspace, setDrillWorkspace] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ov, ts, bd] = await Promise.all([
        getOverview(period, workspaceFilter),
        getTimeseries(period, workspaceFilter),
        getBreakdowns(period, workspaceFilter, 10),
      ]);
      setOverview(ov);
      setTimeseries(ts);
      setBreakdowns(bd);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [period, workspaceFilter]);

  useEffect(() => {
    if (isPrivileged) void load();
  }, [load, isPrivileged]);

  if (!isPrivileged) {
    return (
      <AppLayout title="Analytics" fluid>
        <div className="flex h-full items-center justify-center p-12">
          <div className="rounded-2xl border border-navy-100 bg-white p-8 text-center">
            <p className="text-[14px] text-navy-700">
              Analytics is only available to admins and managers.
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Analytics" fluid>
      <div className="custom-scrollbar flex h-full flex-1 flex-col overflow-y-auto bg-navy-50/40">
        {/* Top bar */}
        <header className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-3 border-b border-navy-100 bg-white/95 px-6 py-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-50 text-accent-600 ring-1 ring-inset ring-accent-200">
              <TrendingUp className="h-4.5 w-4.5" />
            </div>
            <div>
              <h1 className="text-[17px] font-bold tracking-tight text-navy-900">
                Analytics
              </h1>
              <p className="text-[12px] text-navy-500">
                {overview?.scope === 'platform'
                  ? 'Platform-wide usage across all workspaces'
                  : overview?.scope === 'workspace'
                    ? 'One-workspace view'
                    : 'Your owned & member workspaces'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <PeriodSwitcher value={period} onChange={setPeriod} />
            {breakdowns && breakdowns.by_workspace.length > 1 && (
              <WorkspacePicker
                options={breakdowns.by_workspace.map((w) => ({
                  id: w.workspace_id,
                  name: w.workspace_name,
                }))}
                value={workspaceFilter}
                onChange={setWorkspaceFilter}
              />
            )}
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-navy-200 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-navy-700 transition-colors hover:bg-navy-50 disabled:opacity-60"
              title="Refresh"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </header>

        <div className="flex-1 px-6 py-5">
          <div className="mx-auto max-w-7xl space-y-5">
            {error && (
              <div className="rounded-xl border border-danger-500/20 bg-danger-50 px-4 py-3 text-[13px] text-danger-700">
                {error}
              </div>
            )}

            {loading && !overview ? (
              <div className="flex h-64 items-center justify-center text-navy-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                <span className="text-[13px]">Loading analytics…</span>
              </div>
            ) : (
              <>
                {/* KPI strip */}
                {overview && <KpiStrip overview={overview} isAdmin={isAdmin} />}

                {/* Time series */}
                {timeseries && <TimeseriesPanel data={timeseries.series} />}

                {/* Breakdowns 2x2 */}
                {breakdowns && (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <BreakdownCard
                      title="Top users"
                      subtitle="By total cost"
                      icon={Users}
                      tone="accent"
                      empty="No user activity yet."
                      rows={breakdowns.by_user.map((u) => ({
                        // Prefer the user_id (works for both admins and
                        // managers); fall back to a synthetic key when
                        // we only know the email.
                        id: u.user_id ? `uid:${u.user_id}` : `mail:${u.user_email}`,
                        primary: u.user_name || u.user_email,
                        secondary: u.user_email,
                        events: u.events,
                        cost_usd: u.cost_usd,
                        tokens: u.tokens,
                      }))}
                      onRowClick={(id) => {
                        if (id.startsWith('uid:')) setDrillUser('id:' + id.slice(4));
                        else if (id.startsWith('mail:')) setDrillUser('email:' + id.slice(5));
                      }}
                    />
                    <BreakdownCard
                      title="Top workspaces"
                      subtitle="By total cost"
                      icon={Activity}
                      tone="violet"
                      empty="No workspace activity yet."
                      rows={breakdowns.by_workspace.map((w) => ({
                        id: w.workspace_id,
                        primary: w.workspace_name,
                        secondary: '',
                        events: w.events,
                        cost_usd: w.cost_usd,
                        tokens: w.tokens,
                      }))}
                      onRowClick={(id) => setDrillWorkspace(id)}
                    />
                    <BreakdownCard
                      title="By feature"
                      subtitle="Quick · Deep · Dashboard · Profiler"
                      icon={Brain}
                      tone="success"
                      empty="No activity yet."
                      rows={breakdowns.by_event_type.map((e) => ({
                        id: 'evt_' + e.event_type,
                        primary: prettyEvent(e.event_type),
                        secondary: '',
                        events: e.events,
                        cost_usd: e.cost_usd,
                        tokens: e.tokens,
                      }))}
                    />
                    <BreakdownCard
                      title="By model"
                      subtitle="Routing across Claude family"
                      icon={Cpu}
                      tone="warn"
                      empty="No model activity yet."
                      rows={breakdowns.by_model.map((m) => ({
                        id: 'model_' + m.model,
                        primary: prettyModel(m.model),
                        secondary: m.model,
                        events: m.events,
                        cost_usd: m.cost_usd,
                        tokens: m.tokens,
                      }))}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Drill-down panels */}
        {drillUser && (
          <UserDrillPanel
            userKey={drillUser}
            period={period}
            isAdmin={isAdmin}
            onClose={() => setDrillUser(null)}
          />
        )}
        {drillWorkspace && (
          <WorkspaceDrillPanel
            workspaceId={drillWorkspace}
            period={period}
            onClose={() => setDrillWorkspace(null)}
          />
        )}
      </div>
    </AppLayout>
  );
}

/* ─── Period switcher ─────────────────────────────────────────────── */

function PeriodSwitcher({
  value,
  onChange,
}: {
  value: AnalyticsPeriod;
  onChange: (p: AnalyticsPeriod) => void;
}) {
  const opts: { v: AnalyticsPeriod; label: string }[] = [
    { v: '7d', label: '7 days' },
    { v: '30d', label: '30 days' },
    { v: '90d', label: '90 days' },
    { v: 'all', label: 'All time' },
  ];
  return (
    <div className="inline-flex shrink-0 rounded-lg border border-navy-200 bg-white p-0.5">
      {opts.map((o) => {
        const active = o.v === value;
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            className={`rounded-md px-2.5 py-1 text-[11.5px] font-semibold transition-colors ${
              active
                ? 'bg-accent-500 text-white shadow-sm'
                : 'text-navy-600 hover:bg-navy-50 hover:text-navy-900'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ─── Workspace picker (when multiple workspaces in scope) ────────── */

function WorkspacePicker({
  options,
  value,
  onChange,
}: {
  options: { id: string; name: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-navy-200 bg-white px-2.5 py-1.5 text-[12.5px] font-semibold text-navy-700 focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-100"
    >
      <option value="">All workspaces</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </select>
  );
}

/* ─── KPI strip ───────────────────────────────────────────────────── */

function KpiStrip({
  overview,
  isAdmin,
}: {
  overview: AnalyticsOverview;
  isAdmin: boolean;
}) {
  const kpis = [
    {
      label: 'Total events',
      value: fmtNum(overview.events.total),
      sub: `${overview.events.success} ok · ${overview.events.failed} failed`,
      icon: Activity,
      tone: 'accent' as const,
    },
    {
      label: 'Quick Insight',
      value: fmtNum(overview.questions.quick),
      sub: 'questions on Haiku',
      icon: Zap,
      tone: 'accent' as const,
    },
    {
      label: 'Deep Insight',
      value: fmtNum(overview.questions.deep),
      sub: 'analyses on Sonnet/Opus',
      icon: Brain,
      tone: 'violet' as const,
    },
    {
      label: 'Tokens',
      value: fmtNum(overview.tokens.total),
      sub: `${fmtNum(overview.tokens.input)} in · ${fmtNum(overview.tokens.output)} out`,
      icon: Coins,
      tone: 'success' as const,
    },
    {
      label: 'Cost',
      value: fmtCost(overview.cost_usd),
      sub: `${fmtCost(overview.avg_cost_per_event)} avg/event`,
      icon: Wallet,
      tone: 'warn' as const,
    },
    {
      label: 'Active users',
      value: fmtNum(overview.active_users),
      sub: isAdmin ? 'across the platform' : 'in your workspaces',
      icon: Users,
      tone: 'navy' as const,
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
      {kpis.map((k) => (
        <KpiTile key={k.label} {...k} />
      ))}
    </div>
  );
}

function KpiTile({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  icon: typeof Users;
  tone: 'accent' | 'violet' | 'success' | 'warn' | 'navy';
}) {
  const toneClasses = {
    accent: 'bg-accent-50 text-accent-700 ring-accent-200',
    violet: 'bg-violet-50 text-violet-700 ring-violet-200',
    success: 'bg-success-50 text-success-700 ring-success-500/25',
    warn: 'bg-warn-50 text-warn-700 ring-warn-500/25',
    navy: 'bg-navy-50 text-navy-700 ring-navy-200',
  }[tone];
  return (
    <div className="rounded-xl border border-navy-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-navy-500">
          {label}
        </p>
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ring-1 ring-inset ${toneClasses}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <p className="mt-1.5 text-[22px] font-bold tabular-nums leading-none tracking-tight text-navy-900">
        {value}
      </p>
      <p className="mt-1 truncate text-[11px] text-navy-500" title={sub}>
        {sub}
      </p>
    </div>
  );
}

/* ─── Time series ─────────────────────────────────────────────────── */

type Metric = 'events' | 'tokens' | 'cost_usd';

function TimeseriesPanel({ data }: { data: AnalyticsTimeseries['series'] }) {
  const [metric, setMetric] = useState<Metric>('events');

  // Derive a friendly label per metric for the tooltip / axis
  const config: Record<Metric, { label: string; color: string; format: (n: number) => string }> = {
    events: { label: 'Events', color: '#0EA5E9', format: fmtNum },
    tokens: { label: 'Tokens', color: '#10B981', format: fmtNum },
    cost_usd: { label: 'Cost (USD)', color: '#F59E0B', format: fmtCost },
  };
  const { label, color, format } = config[metric];

  // Render two series stacked: quick + deep questions, OR for tokens / cost just one area
  const showQuickDeep = metric === 'events';

  return (
    <div className="rounded-xl border border-navy-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-[14.5px] font-bold tracking-tight text-navy-900">
            Activity over time
          </h3>
          <p className="text-[11.5px] text-navy-500">
            Daily {label.toLowerCase()} — switch metric using the buttons →
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-navy-200 bg-white p-0.5">
          {(Object.keys(config) as Metric[]).map((m) => {
            const active = m === metric;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMetric(m)}
                className={`rounded-md px-2.5 py-1 text-[11.5px] font-semibold transition-colors ${
                  active
                    ? 'bg-navy-900 text-white shadow-sm'
                    : 'text-navy-600 hover:bg-navy-50 hover:text-navy-900'
                }`}
              >
                {config[m].label}
              </button>
            );
          })}
        </div>
      </div>
      {data.length === 0 ? (
        <div className="flex h-56 items-center justify-center text-[13px] italic text-navy-400">
          No data in this period yet.
        </div>
      ) : (
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="grad-quick" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0EA5E9" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="#0EA5E9" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="grad-deep" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="grad-single" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.55} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#8b919d' }}
                axisLine={{ stroke: '#eef0f3' }}
                tickLine={false}
                tickFormatter={(d) => {
                  const dt = new Date(d);
                  return Number.isNaN(dt.valueOf())
                    ? d
                    : dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#8b919d' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={metric === 'cost_usd' ? fmtCost : fmtNum}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 10,
                  border: '1px solid #E2E8F0',
                  fontSize: 12,
                  boxShadow: '0 10px 25px -5px rgba(15,23,42,0.15)',
                }}
                formatter={(v) => format(typeof v === 'number' ? v : 0)}
                labelFormatter={(d) => {
                  const dt = new Date(d as string);
                  return Number.isNaN(dt.valueOf())
                    ? d
                    : dt.toLocaleDateString(undefined, {
                        weekday: 'short', month: 'short', day: 'numeric',
                      });
                }}
              />
              {showQuickDeep ? (
                <>
                  <Area
                    type="monotone"
                    dataKey="quick_questions"
                    name="Quick"
                    stroke="#0EA5E9"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#grad-quick)"
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="deep_questions"
                    name="Deep"
                    stroke="#8B5CF6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#grad-deep)"
                    isAnimationActive={false}
                  />
                  <Legend wrapperStyle={{ paddingTop: 8, fontSize: 12 }} />
                </>
              ) : (
                <Area
                  type="monotone"
                  dataKey={metric}
                  name={label}
                  stroke={color}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#grad-single)"
                  isAnimationActive={false}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

/* ─── Breakdown card ─────────────────────────────────────────────── */

interface BreakdownRow {
  id: string;
  primary: string;
  secondary: string;
  events: number;
  cost_usd: number;
  tokens: number;
}

function BreakdownCard({
  title,
  subtitle,
  icon: Icon,
  tone,
  rows,
  empty,
  onRowClick,
}: {
  title: string;
  subtitle: string;
  icon: typeof Users;
  tone: 'accent' | 'violet' | 'success' | 'warn';
  rows: BreakdownRow[];
  empty: string;
  onRowClick?: (id: string) => void;
}) {
  const toneClasses = {
    accent: 'bg-accent-50 text-accent-700 ring-accent-200',
    violet: 'bg-violet-50 text-violet-700 ring-violet-200',
    success: 'bg-success-50 text-success-700 ring-success-500/25',
    warn: 'bg-warn-50 text-warn-700 ring-warn-500/25',
  }[tone];
  const maxCost = Math.max(0.0001, ...rows.map((r) => r.cost_usd));
  return (
    <div className="rounded-xl border border-navy-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2.5">
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ring-1 ring-inset ${toneClasses}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div>
          <h3 className="text-[14px] font-bold tracking-tight text-navy-900">{title}</h3>
          <p className="text-[11px] text-navy-500">{subtitle}</p>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-[12.5px] italic text-navy-400">{empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => {
            const widthPct = Math.round((r.cost_usd / maxCost) * 100);
            const interactive = !!onRowClick;
            return (
              <li
                key={r.id}
                className={`group relative overflow-hidden rounded-lg px-3 py-2 transition-colors ${
                  interactive ? 'cursor-pointer hover:bg-navy-50' : 'bg-navy-50/30'
                }`}
                onClick={interactive ? () => onRowClick!(r.id) : undefined}
              >
                <div
                  className="absolute inset-y-0 left-0 bg-accent-100/60"
                  style={{ width: `${widthPct}%` }}
                />
                <div className="relative flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-semibold text-navy-900">
                      {r.primary}
                    </p>
                    {r.secondary && (
                      <p className="truncate text-[10.5px] text-navy-500">
                        {r.secondary}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-baseline gap-2.5">
                    <span className="text-[10.5px] text-navy-500">
                      {fmtNum(r.events)}
                    </span>
                    <span className="text-[12.5px] font-bold tabular-nums text-navy-900">
                      {fmtCost(r.cost_usd)}
                    </span>
                    {interactive && (
                      <ExternalLink className="h-3 w-3 text-navy-300 group-hover:text-accent-600" />
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ─── User drill-down panel ───────────────────────────────────────── */

function UserDrillPanel({
  userKey,
  period,
  isAdmin,
  onClose,
}: {
  /** Either `id:<user_id>` or `email:<email>`. Direct id is preferred
   *  (works for managers); email path requires admin (admin-users API). */
  userKey: string;
  period: AnalyticsPeriod;
  isAdmin: boolean;
  onClose: () => void;
}) {
  const [data, setData] = useState<UserUsageDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isIdKey = userKey.startsWith('id:');
  const fallbackLabel = isIdKey ? userKey.slice(3) : userKey.slice(6);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let userId = '';
        if (isIdKey) {
          // Direct user_id from the breakdown row — works for managers too.
          userId = userKey.slice(3);
        } else {
          // Legacy: only an email is available. The /admin/users lookup
          // is admin-only, so managers can't drill down via email.
          const email = userKey.slice(6);
          if (!isAdmin) {
            throw new Error("Couldn't resolve this user — try refreshing.");
          }
          const stored = localStorage.getItem('insightsmart-auth');
          const token = stored ? JSON.parse(stored)?.state?.token : '';
          const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000';
          const r = await fetch(`${apiBase}/api/admin/users`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!r.ok) throw new Error("Couldn't resolve user");
          const all = await r.json();
          const match = (all as Array<{ id: string; email: string }>).find(
            (u) => u.email === email,
          );
          if (!match) throw new Error('User not found');
          userId = match.id;
        }
        const detail = await getUserDetail(userId, period);
        if (!cancelled) setData(detail);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userKey, period, isAdmin, isIdKey]);

  return (
    <DrillPanel onClose={onClose} title={data?.user.name || fallbackLabel}>
      {error && (
        <div className="rounded-lg border border-danger-500/20 bg-danger-50 px-3 py-2 text-[12.5px] text-danger-700">
          {error}
        </div>
      )}
      {!data ? (
        <div className="flex items-center justify-center py-12 text-navy-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <DrillKpi label="Events" value={fmtNum(data.totals.events)} icon={Activity} />
            <DrillKpi label="Tokens" value={fmtNum(data.totals.tokens)} icon={Coins} />
            <DrillKpi label="Cost" value={fmtCost(data.totals.cost_usd)} icon={Wallet} />
            <DrillKpi
              label="Role"
              value={
                data.user.role === 'admin'
                  ? 'Admin'
                  : data.user.role === 'manager'
                    ? 'Manager'
                    : 'User'
              }
              icon={Crown}
            />
          </div>

          {/* Quotas at a glance */}
          <div className="rounded-lg border border-navy-100 bg-navy-50/40 px-3 py-2.5">
            <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-navy-500">
              Quotas
            </p>
            <div className="grid grid-cols-3 gap-3 text-[12px]">
              <QuotaRow
                label="Questions / day"
                used={data.user.today_questions}
                limit={data.user.max_questions_per_day}
              />
              <QuotaRow
                label="Tokens / day"
                used={data.user.today_tokens}
                limit={data.user.max_tokens_per_day}
                isTokens
              />
              <QuotaRow
                label="Cost / month"
                used={data.user.month_cost_usd}
                limit={data.user.max_cost_usd_per_month}
                isCost
              />
            </div>
          </div>

          {/* Daily trend */}
          {data.series.length > 0 && (
            <div className="rounded-lg border border-navy-100 bg-white p-3">
              <p className="mb-1 text-[11.5px] font-semibold uppercase tracking-wider text-navy-500">
                Daily activity
              </p>
              <div style={{ width: '100%', height: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.series}>
                    <defs>
                      <linearGradient id="drill-user-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0EA5E9" stopOpacity={0.55} />
                        <stop offset="100%" stopColor="#0EA5E9" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} hide />
                    <YAxis hide />
                    <Tooltip
                      formatter={(v) => fmtNum(typeof v === 'number' ? v : 0)}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="events"
                      stroke="#0EA5E9"
                      fill="url(#drill-user-grad)"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Recent events */}
          <div className="rounded-lg border border-navy-100 bg-white">
            <p className="px-3 pt-2.5 text-[11.5px] font-semibold uppercase tracking-wider text-navy-500">
              Recent activity
            </p>
            <ul className="divide-y divide-navy-100 max-h-[360px] overflow-y-auto">
              {data.recent_events.map((e) => (
                <li key={e.id} className="px-3 py-2 text-[12px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold text-navy-800">
                      {prettyEvent(e.event_type)}
                    </span>
                    <span className="shrink-0 text-[10.5px] text-navy-500">
                      {formatRelative(e.timestamp)}
                    </span>
                  </div>
                  {e.query_text && (
                    <p className="truncate text-[11.5px] text-navy-600" title={e.query_text}>
                      {e.query_text}
                    </p>
                  )}
                  <div className="mt-0.5 flex items-center gap-3 text-[10.5px] text-navy-500">
                    <span>{prettyModel(e.model)}</span>
                    <span>{fmtNum(e.tokens)} tokens</span>
                    <span>{fmtCost(e.cost_usd)}</span>
                    <span>{fmtDuration(e.duration_ms)}</span>
                    {!e.success && (
                      <span className="rounded-full bg-danger-50 px-1.5 py-0.5 text-[9.5px] font-bold uppercase text-danger-700 ring-1 ring-danger-500/25">
                        Failed{e.error_class ? ` · ${e.error_class}` : ''}
                      </span>
                    )}
                  </div>
                </li>
              ))}
              {data.recent_events.length === 0 && (
                <li className="px-3 py-6 text-center text-[12px] italic text-navy-400">
                  No recent events.
                </li>
              )}
            </ul>
          </div>
        </>
      )}
    </DrillPanel>
  );
}

/* ─── Workspace drill-down panel ──────────────────────────────────── */

function WorkspaceDrillPanel({
  workspaceId,
  period,
  onClose,
}: {
  workspaceId: string;
  period: AnalyticsPeriod;
  onClose: () => void;
}) {
  const [data, setData] = useState<WorkspaceUsageDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const detail = await getWorkspaceDetail(workspaceId, period);
        if (!cancelled) setData(detail);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, period]);

  return (
    <DrillPanel onClose={onClose} title={data?.workspace.name || workspaceId}>
      {error && (
        <div className="rounded-lg border border-danger-500/20 bg-danger-50 px-3 py-2 text-[12.5px] text-danger-700">
          {error}
        </div>
      )}
      {!data ? (
        <div className="flex items-center justify-center py-12 text-navy-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <DrillKpi label="Events" value={fmtNum(data.totals.events)} icon={Activity} />
            <DrillKpi label="Tokens" value={fmtNum(data.totals.tokens)} icon={Coins} />
            <DrillKpi label="Cost" value={fmtCost(data.totals.cost_usd)} icon={Wallet} />
            <DrillKpi
              label="Active users"
              value={fmtNum(data.totals.active_users)}
              icon={Users}
            />
          </div>

          {data.series.length > 0 && (
            <div className="rounded-lg border border-navy-100 bg-white p-3">
              <p className="mb-1 text-[11.5px] font-semibold uppercase tracking-wider text-navy-500">
                Daily activity
              </p>
              <div style={{ width: '100%', height: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.series}>
                    <defs>
                      <linearGradient id="drill-ws-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.55} />
                        <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} hide />
                    <YAxis hide />
                    <Tooltip
                      formatter={(v) => fmtNum(typeof v === 'number' ? v : 0)}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="events"
                      stroke="#8B5CF6"
                      fill="url(#drill-ws-grad)"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Members */}
          <div className="rounded-lg border border-navy-100 bg-white">
            <p className="px-3 pt-2.5 text-[11.5px] font-semibold uppercase tracking-wider text-navy-500">
              Member activity
            </p>
            <ul className="divide-y divide-navy-100 max-h-[360px] overflow-y-auto">
              {data.members.map((m) => (
                <li key={m.user_email} className="px-3 py-2 text-[12px]">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-navy-800">
                        {m.user_name || m.user_email}
                      </p>
                      <p className="truncate text-[10.5px] text-navy-500">{m.user_email}</p>
                    </div>
                    <div className="flex shrink-0 items-baseline gap-3 text-[11px] tabular-nums text-navy-700">
                      <span>{fmtNum(m.events)} events</span>
                      <span>{fmtNum(m.tokens)} tokens</span>
                      <span className="font-bold">{fmtCost(m.cost_usd)}</span>
                    </div>
                  </div>
                </li>
              ))}
              {data.members.length === 0 && (
                <li className="px-3 py-6 text-center text-[12px] italic text-navy-400">
                  No member activity in this period.
                </li>
              )}
            </ul>
          </div>
        </>
      )}
    </DrillPanel>
  );
}

/* ─── Generic drill panel chrome ─────────────────────────────────── */

function DrillPanel({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex bg-navy-900/40 backdrop-blur-sm animate-fade-in">
      <div className="ml-auto h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl animate-fade-slide-in">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-navy-100 bg-white/95 px-5 py-3 backdrop-blur">
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-navy-400 hover:bg-navy-50 hover:text-navy-700"
            title="Close"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h2 className="min-w-0 flex-1 truncate text-[15px] font-bold text-navy-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-navy-400 hover:bg-navy-50 hover:text-navy-700"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="space-y-3 p-5">{children}</div>
      </div>
    </div>
  );
}

function DrillKpi({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Users;
}) {
  return (
    <div className="rounded-lg border border-navy-100 bg-white p-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-navy-500">{label}</p>
        <Icon className="h-3 w-3 text-navy-400" />
      </div>
      <p className="mt-0.5 text-[16px] font-bold tabular-nums text-navy-900">{value}</p>
    </div>
  );
}

function QuotaRow({
  label,
  used,
  limit,
  isTokens = false,
  isCost = false,
}: {
  label: string;
  used: number;
  limit: number;
  isTokens?: boolean;
  isCost?: boolean;
}) {
  const fmt = isCost ? fmtCost : fmtNum;
  const noLimit = !limit || limit === 0;
  const pct = noLimit ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const tone =
    noLimit ? 'bg-navy-200' :
    pct >= 90 ? 'bg-danger-500' :
    pct >= 70 ? 'bg-warn-500' :
    'bg-success-500';
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-navy-700">
        <span className="text-[10.5px] uppercase tracking-wider text-navy-500">{label}</span>
        <span className="font-bold tabular-nums">
          {fmt(used)}{noLimit ? '' : ` / ${fmt(limit)}`}
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-navy-100">
        <div
          className={`h-full rounded-full transition-all ${tone}`}
          style={{ width: `${noLimit ? 0 : pct}%` }}
        />
      </div>
      <p className="mt-0.5 text-[9.5px] text-navy-400">
        {noLimit ? 'No limit set' : `${pct}% used${isTokens ? ' today' : isCost ? ' this month' : ' today'}`}
      </p>
    </div>
  );
}
