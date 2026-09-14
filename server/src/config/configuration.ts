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
const parseDailyBudget = (value: string | undefined): number | null => {
  const budget = value === undefined ? DEFAULT_DAILY_BUDGET_USD : Number(value);
  return Number.isFinite(budget) && budget > 0 ? budget : null;
};

export const configuration = (): AppConfiguration => {
  const port = parseInt(process.env.SERVER_PORT || '4000', 10);
  const publicUrl = process.env.SERVER_PUBLIC_URL || `http://localhost:${port}`;
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
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
        origin: clientUrl,
        credentials: true,
      },
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
      trustedOrigins: [clientUrl],
      dailyBudgetUsd: parseDailyBudget(process.env.USER_DAILY_BUDGET_USD),
      claimLegacyData: process.env.AUTH_CLAIM_LEGACY_DATA === 'true',
    },
  };
};
