import { Mark } from '@/components/tui/mark';
import { DocumentStatus, DOCUMENT_STATUS_LABELS } from '@/lib/constants';

/** Ingestion status as a coloured dot and a word; pulses while indexing. */
export function DocumentStatusBadge({ status, className }: { status: DocumentStatus; className?: string }) {
  switch (status) {
    case DocumentStatus.PENDING:
      return <Mark tone="warn" shape="hollow" className={className}>{DOCUMENT_STATUS_LABELS[status]}</Mark>;
    case DocumentStatus.PROCESSING:
      return <Mark tone="info" live className={className}>{DOCUMENT_STATUS_LABELS[status]}</Mark>;
    case DocumentStatus.READY:
      return <Mark tone="ok" className={className}>{DOCUMENT_STATUS_LABELS[status]}</Mark>;
    case DocumentStatus.FAILED:
      return <Mark tone="err" className={className}>{DOCUMENT_STATUS_LABELS[status]}</Mark>;
  }
}
