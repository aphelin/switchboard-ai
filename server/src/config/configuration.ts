import type {
  AppConfiguration,
  LlmProviderConfig,
} from './configuration.interface';
import {
  DEFAULT_FAST_MODEL,
  LLM_PROVIDER_PRESETS,
  type EmbeddingProviderName,
  type LlmProviderName,
} from './llm-presets';
import { EMBEDDING_DIMENSIONS } from '../shared/constants/app.constants';

const DEFAULT_DAILY_BUDGET_USD = 0.5;
const DEFAULT_GUEST_DAILY_BUDGET_USD = 0.1;
const DEFAULT_TOTAL_GUEST_DAILY_BUDGET_USD = 2;

const resolveProvider = (
  name: LlmProviderName,
  baseUrl: string | undefined,
  apiKey: string | undefined,
  model: string,
): LlmProviderConfig => {
  const resolvedBaseUrl = baseUrl || LLM_PROVIDER_PRESETS[name];
  if (!resolvedBaseUrl) {
    throw new Error(`LLM provider "${name}" requires an explicit base URL`);
  }

  // Pollinations reuses the image-generation key; Ollama accepts any key.
  const resolvedApiKey =
    apiKey ||
    (name === 'pollinations' ? process.env.POLLINATIONS_API_KEY : '') ||
    (name === 'ollama' ? 'ollama' : '');

  return { name, baseUrl: resolvedBaseUrl, apiKey: resolvedApiKey, model };
};

/** 0 (or an invalid value) disables the budget. */
const parseDailyBudget = (
  value: string | undefined,
  fallback = DEFAULT_DAILY_BUDGET_USD,
): number | null => {
  const budget = value === undefined ? fallback : Number(value);
  return Number.isFinite(budget) && budget > 0 ? budget : null;
};

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = value === undefined ? fallback : parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const configuration = (): AppConfiguration => {
  const port = parseInt(process.env.SERVER_PORT || '4000', 10);
  const publicUrl = process.env.SERVER_PUBLIC_URL || `http://localhost:${port}`;
  // One or more browser origins, comma-separated: a second dev port, a preview host.
  const clientUrls = (process.env.CLIENT_URL || 'http://localhost:3000')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);
  const primaryName = (process.env.LLM_PROVIDER ||
    'pollinations') as LlmProviderName;
  const primaryModel = process.env.LLM_MODEL || 'openai/gpt-5.4-mini';
  const fallbackName = process.env.LLM_FALLBACK_PROVIDER as
    | LlmProviderName
    | undefined;

  return {
    app: {
      port,
      publicUrl,
      cors: {
        origin: clientUrls,
        credentials: true,
      },
    },
    credentials: {
      encryptionKey: process.env.CREDENTIALS_ENCRYPTION_KEY || null,
    },
    database: {
      url: process.env.DATABASE_URL!,
    },
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    },
    pollinations: {
      apiKey: process.env.POLLINATIONS_API_KEY!,
      baseUrl: 'https://gen.pollinations.ai',
    },
    storage: {
      dir: process.env.STORAGE_DIR || './storage',
    },
    llm: {
      primary: resolveProvider(
        primaryName,
        process.env.LLM_BASE_URL,
        process.env.LLM_API_KEY,
        primaryModel,
      ),
      fallback: fallbackName
        ? resolveProvider(
            fallbackName,
            process.env.LLM_FALLBACK_BASE_URL,
            process.env.LLM_FALLBACK_API_KEY,
            process.env.LLM_FALLBACK_MODEL || primaryModel,
          )
        : undefined,
      fastModel:
        process.env.LLM_FAST_MODEL ||
        DEFAULT_FAST_MODEL[primaryName] ||
        primaryModel,
      pricingJson: process.env.LLM_PRICING_JSON,
    },
    embedding: {
      provider: (process.env.EMBEDDING_PROVIDER ||
        'local') as EmbeddingProviderName,
      model: process.env.EMBEDDING_MODEL || 'Xenova/bge-small-en-v1.5',
      baseUrl: process.env.EMBEDDING_BASE_URL,
      apiKey: process.env.EMBEDDING_API_KEY,
      cacheDir: process.env.TRANSFORMERS_CACHE_DIR || './.cache/transformers',
      dimensions: EMBEDDING_DIMENSIONS,
    },
    auth: {
      secret: process.env.BETTER_AUTH_SECRET!,
      baseUrl: process.env.BETTER_AUTH_URL || publicUrl,
      trustedOrigins: clientUrls,
      dailyBudgetUsd: parseDailyBudget(process.env.USER_DAILY_BUDGET_USD),
      claimLegacyData: process.env.AUTH_CLAIM_LEGACY_DATA === 'true',
    },
    demo: {
      enabled: process.env.DEMO_ENABLED !== 'false',
      templateEmail:
        process.env.DEMO_TEMPLATE_EMAIL?.trim().toLowerCase() || null,
      guestTtlHours: parsePositiveInt(process.env.DEMO_GUEST_TTL_HOURS, 24),
      guestDailyBudgetUsd: parseDailyBudget(
        process.env.DEMO_GUEST_DAILY_BUDGET_USD,
        DEFAULT_GUEST_DAILY_BUDGET_USD,
      ),
      totalDailyBudgetUsd: parseDailyBudget(
        process.env.DEMO_TOTAL_DAILY_BUDGET_USD,
        DEFAULT_TOTAL_GUEST_DAILY_BUDGET_USD,
      ),
      maxGuestsPerDay: parsePositiveInt(
        process.env.DEMO_MAX_GUESTS_PER_DAY,
        200,
      ),
    },
  };
};
