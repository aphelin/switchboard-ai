import { Badge } from '@/components/ui/badge';
import { JobPriority, JOB_PRIORITY_LABELS } from '@/lib/constants';

const PRIORITY_VARIANT = {
  [JobPriority.HIGH]: 'warning',
  [JobPriority.NORMAL]: 'secondary',
  [JobPriority.LOW]: 'secondary',
} as const;

/** Queue priority as a small pill. */
export function PriorityBadge({ priority, className }: { priority: JobPriority; className?: string }) {
  return (
    <Badge variant={PRIORITY_VARIANT[priority]} className={className} title={`${JOB_PRIORITY_LABELS[priority]} priority`}>
      {JOB_PRIORITY_LABELS[priority]}
    </Badge>
  );
}
