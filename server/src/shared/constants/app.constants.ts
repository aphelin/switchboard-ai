export const GENERATION_QUEUE = 'generation-queue';
export const GENERATION_JOB_NAME = 'generate';

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
} as const;

export const SSE_HEARTBEAT_INTERVAL_MS = 15000;

export const DEFAULT_IMAGE_MODEL = 'flux';
export const DEFAULT_TEXT_MODEL = 'openai';
export const PROMPT_ENHANCE_TEMPERATURE = 0.7;

export const IMAGE_GENERATION_TIMEOUT_MS = 120000;
export const TEXT_GENERATION_TIMEOUT_MS = 30000;
export const TEXT_HTTP_TIMEOUT_MS = 25000;

export const NODE_ENVIRONMENTS = {
  DEVELOPMENT: 'development',
  PRODUCTION: 'production',
} as const;
