import type { LanguageModel, LanguageModelUsage } from 'ai';
import type { ByokProvider, CatalogModel } from '../catalog/model-catalog';

/** "main" = the configured LLM_MODEL, "fast" = the cheap LLM_FAST_MODEL. Any other string is a raw model id. */
export type ModelTier = 'main' | 'fast';
export type ModelSelector = ModelTier | (string & {});

export type ProviderSlot = 'primary' | 'fallback';

/** Who pays for a call: the app's provider key (daily budget applies) or the user's own key. */
export type KeySource = 'platform' | 'user';

/** Where a call runs, resolved per request from the model the user picked. */
export type ModelRoute = PlatformRoute | UserKeyRoute;

export interface PlatformRoute {
  source: 'platform';
  /** Main-tier model on the platform provider when the user picked one other than LLM_MODEL. */
  mainModelId?: string;
}

export interface UserKeyRoute {
  source: 'user';
  provider: ByokProvider;
  main: CatalogModel;
  fast: CatalogModel;
  /** Builds a model bound to the user's key; the key only lives inside this closure. */
  languageModel: (modelId: string) => LanguageModel;
}

export const PLATFORM_ROUTE: PlatformRoute = { source: 'platform' };

/** Attribution for a traced call: which request it belongs to and who pays for it. */
export interface TraceContext {
  traceId?: string;
  userId?: string;
}

/** Every LLM call is named and optionally attached to a trace (conversation, generation, eval run). */
export interface LlmCallContext extends TraceContext {
  name: string;
  metadata?: Record<string, unknown>;
  /** Defaults to the platform provider. */
  route?: ModelRoute;
}

export interface UsageSummary {
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
}

export const summarizeUsage = (
  usage: LanguageModelUsage | undefined,
): UsageSummary => ({
  inputTokens: usage?.inputTokens,
  outputTokens: usage?.outputTokens,
  cachedInputTokens: usage?.inputTokenDetails?.cacheReadTokens,
});
