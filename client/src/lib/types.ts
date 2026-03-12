import type { GenerationType, JobStatus, JobPriority, SseEventType } from './constants';

export type { GenerationType, JobStatus, JobPriority, SseEventType } from './constants';

export interface Generation {
  id: string;
  prompt: string;
  enhancedPrompt: string | null;
  type: GenerationType;
  status: JobStatus;
  priority: JobPriority;
  imageUrl: string | null;
  textResult: string | null;
  error: string | null;
  parameters: Record<string, unknown> | null;
  jobId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateGenerationPayload {
  prompt: string;
  type: GenerationType;
  enhance?: boolean;
  priority?: JobPriority;
  parameters?: ImageParameters | TextParameters;
}

export interface ImageParameters {
  model?: string;
  width?: number;
  height?: number;
  seed?: number;
  negativePrompt?: string;
}

export interface TextParameters {
  model?: string;
  temperature?: number;
  systemPrompt?: string;
}

export interface SseEvent {
  type: SseEventType;
  generationId: string;
  status: JobStatus;
  imageUrl?: string;
  textResult?: string;
  error?: string;
  enhancedPrompt?: string;
}
