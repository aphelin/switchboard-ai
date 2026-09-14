import type { generateText } from 'ai';
import type { LlmConfig } from '../../../config/configuration.interface';

/** Provider-namespaced request options (`ai` does not export the type itself). */
export type ProviderOptions = NonNullable<
  Parameters<typeof generateText>[0]['providerOptions']
>;

/** "platform" is the app's own configured provider (Pollinations by default). */
export const ModelProvider = {
  PLATFORM: 'platform',
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  GOOGLE: 'google',
} as const;
export type ModelProvider = (typeof ModelProvider)[keyof typeof ModelProvider];

/** Providers that run on the user's own API key. */
export const ByokProvider = {
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  GOOGLE: 'google',
} as const;
export type ByokProvider = (typeof ByokProvider)[keyof typeof ByokProvider];

export const BYOK_PROVIDERS = Object.values(ByokProvider);

export const isByokProvider = (value: string): value is ByokProvider =>
  (BYOK_PROVIDERS as string[]).includes(value);

export type ModelTierLabel = 'flagship' | 'balanced' | 'fast';

/** USD per 1M tokens. */
export interface ModelPricingPerMillion {
  input: number;
  output: number;
  cachedInput?: number;
}

export interface CatalogModel {
  /** Stable id used by the API and the UI: "<provider>:<model id>". */
  id: string;
  provider: ModelProvider;
  /** The id the provider's API expects. */
  modelId: string;
  label: string;
  description: string;
  tier: ModelTierLabel;
  capabilities: {
    tools: boolean;
    structuredOutput: boolean;
  };
  /** List price; platform models are priced by PricingService instead. */
  pricing?: ModelPricingPerMillion;
  /** Provider-specific request options sent with every call to this model. */
  providerOptions?: ProviderOptions;
}

export interface ByokProviderInfo {
  id: ByokProvider;
  label: string;
  /** Where users create a key. */
  keyUrl: string;
  keyPlaceholder: string;
  /** Cheap model for titles, prompt enhancement and verifying a new key. */
  fastModelId: string;
}

export const BYOK_PROVIDER_INFO: Record<ByokProvider, ByokProviderInfo> = {
  openai: {
    id: 'openai',
    label: 'OpenAI',
    keyUrl: 'https://platform.openai.com/api-keys',
    keyPlaceholder: 'sk-...',
    fastModelId: 'gpt-5.6-luna',
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    keyPlaceholder: 'sk-ant-...',
    fastModelId: 'claude-haiku-4-5',
  },
  google: {
    id: 'google',
    label: 'Google Gemini',
    keyUrl: 'https://aistudio.google.com/apikey',
    keyPlaceholder: 'AIza...',
    fastModelId: 'gemini-3.1-flash-lite',
  },
};

export const catalogModelId = (provider: ModelProvider, modelId: string) =>
  `${provider}:${modelId}`;

const ALL_CAPABILITIES = { tools: true, structuredOutput: true };

const byok = (
  provider: ByokProvider,
  modelId: string,
  details: Omit<CatalogModel, 'id' | 'provider' | 'modelId' | 'capabilities'>,
): CatalogModel => ({
  id: catalogModelId(provider, modelId),
  provider,
  modelId,
  capabilities: ALL_CAPABILITIES,
  ...details,
});

/**
 * A short, hand-picked list per provider (one flagship, one balanced, one fast)
 * instead of every model the provider lists: each entry has been checked for
 * tool calling and structured output, and has a known price.
 *
 * Model ids and list prices as of 2026-09-14. They change often; re-check the
 * provider pages before relying on the numbers.
 */
export const BYOK_MODELS: CatalogModel[] = [
  byok('openai', 'gpt-5.6-sol', {
    label: 'GPT-5.6 Sol',
    description: "OpenAI's flagship for complex work",
    tier: 'flagship',
    pricing: { input: 4, output: 20 },
  }),
  byok('openai', 'gpt-5.6-terra', {
    label: 'GPT-5.6 Terra',
    description: 'Balances intelligence and cost',
    tier: 'balanced',
    pricing: { input: 2, output: 12 },
  }),
  byok('openai', 'gpt-5.6-luna', {
    label: 'GPT-5.6 Luna',
    description: 'Fast and cheap, for high-volume tasks',
    tier: 'fast',
    pricing: { input: 0.2, output: 1.2 },
  }),
  byok('anthropic', 'claude-opus-5', {
    label: 'Claude Opus 5',
    description: "Anthropic's most capable Opus model",
    tier: 'flagship',
    pricing: { input: 5, output: 25, cachedInput: 0.5 },
    // A refused request is retried server-side on a fallback model instead of failing.
    providerOptions: { anthropic: { fallbacks: 'default' } },
  }),
  byok('anthropic', 'claude-sonnet-5', {
    label: 'Claude Sonnet 5',
    description: 'Strong reasoning and tool use at a lower price',
    tier: 'balanced',
    pricing: { input: 2, output: 10, cachedInput: 0.2 },
  }),
  byok('anthropic', 'claude-haiku-4-5', {
    label: 'Claude Haiku 4.5',
    description: 'Fastest Claude model',
    tier: 'fast',
    pricing: { input: 1, output: 5, cachedInput: 0.1 },
  }),
  byok('google', 'gemini-3.1-pro-preview', {
    label: 'Gemini 3.1 Pro (preview)',
    description: "Google's most capable model",
    tier: 'flagship',
    pricing: { input: 2, output: 12 },
  }),
  byok('google', 'gemini-3.8-flash', {
    label: 'Gemini 3.8 Flash',
    description: 'Fast, capable, good value',
    tier: 'balanced',
    pricing: { input: 0.75, output: 3.75 },
  }),
  byok('google', 'gemini-3.1-flash-lite', {
    label: 'Gemini 3.1 Flash-Lite',
    description: 'Cheapest Gemini model',
    tier: 'fast',
    pricing: { input: 0.25, output: 1.5 },
  }),
];

export const findByokModel = (id: string): CatalogModel | undefined =>
  BYOK_MODELS.find((model) => model.id === id);

export const byokModelsFor = (provider: ByokProvider): CatalogModel[] =>
  BYOK_MODELS.filter((model) => model.provider === provider);

export const fastModelFor = (provider: ByokProvider): CatalogModel => {
  const id = catalogModelId(provider, BYOK_PROVIDER_INFO[provider].fastModelId);
  const model = findByokModel(id);
  if (!model) throw new Error(`Fast model ${id} is missing from the catalog`);
  return model;
};

/** The models served on the app's own provider key: the configured main and fast models. */
export function platformModels(
  config: Pick<LlmConfig, 'primary' | 'fastModel'>,
): CatalogModel[] {
  const main: CatalogModel = {
    id: catalogModelId('platform', config.primary.model),
    provider: 'platform',
    modelId: config.primary.model,
    label: config.primary.model,
    description: `Included: runs on the app's ${config.primary.name} key and counts toward your daily budget`,
    tier: 'balanced',
    capabilities: ALL_CAPABILITIES,
  };
  if (config.fastModel === config.primary.model) return [main];
  return [
    main,
    {
      ...main,
      id: catalogModelId('platform', config.fastModel),
      modelId: config.fastModel,
      label: config.fastModel,
      tier: 'fast',
    },
  ];
}
