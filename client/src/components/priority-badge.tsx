import { Badge } from '@/components/ui/badge';
import { ChevronUp, Minus, ChevronDown } from 'lucide-react';
import { JobPriority, JOB_PRIORITY_LABELS } from '@/lib/constants';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

const PRIORITY_VARIANT: Record<JobPriority, BadgeVariant> = {
  [JobPriority.HIGH]: 'destructive',
  [JobPriority.NORMAL]: 'secondary',
  [JobPriority.LOW]: 'outline',
};

const PRIORITY_ICON: Record<JobPriority, React.ElementType> = {
  [JobPriority.HIGH]: ChevronUp,
  [JobPriority.NORMAL]: Minus,
  [JobPriority.LOW]: ChevronDown,
};

export function PriorityBadge({ priority }: { priority: JobPriority }) {
  const Icon = PRIORITY_ICON[priority];

  return (
    <Badge variant={PRIORITY_VARIANT[priority]} className="gap-1">
      <Icon className="h-3 w-3" />
      {JOB_PRIORITY_LABELS[priority]}
    </Badge>
  );
}
