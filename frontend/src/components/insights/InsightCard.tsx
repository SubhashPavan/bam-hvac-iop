import { useState } from 'react';
import { Clock, Database, Layers, LayoutGrid, Check } from 'lucide-react';
import type { InsightResult } from '../../types/chat';
import TextSummary from './TextSummary';
import ChartRenderer from './ChartRenderer';

interface InsightCardProps {
  insight: InsightResult;
  onFollowUp?: (question: string) => void;
  onPushToCanvas?: () => void;
}

export default function InsightCard({ insight, onFollowUp, onPushToCanvas }: InsightCardProps) {
  const [pushed, setPushed] = useState(false);
  const { summary, charts, tables, execution_metadata } = insight;

  const handlePush = () => {
    if (onPushToCanvas && !pushed) {
      onPushToCanvas();
      setPushed(true);
    }
  };

  const kpiCharts = charts?.filter((c) => c.chart_type === 'kpi') || [];
  const vizCharts = charts?.filter((c) => c.chart_type !== 'kpi') || [];
  const gridCols =
    vizCharts.length === 1
      ? 'grid-cols-1'
      : vizCharts.length === 2
      ? 'grid-cols-1 md:grid-cols-2'
      : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';

  return (
    <div className="space-y-3">
      {/* Push to canvas action */}
      {onPushToCanvas &&
        ((charts && charts.length > 0) || (tables && tables.length > 0)) && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handlePush}
              disabled={pushed}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
                pushed
                  ? 'bg-success-50 text-success-700 ring-1 ring-inset ring-success-500/25'
                  : 'bg-accent-500 text-white shadow-sm hover:bg-accent-600'
              }`}
            >
              {pushed ? <Check className="h-3.5 w-3.5" /> : <LayoutGrid className="h-3.5 w-3.5" />}
              {pushed ? 'Added to canvas' : 'Push to canvas'}
            </button>
          </div>
        )}

      {/* Summary */}
      <TextSummary
        summary={summary}
        onFollowUp={onFollowUp}
        isConversational={execution_metadata?.sub_query_count === 0}
      />

      {/* KPI charts */}
      {kpiCharts.length > 0 && (
        <div className="rounded-xl border border-navy-100 bg-white p-1 shadow-sm">
          {kpiCharts.map((chart, i) => (
            <ChartRenderer key={`kpi-${i}`} chart={chart} />
          ))}
        </div>
      )}

      {/* Viz charts grid */}
      {vizCharts.length > 0 && (
        <div className={`grid gap-3 ${gridCols}`}>
          {vizCharts.map((chart, i) => (
            <div
              key={`viz-${i}`}
              className="overflow-hidden rounded-xl border border-navy-100 bg-white shadow-sm"
              style={{ minHeight: 280 }}
            >
              <ChartRenderer chart={chart} />
            </div>
          ))}
        </div>
      )}

      {/* Execution metadata */}
      {execution_metadata && execution_metadata.sub_query_count > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-navy-100 bg-navy-50/60 px-3 py-1.5 text-[11.5px] text-navy-600">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {execution_metadata.total_duration_ms < 1000
              ? `${Math.round(execution_metadata.total_duration_ms)}ms`
              : `${(execution_metadata.total_duration_ms / 1000).toFixed(1)}s`}
          </span>
          <span className="h-3 w-px bg-navy-200" />
          <span className="inline-flex items-center gap-1">
            <Layers className="h-3 w-3" />
            {execution_metadata.sub_query_count} queries
          </span>
          <span className="h-3 w-px bg-navy-200" />
          <span className="inline-flex items-center gap-1">
            <Database className="h-3 w-3" />
            {execution_metadata.total_rows.toLocaleString()} rows
          </span>
        </div>
      )}
    </div>
  );
}
