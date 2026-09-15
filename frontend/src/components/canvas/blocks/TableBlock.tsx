import { memo } from 'react';
import DataTable from '../../insights/DataTable';
import type { TableBlockData } from '../../../types/canvas';

interface TableBlockProps {
  data: TableBlockData;
}

function TableBlockImpl({ data }: TableBlockProps) {
  return <DataTable table={data.table} />;
}

const TableBlock = memo(TableBlockImpl, (prev, next) => prev.data === next.data);
export default TableBlock;
