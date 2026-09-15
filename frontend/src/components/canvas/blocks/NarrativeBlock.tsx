import { memo } from 'react';
import TextSummary from '../../insights/TextSummary';
import type { NarrativeBlockData } from '../../../types/canvas';

interface NarrativeBlockProps {
  data: NarrativeBlockData;
  onFollowUp?: (question: string) => void;
}

function NarrativeBlockImpl({ data, onFollowUp }: NarrativeBlockProps) {
  return <TextSummary summary={data.summary} onFollowUp={onFollowUp} />;
}

const NarrativeBlock = memo(
  NarrativeBlockImpl,
  (prev, next) => prev.data === next.data && prev.onFollowUp === next.onFollowUp,
);
export default NarrativeBlock;
