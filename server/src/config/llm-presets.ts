/**
 * Known OpenAI-compatible endpoints. Any other provider can be used with
 * LLM_PROVIDER=custom and an explicit LLM_BASE_URL.
 */
export const LLM_PROVIDER_PRESETS = {
  pollinations: 'https://gen.pollinations.ai/v1',
  openai: 'https://api.openai.com/v1',
  groq: 'https://api.groq.com/openai/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai',
  ollama: 'http://localhost:11434/v1',
  custom: '',
} as const;

export type LlmProviderName = keyof typeof LLM_PROVIDER_PRESETS;

export const LLM_PROVIDER_NAMES = Object.keys(
  LLM_PROVIDER_PRESETS,
) as LlmProviderName[];

export const EMBEDDING_PROVIDER_NAMES = ['local', 'openai-compatible'] as const;
export type EmbeddingProviderName = (typeof EMBEDDING_PROVIDER_NAMES)[number];

/** Cheap default for low-stakes tasks (prompt enhancement, titles) per provider. */
export const DEFAULT_FAST_MODEL: Partial<Record<LlmProviderName, string>> = {
  pollinations: 'openai/gpt-5.4-nano',
  openai: 'gpt-5.4-nano',
  groq: 'llama-3.1-8b-instant',
  gemini: 'gemini-2.5-flash-lite',
};
