import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  BarChart3,
  Eye,
  EyeOff,
  ListFilter,
  Table2,
} from 'lucide-react';
import type { ChartRecommendation, ChartType } from '../../types/chat';

/* Reusable toolbar that sits in the header of a chart-rendering card.
 *
 * Provides three controls (each optional via flags):
 *   1. Data toggle  — flip between chart and underlying table view
 *   2. Chart-type converter (popover with all compatible chart types)
 *   3. Hide / show series (popover with one row per y-axis key)
 *
 * It is intentionally presentation-only: the parent owns the chart spec
 * and persistence. The toolbar only emits change events:
 *
 *   onShowDataToggle()                       — flip data ↔ chart
 *   onChartChange(nextChart: ChartRecommendation)  — chart spec updated
 *
 * The parent decides what "persist" means (write to canvas store, hit a
 * backend endpoint, or just keep local state).
 */

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

interface ChartToolbarProps {
  chart: ChartRecommendation;
  /** Called when the user flips the data ↔ chart toggle. */
  onShowDataToggle?: () => void;
  showData?: boolean;
  /** Called whenever the user converts the chart type or toggles a
   *  series. The parent decides where to persist. Omit to make the
   *  toolbar read-only (only the data toggle remains usable). */
  onChartChange?: (next: ChartRecommendation) => void;
  /** Optional className for the toolbar wrapper (lets the caller align
   *  it with their own header styles). */
  className?: string;
  /** Hide individual buttons if a particular surface doesn't need them. */
  hideDataToggle?: boolean;
  hideTypeConverter?: boolean;
  hideSeriesToggle?: boolean;
}

export default function ChartToolbar({
  chart,
  onShowDataToggle,
  showData = false,
  onChartChange,
  className = '',
  hideDataToggle = false,
  hideTypeConverter = false,
  hideSeriesToggle = false,
}: ChartToolbarProps) {
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [showSeriesMenu, setShowSeriesMenu] = useState(false);
  const typeMenuRef = useRef<HTMLDivElement>(null);
  const seriesMenuRef = useRef<HTMLDivElement>(null);

  // Click-outside handlers for both popovers.
  useEffect(() => {
    if (!showTypeMenu && !showSeriesMenu) return;
    function handle(e: MouseEvent) {
      if (
        showTypeMenu &&
        typeMenuRef.current &&
        !typeMenuRef.current.contains(e.target as Node)
      ) {
        setShowTypeMenu(false);
      }
      if (
        showSeriesMenu &&
        seriesMenuRef.current &&
        !seriesMenuRef.current.contains(e.target as Node)
      ) {
        setShowSeriesMenu(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [showTypeMenu, showSeriesMenu]);

  // Derive y-axis keys for the series toggle. Falls back to detecting
  // numeric columns from the first data row when y_axis is unset (mirrors
  // ChartRenderer's defensive logic).
  const series = (() => {
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
  const hidden = new Set<string>(chart.hidden_series || []);
  const visibleCount = series.filter((s) => !hidden.has(s)).length;
  const canToggleSeries = !hideSeriesToggle && series.length >= 2 && !!onChartChange;
  const canConvertType = !hideTypeConverter && !!onChartChange;
  const canToggleData = !hideDataToggle && !!onShowDataToggle;

  const handleConvert = (newType: ChartType) => {
    if (!onChartChange) return;
    onChartChange({ ...chart, chart_type: newType });
    setShowTypeMenu(false);
  };

  const handleToggleSeries = (seriesKey: string) => {
    if (!onChartChange) return;
    const next = new Set<string>(chart.hidden_series || []);
    if (next.has(seriesKey)) {
      next.delete(seriesKey);
    } else {
      // Refuse to hide the last visible series — the chart needs at
      // least one to render.
      const remaining = series.filter((s) => s !== seriesKey && !next.has(s)).length;
      if (remaining === 0) return;
      next.add(seriesKey);
    }
    onChartChange({
      ...chart,
      hidden_series: next.size > 0 ? Array.from(next) : undefined,
    });
  };

  const handleResetSeries = () => {
    if (!onChartChange) return;
    onChartChange({ ...chart, hidden_series: undefined });
  };

  return (
    <div className={`relative flex shrink-0 items-center gap-0.5 ${className}`}>
      {canToggleData && (
        <button
          type="button"
          onClick={onShowDataToggle}
          onMouseDown={(e) => e.stopPropagation()}
          className={`no-drag flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
            showData
              ? 'bg-accent-50 text-accent-700 ring-1 ring-inset ring-accent-200'
              : 'text-navy-400 hover:bg-navy-50 hover:text-navy-700'
          }`}
          title={showData ? 'View chart' : 'View data'}
        >
          {showData ? <BarChart3 className="h-3.5 w-3.5" /> : <Table2 className="h-3.5 w-3.5" />}
        </button>
      )}
      {canConvertType && (
        <button
          type="button"
          onClick={() => {
            setShowTypeMenu((v) => !v);
            setShowSeriesMenu(false);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className={`no-drag flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
            showTypeMenu
              ? 'bg-accent-50 text-accent-700 ring-1 ring-inset ring-accent-200'
              : 'text-navy-400 hover:bg-navy-50 hover:text-navy-700'
          }`}
          title="Change chart type"
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
        </button>
      )}
      {canToggleSeries && (
        <button
          type="button"
          onClick={() => {
            setShowSeriesMenu((v) => !v);
            setShowTypeMenu(false);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className={`no-drag flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
            showSeriesMenu || hidden.size > 0
              ? 'bg-accent-50 text-accent-700 ring-1 ring-inset ring-accent-200'
              : 'text-navy-400 hover:bg-navy-50 hover:text-navy-700'
          }`}
          title={
            hidden.size > 0
              ? `Show / hide series (${visibleCount} of ${series.length} shown)`
              : 'Show / hide series'
          }
        >
          <ListFilter className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Chart type popover */}
      {showTypeMenu && canConvertType && (
        <div
          ref={typeMenuRef}
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute right-0 top-9 z-30 w-64 rounded-xl border border-navy-100 bg-white p-2 shadow-lg"
        >
          <div className="mb-1.5 px-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-navy-500">
            Convert to
          </div>
          <div className="grid grid-cols-2 gap-1">
            {CONVERTIBLE_TYPES.map((type) => {
              const active = type === chart.chart_type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleConvert(type)}
                  disabled={active}
                  className={`no-drag rounded-md px-2 py-1.5 text-left text-[12px] font-medium transition-colors ${
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

      {/* Series visibility popover */}
      {showSeriesMenu && canToggleSeries && (
        <div
          ref={seriesMenuRef}
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute right-0 top-9 z-30 w-64 rounded-xl border border-navy-100 bg-white p-2 shadow-lg"
        >
          <div className="flex items-center justify-between px-1.5 pb-1.5">
            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-navy-500">
              Show / hide series
            </span>
            {hidden.size > 0 && (
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
            {series.map((s) => {
              const visible = !hidden.has(s);
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
    </div>
  );
}
