import { Mark } from '@/components/tui/mark';
import { JobStatus, JOB_STATUS_LABELS } from '@/lib/constants';

/** Job status as a coloured dot and a word; pulses while generating. */
export function StatusBadge({ status, className }: { status: JobStatus; className?: string }) {
  switch (status) {
    case JobStatus.PENDING:
      return <Mark tone="warn" shape="hollow" className={className}>{JOB_STATUS_LABELS[status]}</Mark>;
    case JobStatus.GENERATING:
      return <Mark tone="info" live className={className}>{JOB_STATUS_LABELS[status]}</Mark>;
    case JobStatus.COMPLETED:
      return <Mark tone="ok" className={className}>{JOB_STATUS_LABELS[status]}</Mark>;
    case JobStatus.FAILED:
      return <Mark tone="err" className={className}>{JOB_STATUS_LABELS[status]}</Mark>;
    case JobStatus.CANCELLED:
      return <Mark tone="dim" shape="hollow" className={className}>{JOB_STATUS_LABELS[status]}</Mark>;
  }
}
