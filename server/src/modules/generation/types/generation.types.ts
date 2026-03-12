export { GenerationType, JobStatus } from 'generated/prisma/enums';
import type { GenerationType, JobStatus } from 'generated/prisma/enums';

export interface Generation {
  id: string;
  prompt: string;
  enhancedPrompt: string | null;
  type: GenerationType;
  status: JobStatus;
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
  prompt: string;
  type: GenerationType;
  enhance: boolean;
  parameters?: ImageParameters | TextParameters;
}

export interface ImageParameters {
  model?: string;
  width?: number;
  height?: number;
  seed?: number;
  enhance?: boolean;
  negativePrompt?: string;
}

export interface TextParameters {
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
