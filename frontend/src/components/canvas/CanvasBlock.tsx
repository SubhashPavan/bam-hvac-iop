import { useState, useRef, useEffect, cloneElement, isValidElement, memo } from 'react';
import {
  X,
  Maximize2,
  Minimize2,
  GripVertical,
  BarChart3,
  Table2,
  Hash,
  FileText,
  Brain,
  Sparkles,
  ArrowLeftRight,
  ListFilter,
  Eye,
  EyeOff,
} from 'lucide-react';
import type { CanvasBlock as CanvasBlockType, ChartBlockData } from '../../types/canvas';
import type { ChartType } from '../../types/chat';
import { useCanvasStore } from '../../store/canvasStore';

function renderBoldText(text: string) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part));
}

interface CanvasBlockProps {
  block: CanvasBlockType;
  workspaceId: string;
  isHighlighted: boolean;
  onRemove: () => void;
  /** Toggle full-canvas-width sizing. Sets w=12, x=0; restores the prior
   *  width when invoked again on an already-maximized block. */
  onToggleFullWidth?: () => void;
  children: React.ReactNode;
}

/** Per-type color accents using Tailwind classes */
const TYPE_CONFIG: Record<
  string,
  { icon: typeof BarChart3; label: string; tone: string; bar: string }
> = {
  chart: { icon: BarChart3, label: 'Chart', tone: 'text-accent-700 bg-accent-50 ring-accent-200', bar: 'bg-accent-500' },
  table: { icon: Table2, label: 'Table', tone: 'text-cyan-700 bg-cyan-50 ring-cyan-200', bar: 'bg-cyan-500' },
  kpi: { icon: Hash, label: 'KPI', tone: 'text-amber-700 bg-amber-50 ring-amber-200', bar: 'bg-amber-500' },
  narrative: { icon: FileText, label: 'Summary', tone: 'text-emerald-700 bg-emerald-50 ring-emerald-200', bar: 'bg-emerald-500' },
  deep_analysis: { icon: Brain, label: 'Analysis', tone: 'text-violet-700 bg-violet-50 ring-violet-200', bar: 'bg-violet-500' },
};

const SIGNIFICANCE_COLORS: Record<string, string> = {
  high: 'bg-accent-500',
  medium: 'bg-amber-500',
  low: 'bg-navy-400',
};

const CHART_TYPE_LABELS: Record<ChartType, string> = {
  bar: 'Bar',
  grouped_bar: 'Grouped Bar',
  horizontal_bar: 'Horizontal Bar',
  stacked_bar: 'Stacked Bar',
  line: 'Line',
  multi_line: 'Multi-Line',
  area: 'Area',
  scatter: 'Scatter',
  pie: 'Pie',
  treemap: 'Treemap',
  funnel: 'Funnel',
  radar: 'Radar',
  radial_bar: 'Radial Bar',
  gauge: 'Gauge',
  heatmap: 'Heatmap',
  waterfall: 'Waterfall',
  kpi: 'KPI',
  table: 'Table',
};

const CONVERTIBLE_TYPES: ChartType[] = [
  'bar',
  'grouped_bar',
  'horizontal_bar',
  'stacked_bar',
  'line',
  'multi_line',
  'area',
  'pie',
  'scatter',
  'treemap',
  'funnel',
  'radar',
  'radial_bar',
];

