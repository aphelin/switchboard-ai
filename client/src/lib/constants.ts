export const GenerationType = {
  IMAGE: 'IMAGE',
  TEXT: 'TEXT',
} as const;
export type GenerationType = (typeof GenerationType)[keyof typeof GenerationType];

export const JobStatus = {
  PENDING: 'PENDING',
  GENERATING: 'GENERATING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;
export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

export const JobPriority = {
  HIGH: 'HIGH',
  NORMAL: 'NORMAL',
  LOW: 'LOW',
} as const;
export type JobPriority = (typeof JobPriority)[keyof typeof JobPriority];

export const JOB_PRIORITY_LABELS: Record<JobPriority, string> = {
  [JobPriority.HIGH]: 'High',
  [JobPriority.NORMAL]: 'Normal',
  [JobPriority.LOW]: 'Low',
} as const;

export const SseEventType = {
  STATUS_UPDATE: 'status-update',
  GENERATION_COMPLETE: 'generation-complete',
  DOCUMENT_UPDATE: 'document-update',
} as const;
export type SseEventType = (typeof SseEventType)[keyof typeof SseEventType];

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  [JobStatus.PENDING]: 'Pending',
  [JobStatus.GENERATING]: 'Generating',
  [JobStatus.COMPLETED]: 'Completed',
  [JobStatus.FAILED]: 'Failed',
  [JobStatus.CANCELLED]: 'Cancelled',
} as const;

export const DocumentStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  READY: 'READY',
  FAILED: 'FAILED',
} as const;
export type DocumentStatus = (typeof DocumentStatus)[keyof typeof DocumentStatus];

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  [DocumentStatus.PENDING]: 'Queued',
  [DocumentStatus.PROCESSING]: 'Indexing',
  [DocumentStatus.READY]: 'Ready',
  [DocumentStatus.FAILED]: 'Failed',
} as const;

export const SearchMode = {
  HYBRID: 'hybrid',
  VECTOR: 'vector',
  KEYWORD: 'keyword',
} as const;
export type SearchMode = (typeof SearchMode)[keyof typeof SearchMode];

export const SEARCH_MODE_LABELS: Record<SearchMode, string> = {
  [SearchMode.HYBRID]: 'Hybrid (vector + keyword)',
  [SearchMode.VECTOR]: 'Vector only',
  [SearchMode.KEYWORD]: 'Keyword only',
} as const;

/** Accepted upload types for the knowledge base. */
export const DOCUMENT_ACCEPT =
  '.txt,.md,.markdown,.pdf,text/plain,text/markdown,application/pdf';
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
