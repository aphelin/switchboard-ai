export const GENERATION_QUEUE = 'generation-queue';
export const GENERATION_JOB_NAME = 'generate';

export const DOCUMENT_INGESTION_QUEUE = 'document-ingestion-queue';
export const DOCUMENT_INGESTION_JOB_NAME = 'ingest';

export const DEMO_QUEUE = 'demo-queue';
export const DEMO = {
  /** Scheduler id and job name of the sweep that deletes expired guests. */
  CLEANUP_JOB: 'delete-expired-guests',
  CLEANUP_EVERY_MS: 15 * 60 * 1000,
  /** Guests deleted per sweep, so one run never holds a long transaction. */
  CLEANUP_BATCH: 200,
  /** Guest sign-ins allowed per IP address per hour (Better Auth rate limiter). */
  GUESTS_PER_IP_PER_HOUR: 5,
  /** Upper bounds on what one guest is given from the template account. */
  COPY_LIMITS: {
    generations: 24,
    documents: 12,
    conversations: 8,
    llmCalls: 400,
  },
} as const;

export const JOB_ATTEMPTS = 3;
export const JOB_BACKOFF_DELAY = 5000;

export const CIRCUIT_BREAKER_OPTIONS = {
  timeout: 30000,
  errorThresholdPercentage: 50,
  resetTimeout: 10000,
  volumeThreshold: 5,
};

export const THROTTLE_CONFIGS = [
  { name: 'short', ttl: 1000, limit: 5 },
  { name: 'medium', ttl: 60000, limit: 30 },
  { name: 'long', ttl: 3600000, limit: 100 },
] as const;

export const SSE_EVENTS = {
  STATUS_UPDATE: 'status-update',
  GENERATION_COMPLETE: 'generation-complete',
  DOCUMENT_UPDATE: 'document-update',
} as const;

export const GENERATION_SSE_EVENTS = [
  SSE_EVENTS.STATUS_UPDATE,
  SSE_EVENTS.GENERATION_COMPLETE,
] as const;

export const DOCUMENT_SSE_EVENTS = [SSE_EVENTS.DOCUMENT_UPDATE] as const;

export const SSE_HEARTBEAT_INTERVAL_MS = 15000;

export const DEFAULT_IMAGE_MODEL = 'flux';
export const DEFAULT_TEXT_MODEL = 'openai';
export const PROMPT_ENHANCE_TEMPERATURE = 0.7;

export const IMAGE_GENERATION_TIMEOUT_MS = 120000;
export const TEXT_GENERATION_TIMEOUT_MS = 120000;
export const TRANSCRIPTION_TIMEOUT_MS = 60000;
export const LLM_CALL_TIMEOUT_MS = 120000;

export const BULLMQ_PRIORITY = {
  HIGH: 1,
  NORMAL: 5,
  LOW: 10,
} as const;

export const NODE_ENVIRONMENTS = {
  DEVELOPMENT: 'development',
  PRODUCTION: 'production',
} as const;

/** Must match `vector(N)` on DocumentChunk.embedding in prisma/schema.prisma. */
export const EMBEDDING_DIMENSIONS = 384;
export const EMBEDDING_BATCH_SIZE = 32;

export const RAG = {
  /** Characters per chunk. ~200 tokens: small enough to be precise, large enough to keep context. */
  CHUNK_SIZE: 800,
  CHUNK_OVERLAP: 120,
  /** Passages returned to the model per search. */
  TOP_K: 6,
  /** Candidates fetched from each retriever before fusion. */
  CANDIDATE_POOL: 20,
  /** Reciprocal Rank Fusion constant (60 is the value from the original paper). */
  RRF_K: 60,
  MAX_UPLOAD_BYTES: 10 * 1024 * 1024,
  MAX_DOCUMENT_CHARS: 500_000,
} as const;

export const CHAT = {
  /** Upper bound on model/tool round-trips per user turn. */
  MAX_STEPS: 6,
  /** Only the most recent messages are sent to the model (simple context budget). */
  MAX_CONTEXT_MESSAGES: 24,
  /** How long an agent tool waits for a queued image generation. */
  TOOL_WAIT_TIMEOUT_MS: 90000,
  /** Images a user may attach to one message, and the size of each once decoded. */
  MAX_ATTACHMENTS: 3,
  MAX_ATTACHMENT_BYTES: 6 * 1024 * 1024,
  /** Speech to text: one recording per request, at most this long and this big. */
  MAX_AUDIO_BYTES: 8 * 1024 * 1024,
  MAX_AUDIO_SECONDS: 60,
} as const;

/** Pollinations speech-to-text model for the chat microphone, and its list price should the live list be unreachable. */
export const TRANSCRIPTION_MODEL = 'openai/whisper-large-v3';
export const TRANSCRIPTION_FALLBACK_USD_PER_SECOND = 0.0000453;
