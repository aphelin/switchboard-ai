import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { DocumentStatus, DOCUMENT_STATUS_LABELS } from '@/lib/constants';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

const STATUS_VARIANT: Record<DocumentStatus, BadgeVariant> = {
  [DocumentStatus.PENDING]: 'secondary',
  [DocumentStatus.PROCESSING]: 'default',
  [DocumentStatus.READY]: 'outline',
  [DocumentStatus.FAILED]: 'destructive',
};

const STATUS_ICON: Record<DocumentStatus, React.ElementType> = {
  [DocumentStatus.PENDING]: Clock,
  [DocumentStatus.PROCESSING]: Loader2,
  [DocumentStatus.READY]: CheckCircle2,
  [DocumentStatus.FAILED]: XCircle,
};

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  const Icon = STATUS_ICON[status];

  return (
    <Badge variant={STATUS_VARIANT[status]} className="gap-1">
      <Icon
        className={`h-3 w-3 ${status === DocumentStatus.PROCESSING ? 'animate-spin' : ''}`}
      />
      {DOCUMENT_STATUS_LABELS[status]}
    </Badge>
  );
}
