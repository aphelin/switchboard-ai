import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogle } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import type { ImageModel, LanguageModel } from 'ai';
import {
  fastModelFor,
  type ByokProvider,
  type CatalogModel,
} from '../../llm/catalog/model-catalog';
import type { ImageCatalogModel } from '../../llm/catalog/image-catalog';
import type {
  UserKeyImageRoute,
  UserKeyRoute,
} from '../../llm/types/llm.types';

type ModelFactory = (apiKey: string) => (modelId: string) => LanguageModel;
type ImageModelFactory = (apiKey: string) => (modelId: string) => ImageModel;

/** Providers whose image models the catalog offers (Gemini "Nano Banana" for now). */
const IMAGE_MODEL_FACTORIES: Partial<Record<ByokProvider, ImageModelFactory>> =
  {
    google: (apiKey) => {
      const provider = createGoogle({ apiKey });
      return (modelId) => provider.image(modelId);
    },
  };

/**
 * Each vendor goes through its own AI SDK provider rather than an
 * OpenAI-compatible endpoint, so tool calling, structured output and prompt
 * caching use each API natively. The key is always passed explicitly: the
 * SDKs would otherwise fall back to server environment variables.
 */
const MODEL_FACTORIES: Record<ByokProvider, ModelFactory> = {
  openai: (apiKey) => {
    const provider = createOpenAI({ apiKey });
    return (modelId) => provider(modelId);
  },
  anthropic: (apiKey) => {
    const provider = createAnthropic({ apiKey });
    return (modelId) => provider(modelId);
  },
  google: (apiKey) => {
    const provider = createGoogle({ apiKey });
    return (modelId) => provider(modelId);
  },
};

/** A route that runs on the given key: `main` defaults to the provider's fast model (used to verify keys). */
export function createUserKeyRoute(
  provider: ByokProvider,
  apiKey: string,
  main?: CatalogModel,
): UserKeyRoute {
  if (!apiKey) throw new Error(`Missing ${provider} API key`);
  const fast = fastModelFor(provider);
  return {
    source: 'user',
    provider,
    main: main ?? fast,
    fast,
    languageModel: MODEL_FACTORIES[provider](apiKey),
  };
}

export function createUserKeyImageRoute(
  provider: ByokProvider,
  apiKey: string,
  model: ImageCatalogModel,
): UserKeyImageRoute {
  const factory = IMAGE_MODEL_FACTORIES[provider];
  if (!factory) throw new Error(`No image models for ${provider}`);
  if (!apiKey) throw new Error(`Missing ${provider} API key`);
  return { source: 'user', provider, model, imageModel: factory(apiKey) };
}
