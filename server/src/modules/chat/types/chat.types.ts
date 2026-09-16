import type { UsageSummary } from '../../llm/types/llm.types';

export interface StoredMessage {
  id: string;
  role: string;
  parts: unknown;
  metadata?: unknown;
}

export interface ConversationSummary {
  id: string;
  title: string | null;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/** A passage returned by the search_documents tool, as the model sees it. */
export interface SourcePassage {
  ref: number;
  chunkId: string;
  documentId: string;
  document: string;
  chunkIndex: number;
  untrusted: boolean;
  content: string;
}

export interface SearchToolOutput {
  query: string;
  scope: string;
  passages: SourcePassage[];
}

/** A recording turned into text, with what the provider billed for it. */
export interface TranscriptionResult {
  text: string;
  seconds: number;
  costUsd: number | null;
}

export interface AnswerParams {
  /** Owner whose documents are searched and whose budget is charged. */
  userId: string;
  question: string;
  documentIds?: string[];
  traceId?: string;
  /** Catalog model id (default: the included model). */
  model?: string;
}

export interface AnswerResult {
  text: string;
  sources: SourcePassage[];
  searches: number;
  steps: number;
  usage: UsageSummary;
  /** Provider model id that answered. */
  model: string;
}
