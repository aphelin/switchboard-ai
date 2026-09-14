import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createOpenAICompatible,
  type OpenAICompatibleProvider,
} from '@ai-sdk/openai-compatible';
import type { EmbeddingModel, LanguageModel } from 'ai';
import type {
  AppConfiguration,
  LlmConfig,
  LlmProviderConfig,
} from '../../../config/configuration.interface';
import type { ModelSelector, ProviderSlot } from '../types/llm.types';

/**
 * Builds AI SDK provider instances from configuration. Every provider speaks the
 * OpenAI-compatible protocol, so switching from Pollinations to Groq, Gemini,
 * OpenAI or a local Ollama is a config change, not a code change.
 */
@Injectable()
export class ModelRegistryService {
  private readonly logger = new Logger(ModelRegistryService.name);
  readonly config: LlmConfig;
  private readonly providers: Partial<
    Record<ProviderSlot, OpenAICompatibleProvider>
  > = {};

  constructor(configService: ConfigService<AppConfiguration, true>) {
    this.config = configService.get('llm', { infer: true });
    this.providers.primary = this.createProvider(this.config.primary);
    if (this.config.fallback) {
      this.providers.fallback = this.createProvider(this.config.fallback);
    }
    this.logger.log(
      `LLM provider: ${this.config.primary.name} (${this.config.primary.model}, fast: ${this.config.fastModel})` +
        (this.config.fallback
          ? `, fallback: ${this.config.fallback.name} (${this.config.fallback.model})`
          : ''),
    );
  }

  get hasFallback(): boolean {
    return !!this.providers.fallback;
  }

  providerConfig(slot: ProviderSlot): LlmProviderConfig {
    const config =
      slot === 'primary' ? this.config.primary : this.config.fallback;
    if (!config) throw new Error(`No ${slot} LLM provider configured`);
    return config;
  }

  /** Resolves a tier ("main" / "fast") or raw id to the model id for the given provider. */
  resolveModelId(
    selector: ModelSelector,
    slot: ProviderSlot = 'primary',
  ): string {
    if (slot === 'fallback') return this.providerConfig('fallback').model;
    if (selector === 'main') return this.config.primary.model;
    if (selector === 'fast') return this.config.fastModel;
    return selector;
  }

  languageModel(
    selector: ModelSelector,
    slot: ProviderSlot = 'primary',
  ): LanguageModel {
    return this.provider(slot).chatModel(this.resolveModelId(selector, slot));
  }

  embeddingModel(
    modelId: string,
    baseUrl: string,
    apiKey?: string,
  ): EmbeddingModel {
    return createOpenAICompatible({
      name: 'embeddings',
      baseURL: baseUrl,
      apiKey: apiKey || undefined,
    }).embeddingModel(modelId);
  }

  private provider(slot: ProviderSlot): OpenAICompatibleProvider {
    const provider = this.providers[slot];
    if (!provider) throw new Error(`No ${slot} LLM provider configured`);
    return provider;
  }

  private createProvider(config: LlmProviderConfig): OpenAICompatibleProvider {
    return createOpenAICompatible({
      name: config.name,
      baseURL: config.baseUrl,
      apiKey: config.apiKey || undefined,
      // Ask for token usage in streaming responses so cost can be tracked.
      includeUsage: true,
      // Use native JSON-schema mode for structured outputs when the provider supports it.
      supportsStructuredOutputs: true,
    });
  }
}
