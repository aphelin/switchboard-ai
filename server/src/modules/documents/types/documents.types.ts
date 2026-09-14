export { DocumentStatus } from 'generated/prisma/enums';
import type { DocumentStatus } from 'generated/prisma/enums';

export interface DocumentSummary {
  id: string;
  title: string;
  source: string | null;
  mimeType: string | null;
  status: DocumentStatus;
  chunkCount: number;
  error: string | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentIngestionJobData {
  documentId: string;
}

export interface TextChunk {
  index: number;
  content: string;
  tokenCount: number;
}

export interface ChunkRow {
  id: string;
  documentId: string;
  documentTitle: string;
  index: number;
  content: string;
  tokenCount: number;
  score: number;
}

export type SearchMode = 'hybrid' | 'vector' | 'keyword';

export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  content: string;
  /** Fused (RRF) score; only meaningful for ordering. */
  score: number;
  vectorScore?: number;
  keywordScore?: number;
  ranks: Record<string, number>;
  /** Heuristic prompt-injection flag; the model is told to treat such passages as untrusted. */
  flagged: boolean;
  flagReasons: string[];
}

export interface SearchParams {
  /** Only this user's documents are searched; the filter is part of the SQL query. */
  userId: string;
  query: string;
  topK?: number;
  documentIds?: string[];
  mode?: SearchMode;
  traceId?: string;
}

export interface UploadedFileLike {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}
