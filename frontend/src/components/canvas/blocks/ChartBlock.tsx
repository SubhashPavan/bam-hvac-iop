import { memo } from 'react';
import ChartRenderer from '../../insights/ChartRenderer';
import type { ChartBlockData } from '../../../types/canvas';

interface ChartBlockProps {
  data: ChartBlockData;
  showData?: boolean;
}

function ChartBlockImpl({ data, showData }: ChartBlockProps) {
  return (
    <div className="h-full w-full min-h-0">
      <ChartRenderer chart={data.chart} compact showData={showData} />
    </div>
  );
}

const ChartBlock = memo(
  ChartBlockImpl,
  (prev, next) => prev.data === next.data && prev.showData === next.showData,
);
export default ChartBlock;
