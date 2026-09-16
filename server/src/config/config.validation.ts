import * as Joi from 'joi';
import { NODE_ENVIRONMENTS } from '../shared/constants/app.constants';
import { LLM_PROVIDER_NAMES, EMBEDDING_PROVIDER_NAMES } from './llm-presets';

export const validationSchema = Joi.object({
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .required(),
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().integer().positive().default(6379),
  POLLINATIONS_API_KEY: Joi.string().required(),
  SERVER_PORT: Joi.number().integer().positive().default(4000),
  SERVER_PUBLIC_URL: Joi.string().uri().optional(),
  // One origin, or several separated by commas (each must be an absolute URL).
  CLIENT_URL: Joi.string()
    .custom((value: string, helpers) => {
      const invalid = value
        .split(',')
        .map((url) => url.trim())
        .find((url) => !URL.canParse(url));
      return invalid === undefined ? value : helpers.error('string.uri');
    })
    .default('http://localhost:3000'),
  NODE_ENV: Joi.string()
    .valid(NODE_ENVIRONMENTS.DEVELOPMENT, NODE_ENVIRONMENTS.PRODUCTION)
    .default(NODE_ENVIRONMENTS.DEVELOPMENT),

  // File storage for generated images (local disk; S3 would be a drop-in replacement)
  STORAGE_DIR: Joi.string().default('./storage'),

  // LLM provider (any OpenAI-compatible API). Defaults to Pollinations, reusing POLLINATIONS_API_KEY.
  LLM_PROVIDER: Joi.string()
    .valid(...LLM_PROVIDER_NAMES)
    .default('pollinations'),
  LLM_BASE_URL: Joi.string().uri().optional(),
  LLM_API_KEY: Joi.string().allow('').optional(),
  LLM_MODEL: Joi.string().default('openai/gpt-5.4-mini'),
  LLM_FAST_MODEL: Joi.string().optional(),
  LLM_PRICING_JSON: Joi.string().optional(),

  // Optional second provider used when the primary one fails (multi-provider fallback)
  LLM_FALLBACK_PROVIDER: Joi.string()
    .valid(...LLM_PROVIDER_NAMES)
    .optional(),
  LLM_FALLBACK_BASE_URL: Joi.string().uri().optional(),
  LLM_FALLBACK_API_KEY: Joi.string().allow('').optional(),
  LLM_FALLBACK_MODEL: Joi.string().optional(),

  // Embeddings: "local" runs the model in-process (free, no API key); "openai-compatible" calls a remote API
  EMBEDDING_PROVIDER: Joi.string()
    .valid(...EMBEDDING_PROVIDER_NAMES)
    .default('local'),
  EMBEDDING_MODEL: Joi.string().default('Xenova/bge-small-en-v1.5'),
  EMBEDDING_BASE_URL: Joi.string().uri().optional(),
  EMBEDDING_API_KEY: Joi.string().allow('').optional(),
  TRANSFORMERS_CACHE_DIR: Joi.string().default('./.cache/transformers'),

  // Auth (Better Auth): the secret signs session cookies; generate with `openssl rand -base64 32`
  BETTER_AUTH_SECRET: Joi.string().min(32).required(),
  BETTER_AUTH_URL: Joi.string().uri().optional(),
  // Per-user daily AI spending limit in USD (0 disables the limit)
  USER_DAILY_BUDGET_USD: Joi.number().min(0).default(0.5),
  // Dev convenience: the first account created takes ownership of rows created before auth existed
  AUTH_CLAIM_LEGACY_DATA: Joi.boolean().default(false),

  // Demo: one-click guest sessions on the included models only, never on anyone's provider keys
  DEMO_ENABLED: Joi.boolean().default(true),
  // Account whose data each guest starts with (fill it with `npm run demo:seed`); unset = guests start empty
  DEMO_TEMPLATE_EMAIL: Joi.string().email({ tlds: false }).optional(),
  DEMO_GUEST_TTL_HOURS: Joi.number().integer().positive().default(24),
  // Per guest and for all guests together (0 disables a limit)
  DEMO_GUEST_DAILY_BUDGET_USD: Joi.number().min(0).default(0.1),
  DEMO_TOTAL_DAILY_BUDGET_USD: Joi.number().min(0).default(2),
  DEMO_MAX_GUESTS_PER_DAY: Joi.number().integer().positive().default(200),

  // Encrypts users' own provider API keys (AES-256-GCM). 32 random bytes, base64: `openssl rand -base64 32`.
  // Unset = users can only use the included (platform) models.
  CREDENTIALS_ENCRYPTION_KEY: Joi.string().base64().allow('').optional(),
});
