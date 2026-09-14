import type {
  GenerationType,
  JobStatus,
  JobPriority,
  SseEventType,
  DocumentStatus,
  SearchMode,
} from './constants';

export type {
  GenerationType,
  JobStatus,
  JobPriority,
  SseEventType,
  DocumentStatus,
  SearchMode,
} from './constants';

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
  /**
   * Catalog model id (`<provider>:<modelId>`) for TEXT generations and for
   * prompt enhancement on images. Not used for the image model itself.
   */
  llmModel?: string;
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

/** Events on the generations stream (`/generations/sse`). */
export interface SseEvent {
  type: SseEventType;
  generationId: string;
  status: JobStatus;
  imageUrl?: string;
  textResult?: string;
  error?: string;
  enhancedPrompt?: string;
}

/** Events on the documents stream (`/documents/sse`). */
export interface DocumentSseEvent {
  type: 'document-update';
  documentId: string;
  status: DocumentStatus;
  chunkCount?: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Documents (RAG knowledge base)
// ---------------------------------------------------------------------------

export interface DocumentSummary {
  id: string;
  title: string;
  source: string | null;
  mimeType: string | null;
  status: DocumentStatus;
  chunkCount: number;
  error: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentDetail extends DocumentSummary {
  content: string;
}

export interface DocumentChunk {
  id: string;
  index: number;
  content: string;
  tokenCount: number;
}

export interface SearchResult {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  content: string;
  /** Fused (RRF) score, only meaningful for ordering. */
  score: number;
  vectorScore?: number;
  keywordScore?: number;
  ranks: { vector?: number; keyword?: number };
  flagged: boolean;
  flagReasons: string[];
}

export interface SearchResponse {
  query: string;
  mode: SearchMode;
  results: SearchResult[];
}

export interface SearchPayload {
  query: string;
  topK?: number;
  documentIds?: string[];
  mode?: SearchMode;
}

// ---------------------------------------------------------------------------
// Chat (agent conversations)
// ---------------------------------------------------------------------------

export interface ConversationSummary {
  id: string;
  title: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface StoredMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts: unknown[];
  metadata?: unknown;
}

export interface ConversationDetail {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  messages: StoredMessage[];
}

/** Output of the assistant's `search_documents` tool. */
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

/** Output of the assistant's `generate_image` tool. */
export interface GenerateImageToolOutput {
  generationId: string;
  status: JobStatus;
  imageUrl: string | null;
  error: string | null;
  note?: string;
}

// ---------------------------------------------------------------------------
// Observability (LLM call traces)
// ---------------------------------------------------------------------------

export interface LlmCall {
  id: string;
  traceId: string | null;
  name: string;
  provider: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  cachedInputTokens: number | null;
  costUsd: number | null;
  latencyMs: number;
  status: 'ok' | 'error';
  error: string | null;
  metadata: Record<string, unknown> | null;
  /** Whose API key paid for the call: the app's platform key or the user's own. */
  keySource: KeySource;
  createdAt: string;
}

export type KeySource = 'platform' | 'user';

export interface TraceSummary {
  totals: {
    calls: number;
    errors: number;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    avgLatencyMs: number;
  };
  byModel: Array<{
    provider: string;
    model: string;
    calls: number;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    avgLatencyMs: number;
  }>;
  byName: Array<{
    name: string;
    calls: number;
    costUsd: number;
    avgLatencyMs: number;
  }>;
}

export interface MeResponse {
  user: {
    id: string;
    name: string;
    email: string;
  };
  usage: {
    spentTodayUsd: number;
    /** null means no daily limit is configured. */
    dailyBudgetUsd: number | null;
    /** Estimated spend today on the user's own provider keys (not budgeted). */
    ownKeysSpentTodayUsd: number;
  };
}

// ---------------------------------------------------------------------------
// AI providers and models (bring your own key)
// ---------------------------------------------------------------------------

export type ProviderId = 'platform' | 'openai' | 'anthropic' | 'google';

export type ModelTier = 'flagship' | 'balanced' | 'fast';

export interface CatalogModel {
  /** `<provider>:<modelId>`, e.g. `anthropic:claude-sonnet-5`. Send this back. */
  id: string;
  provider: ProviderId;
  modelId: string;
  label: string;
  description: string;
  tier: ModelTier;
  capabilities: { tools: boolean; structuredOutput: boolean };
  /** USD per 1M tokens. */
  pricing: { input: number; output: number; cachedInput?: number } | null;
}

export interface ProviderStatus {
  id: ProviderId;
  label: string;
  /** false only for the included platform provider. */
  requiresKey: boolean;
  /** platform: always true; others: the user has a stored key. */
  connected: boolean;
  /** Last 4 characters of the stored key. */
  keyHint: string | null;
  keyUrl: string | null;
  keyPlaceholder: string | null;
  updatedAt: string | null;
  models: CatalogModel[];
}

export interface ProvidersResponse {
  /** false when the server has no encryption key configured. */
  byokEnabled: boolean;
  defaultModel: string;
  providers: ProviderStatus[];
}

export interface SaveProviderKeyResponse {
  provider: ProviderId;
  keyHint: string;
  updatedAt: string;
  warning: string | null;
}
