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
} as const;
export type SseEventType = (typeof SseEventType)[keyof typeof SseEventType];

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  [JobStatus.PENDING]: 'Pending',
  [JobStatus.GENERATING]: 'Generating',
  [JobStatus.COMPLETED]: 'Completed',
  [JobStatus.FAILED]: 'Failed',
  [JobStatus.CANCELLED]: 'Cancelled',
} as const;
