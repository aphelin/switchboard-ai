import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, Clock, Ban } from 'lucide-react';
import { JobStatus, JOB_STATUS_LABELS } from '@/lib/constants';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

const STATUS_VARIANT: Record<JobStatus, BadgeVariant> = {
  [JobStatus.PENDING]: 'secondary',
  [JobStatus.GENERATING]: 'default',
  [JobStatus.COMPLETED]: 'outline',
  [JobStatus.FAILED]: 'destructive',
  [JobStatus.CANCELLED]: 'secondary',
};

const STATUS_ICON: Record<JobStatus, React.ElementType> = {
  [JobStatus.PENDING]: Clock,
  [JobStatus.GENERATING]: Loader2,
  [JobStatus.COMPLETED]: CheckCircle2,
  [JobStatus.FAILED]: XCircle,
  [JobStatus.CANCELLED]: Ban,
};

export function StatusBadge({ status }: { status: JobStatus }) {
  const Icon = STATUS_ICON[status];

  return (
    <Badge variant={STATUS_VARIANT[status]} className="gap-1">
      <Icon
        className={`h-3 w-3 ${status === JobStatus.GENERATING ? 'animate-spin' : ''}`}
      />
      {JOB_STATUS_LABELS[status]}
    </Badge>
  );
}
