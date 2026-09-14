import type { LanguageModelUsage } from 'ai';

/** "main" = the configured LLM_MODEL, "fast" = the cheap LLM_FAST_MODEL. Any other string is a raw model id. */
export type ModelTier = 'main' | 'fast';
export type ModelSelector = ModelTier | (string & {});

export type ProviderSlot = 'primary' | 'fallback';

/** Attribution for a traced call: which request it belongs to and who pays for it. */
export interface TraceContext {
  traceId?: string;
  userId?: string;
}

/** Every LLM call is named and optionally attached to a trace (conversation, generation, eval run). */
export interface LlmCallContext extends TraceContext {
  name: string;
  metadata?: Record<string, unknown>;
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
