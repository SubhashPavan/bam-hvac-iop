import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, Table2 } from 'lucide-react';
import type { TableData } from '../../types/chat';

interface DataTableProps {
  table: TableData;
}

function fmtCell(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number') {
    if (Math.abs(value) >= 1_000_000_000) {
      return `${(value / 1_000_000_000).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}B`;
    }
    if (Math.abs(value) >= 1_000_000) {
      return `${(value / 1_000_000).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}M`;
    }
    if (Number.isInteger(value)) return value.toLocaleString('en-US');
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return String(value);
}

export default function DataTable({ table }: DataTableProps) {
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [expanded, setExpanded] = useState(false);

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const sortedData = useMemo(() => {
    if (!sortCol) return table.data;
    return [...table.data].sort((a, b) => {
      const aVal = a[sortCol];
      const bVal = b[sortCol];
      if (aVal === bVal) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp =
        typeof aVal === 'number' && typeof bVal === 'number'
          ? aVal - bVal
          : String(aVal).localeCompare(String(bVal));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [table.data, sortCol, sortDir]);

  const displayData = expanded ? sortedData : sortedData.slice(0, 8);
  const hasMore = sortedData.length > 8;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Table header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-navy-100 px-3 py-2">
        <Table2 className="h-3.5 w-3.5 text-cyan-500" />
        <h4 className="flex-1 truncate text-[12.5px] font-semibold text-navy-800">{table.title}</h4>
        <span className="shrink-0 rounded-full bg-navy-100 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-navy-600">
          {table.data.length} rows
        </span>
      </div>

      {/* Table */}
      <div className="custom-scrollbar flex-1 overflow-auto">
        <table className="w-full border-collapse text-[12.5px]">
          <thead className="sticky top-0 z-10 bg-navy-50 shadow-[inset_0_-1px_0_#D9E2EC]">
            <tr>
              {table.columns.map((col) => (
                <th
                  key={col}
                  onClick={() => handleSort(col)}
                  className="cursor-pointer select-none px-3 py-2 text-left text-[10.5px] font-semibold uppercase tracking-wider text-navy-600 transition-colors hover:bg-navy-100"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>{col}</span>
                    {sortCol === col &&
                      (sortDir === 'asc' ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      ))}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayData.map((row, i) => (
              <tr
                key={i}
                className="border-t border-navy-100 transition-colors odd:bg-white even:bg-navy-50/30 hover:bg-accent-50/50"
              >
                {table.columns.map((col) => (
                  <td
                    key={col}
                    className="whitespace-nowrap px-3 py-1.5 tabular-nums text-navy-800"
                  >
                    {fmtCell(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Expand button */}
      {hasMore && (
        <div className="border-t border-navy-100 bg-navy-50/50 px-3 py-1.5 text-center">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-[12px] font-semibold text-accent-600 transition-colors hover:text-accent-700"
          >
            {expanded ? 'Show less' : `Show all ${sortedData.length} rows`}
          </button>
        </div>
      )}
    </div>
  );
}
