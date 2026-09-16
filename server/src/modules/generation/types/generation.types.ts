export { GenerationType, JobStatus, JobPriority } from 'generated/prisma/enums';
import type {
  GenerationType,
  JobStatus,
  JobPriority,
} from 'generated/prisma/enums';

export interface Generation {
  id: string;
  userId: string | null;
  prompt: string;
  enhancedPrompt: string | null;
  type: GenerationType;
  status: JobStatus;
  priority: JobPriority;
  imageUrl: string | null;
  textResult: string | null;
  error: string | null;
  parameters: unknown;
  jobId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GenerationJobData {
  generationId: string;
  userId: string;
  prompt: string;
  type: GenerationType;
  enhance: boolean;
  /** Catalog model id for text generation / prompt enhancement (default: the included model). */
  llmModel?: string;
  parameters?: ImageParameters | TextParameters;
}

export interface ImageParameters {
  model?: string;
  width?: number;
  height?: number;
  seed?: number;
  enhance?: boolean;
  negativePrompt?: string;
  /** Set on an edit: the finished image (same owner) the prompt is applied to. */
  sourceGenerationId?: string;
}

export interface TextParameters {
  /** Provider model id that produced the result (set by the worker). */
  model?: string;
  temperature?: number;
  systemPrompt?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