function CanvasBlockImpl({
  block,
  workspaceId,
  isHighlighted,
  onRemove,
  onToggleFullWidth,
  children,
}: CanvasBlockProps) {
  const config = TYPE_CONFIG[block.type] || TYPE_CONFIG.chart;
  const Icon = config.icon;
  const [showInfo, setShowInfo] = useState(false);
  const [showChartMenu, setShowChartMenu] = useState(false);
  const [showSeriesMenu, setShowSeriesMenu] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const chartMenuRef = useRef<HTMLDivElement>(null);
  const seriesMenuRef = useRef<HTMLDivElement>(null);

  const isChart = block.type === 'chart';
  const isKpi = block.type === 'kpi';
  const currentChartType = isChart ? (block.data as ChartBlockData).chart.chart_type : null;
  const [showData, setShowData] = useState(false);

  // ── Derive the list of toggle-able series for chart blocks. We pull
  // from chart.y_axis when the planner gave us one (most reliable), and
  // fall back to scanning the first data row for numeric columns when
  // y_axis is missing/empty (matches ChartRenderer's defensive logic).
  const chartSeries = (() => {
    if (!isChart) return [] as string[];
    const chart = (block.data as ChartBlockData).chart;
    const yRaw = chart.y_axis;
    let keys = Array.isArray(yRaw) ? [...yRaw] : yRaw ? [yRaw] : [];
    if (keys.length === 0 && chart.data.length > 0) {
      const firstRow = chart.data[0];
      keys = Object.keys(firstRow).filter(
        (k) => k !== chart.x_axis && typeof firstRow[k] === 'number',
      );
    }
    return keys;
  })();
  const hiddenSet = new Set<string>(
    isChart ? (block.data as ChartBlockData).chart.hidden_series || [] : [],
  );
  const visibleCount = chartSeries.filter((s) => !hiddenSet.has(s)).length;
  const canToggleSeries = isChart && chartSeries.length >= 2;

  useEffect(() => {
    if (!showInfo && !showChartMenu && !showSeriesMenu) return;
    function handleClick(e: MouseEvent) {
      if (showInfo && popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowInfo(false);
      }
      if (
        showChartMenu &&
        chartMenuRef.current &&
        !chartMenuRef.current.contains(e.target as Node)
      ) {
        setShowChartMenu(false);
      }
      if (
        showSeriesMenu &&
        seriesMenuRef.current &&
        !seriesMenuRef.current.contains(e.target as Node)
      ) {
        setShowSeriesMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showInfo, showChartMenu, showSeriesMenu]);

  const hasMeta =
    block.insightMeta &&
    (block.insightMeta.narrative || block.insightMeta.keyFindings.length > 0);

  const handleConvertChart = (newType: ChartType) => {
    if (!isChart) return;
    const chartData = block.data as ChartBlockData;
    const updatedChart = { ...chartData.chart, chart_type: newType };
    useCanvasStore
      .getState()
      .updateBlockData(workspaceId, block.id, { chart: updatedChart });
    setShowChartMenu(false);
  };

  // Toggle one series on/off. We refuse to hide the last visible series
  // (the chart needs at least one to render meaningfully).
  const handleToggleSeries = (seriesKey: string) => {
    if (!isChart) return;
    const chartData = block.data as ChartBlockData;
    const current = new Set<string>(chartData.chart.hidden_series || []);
    if (current.has(seriesKey)) {
      current.delete(seriesKey);
    } else {
      // Don't allow hiding the last visible series
      const wouldRemain = chartSeries.filter(
        (s) => s !== seriesKey && !current.has(s),
      ).length;
      if (wouldRemain === 0) return;
      current.add(seriesKey);
    }
    const next = current.size > 0 ? Array.from(current) : undefined;
    const updatedChart = { ...chartData.chart, hidden_series: next };
    useCanvasStore
      .getState()
      .updateBlockData(workspaceId, block.id, { chart: updatedChart });
  };

  // "Reset" — show all series (clears the hidden_series field).
  const handleResetSeries = () => {
    if (!isChart) return;
    const chartData = block.data as ChartBlockData;
    const updatedChart = { ...chartData.chart, hidden_series: undefined };
    useCanvasStore
      .getState()
      .updateBlockData(workspaceId, block.id, { chart: updatedChart });
  };

  // ── KPI blocks render chrome-less: just the tile + floating delete
  // button. Tiles fill their grid cell so they sit flush next to each
  // other (multiple KPIs per row).
  if (isKpi) {
    return (
      <div
        className={`drag-handle group relative h-full w-full cursor-grab transition-all active:cursor-grabbing ${
          isHighlighted ? 'rounded-xl ring-2 ring-accent-400' : ''
        }`}
      >
        {children}
        <button
          type="button"
          onClick={onRemove}
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute right-2 top-2 z-20 flex h-6 w-6 items-center justify-center rounded-md bg-white/90 text-navy-400 opacity-0 shadow-sm ring-1 ring-navy-100 backdrop-blur transition-all hover:bg-danger-50 hover:text-danger-600 hover:ring-danger-200 group-hover:opacity-100"
          title="Remove"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={`group relative flex h-full flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition-all ${
        isHighlighted
          ? 'border-accent-400 ring-2 ring-accent-200'
          : 'border-navy-100 hover:border-navy-200 hover:shadow-md'
      }`}
    >
      {/* Top accent bar */}
      <div className={`h-[3px] w-full shrink-0 ${config.bar}`} />

      {/* Block header — drag handle */}
      <div className="drag-handle flex shrink-0 cursor-grab items-center justify-between gap-2 border-b border-navy-100 bg-white px-3 py-2 active:cursor-grabbing">
        <div className="flex min-w-0 items-center gap-2">
          <GripVertical className="h-3.5 w-3.5 text-navy-300" />
          <Icon className={`h-3.5 w-3.5 ${config.tone.split(' ')[0]}`} />
          <span className="truncate text-[12.5px] font-semibold text-navy-800">{block.title}</span>
          <span
            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset ${config.tone}`}
          >
            {config.label}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {isChart && (
            <button
              type="button"
              onClick={() => setShowData(!showData)}
              onMouseDown={(e) => e.stopPropagation()}
              className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
                showData
                  ? 'bg-accent-50 text-accent-700 ring-1 ring-inset ring-accent-200'
                  : 'text-navy-400 hover:bg-navy-50 hover:text-navy-700'
              }`}
              title={showData ? 'View chart' : 'View data'}
            >
              {showData ? <BarChart3 className="h-3 w-3" /> : <Table2 className="h-3 w-3" />}
            </button>
          )}
          {isChart && (
            <button
              type="button"
              onClick={() => {
                setShowChartMenu(!showChartMenu);
                setShowInfo(false);
                setShowSeriesMenu(false);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
                showChartMenu
                  ? 'bg-accent-50 text-accent-700 ring-1 ring-inset ring-accent-200'
                  : 'text-navy-400 hover:bg-navy-50 hover:text-navy-700'
              }`}
              title="Convert chart type"
            >
              <ArrowLeftRight className="h-3 w-3" />
            </button>
          )}
          {canToggleSeries && (
            <button
              type="button"
              onClick={() => {
                setShowSeriesMenu(!showSeriesMenu);
                setShowChartMenu(false);
                setShowInfo(false);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
                showSeriesMenu || hiddenSet.size > 0
                  ? 'bg-accent-50 text-accent-700 ring-1 ring-inset ring-accent-200'
                  : 'text-navy-400 hover:bg-navy-50 hover:text-navy-700'
              }`}
              title={
                hiddenSet.size > 0
                  ? `Show/hide series (${visibleCount} of ${chartSeries.length} shown)`
                  : 'Show/hide series'
              }
            >
              <ListFilter className="h-3 w-3" />
            </button>
          )}
          {hasMeta && (
            <button
              type="button"
              onClick={() => {
                setShowInfo(!showInfo);
                setShowChartMenu(false);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
                showInfo
                  ? 'bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200'
                  : 'text-navy-400 hover:bg-navy-50 hover:text-navy-700'
              }`}
              title="View insight summary"
            >
              <Sparkles className="h-3 w-3" />
            </button>
          )}
          {onToggleFullWidth && (
            <button
              type="button"
              onClick={onToggleFullWidth}
              onMouseDown={(e) => e.stopPropagation()}
              className="flex h-6 w-6 items-center justify-center rounded-md text-navy-400 hover:bg-navy-50 hover:text-navy-700"
              title={block.layout.w >= 12 ? 'Restore width' : 'Expand to full width'}
            >
              {block.layout.w >= 12 ? (
                <Minimize2 className="h-3 w-3" />
              ) : (
                <Maximize2 className="h-3 w-3" />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={onRemove}
            onMouseDown={(e) => e.stopPropagation()}
            className="flex h-6 w-6 items-center justify-center rounded-md text-navy-400 hover:bg-danger-50 hover:text-danger-600"
            title="Remove"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Chart type conversion menu */}
      {showChartMenu && isChart && (
        <div
          ref={chartMenuRef}
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute right-3 top-12 z-30 w-64 rounded-xl border border-navy-100 bg-white p-2 shadow-lg"
        >
          <div className="mb-1.5 px-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-navy-500">
            Convert to
          </div>
          <div className="grid grid-cols-2 gap-1">
            {CONVERTIBLE_TYPES.map((type) => {
              const active = type === currentChartType;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleConvertChart(type)}
                  disabled={active}
                  className={`rounded-md px-2 py-1.5 text-left text-[12px] font-medium transition-colors ${
                    active
                      ? 'cursor-default bg-accent-500 text-white'
                      : 'text-navy-700 hover:bg-navy-50 hover:text-navy-900'
                  }`}
                >
                  {CHART_TYPE_LABELS[type]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Series visibility popover — toggle data columns on/off and save */}
      {showSeriesMenu && canToggleSeries && (
        <div
          ref={seriesMenuRef}
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute right-3 top-12 z-30 w-64 rounded-xl border border-navy-100 bg-white p-2 shadow-lg"
        >
          <div className="flex items-center justify-between px-1.5 pb-1.5">
            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-navy-500">
              Show/hide series
            </span>
            {hiddenSet.size > 0 && (
              <button
                type="button"
                onClick={handleResetSeries}
                className="rounded px-1.5 py-0.5 text-[10.5px] font-semibold text-accent-600 hover:bg-accent-50"
              >
                Reset
              </button>
            )}
          </div>
          <div className="max-h-64 space-y-0.5 overflow-y-auto">
            {chartSeries.map((s) => {
              const visible = !hiddenSet.has(s);
              const isLastVisible = visible && visibleCount === 1;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleToggleSeries(s)}
                  disabled={isLastVisible}
                  className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-[12px] transition-colors ${
                    visible
                      ? 'text-navy-800 hover:bg-navy-50'
                      : 'text-navy-400 hover:bg-navy-50'
                  } ${isLastVisible ? 'cursor-not-allowed opacity-60' : ''}`}
                  title={
                    isLastVisible
                      ? 'At least one series must remain visible'
                      : visible
                        ? 'Click to hide this series'
                        : 'Click to show this series'
                  }
                >
                  <span className="min-w-0 flex-1 truncate font-medium">{s}</span>
                  {visible ? (
                    <Eye className="h-3.5 w-3.5 shrink-0 text-accent-600" />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5 shrink-0 text-navy-300" />
                  )}
                </button>
              );
            })}
          </div>
          <p className="mt-1 px-1.5 pt-1 text-[10px] text-navy-400">
            Hidden series stay in the underlying data — re-enable any time.
          </p>
        </div>
      )}

      {/* Insight info popover */}
      {showInfo && block.insightMeta && (
        <div
          ref={popoverRef}
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute right-3 top-12 z-30 w-80 rounded-xl border border-navy-100 bg-white shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-navy-100 px-3.5 py-2.5">
            <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-navy-800">
              <Sparkles className="h-3.5 w-3.5 text-violet-500" />
              Insight summary
            </span>
            <button
              type="button"
              onClick={() => setShowInfo(false)}
              className="flex h-6 w-6 items-center justify-center rounded-md text-navy-400 hover:bg-navy-50 hover:text-navy-700"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto px-3.5 py-3">
            <p className="text-[12.5px] leading-relaxed text-navy-700">
              {renderBoldText(block.insightMeta.narrative)}
            </p>
            {block.insightMeta.keyFindings.length > 0 && (
              <div className="mt-3 border-t border-navy-100 pt-3">
                <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-navy-500">
                  Key findings
                </p>
                <div className="space-y-2">
                  {block.insightMeta.keyFindings.map((f, i) => (
                    <div key={i} className="flex gap-2">
                      <span
                        className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                          SIGNIFICANCE_COLORS[f.significance] || 'bg-navy-400'
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="text-[12.5px] font-semibold text-navy-800">{f.headline}</p>
                        <p className="text-[12px] leading-relaxed text-navy-500">{f.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Block content */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {isChart && isValidElement(children)
          ? cloneElement(children as React.ReactElement<{ showData?: boolean }>, { showData })
          : children}
      </div>
    </div>
  );
}

/** Memoized: shallow-compares props so canvas-wide re-layouts (drag, resize)
 *  don't ripple into every block's chart pipeline. */
const CanvasBlock = memo(CanvasBlockImpl, (prev, next) => {
  return (
    prev.block === next.block &&
    prev.workspaceId === next.workspaceId &&
    prev.isHighlighted === next.isHighlighted &&
    prev.onRemove === next.onRemove &&
    prev.onToggleFullWidth === next.onToggleFullWidth &&
    prev.children === next.children
  );
});
export default CanvasBlock;
