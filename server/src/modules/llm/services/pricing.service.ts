import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ModelRegistryService } from './model-registry.service';
import type { UsageSummary } from '../types/llm.types';

/** USD per single token. */
interface ModelPricing {
  input: number;
  output: number;
  cachedInput?: number;
}

const PER_MILLION = 1_000_000;
const PRICING_FETCH_TIMEOUT_MS = 15000;
const PRICING_RETRY_DELAY_MS = 30000;
const PRICING_MAX_ATTEMPTS = 3;

/**
 * Approximate list prices (USD per 1M tokens) for common models on non-Pollinations
 * providers. Prices change often; override with LLM_PRICING_JSON.
 */
const DEFAULT_PRICING_PER_MILLION: Record<
  string,
  { input: number; output: number }
> = {
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-5-mini': { input: 0.25, output: 2 },
  'gpt-5-nano': { input: 0.05, output: 0.4 },
  'llama-3.3-70b-versatile': { input: 0.59, output: 0.79 },
  'llama-3.1-8b-instant': { input: 0.05, output: 0.08 },
  'gemini-2.5-flash': { input: 0.3, output: 2.5 },
  'gemini-2.5-flash-lite': { input: 0.1, output: 0.4 },
};

/**
 * Estimates the USD cost of a call from token usage. Pollinations publishes
 * per-token prices on /v1/models (1 pollen ~ 1 USD), which are loaded at startup;
 * other providers use the static table above or LLM_PRICING_JSON.
 */
@Injectable()
export class PricingService implements OnModuleInit {
  private readonly logger = new Logger(PricingService.name);
  private readonly pricing = new Map<string, ModelPricing>();

  constructor(private readonly registry: ModelRegistryService) {
    for (const [model, price] of Object.entries(DEFAULT_PRICING_PER_MILLION)) {
      this.pricing.set(model, {
        input: price.input / PER_MILLION,
        output: price.output / PER_MILLION,
      });
    }
    this.loadOverrides(registry.config.pricingJson);
  }

  async onModuleInit(): Promise<void> {
    const { primary } = this.registry.config;
    if (primary.name === 'pollinations') {
      await this.loadPollinationsPricing(primary.baseUrl, primary.apiKey);
    }
  }

  estimateCost(
    requestedModel: string,
    responseModel: string | undefined,
    usage: UsageSummary,
  ): number | null {
    const pricing = this.lookup(requestedModel) ?? this.lookup(responseModel);
    if (!pricing) return null;

    const cached = usage.cachedInputTokens ?? 0;
    const uncachedInput = Math.max((usage.inputTokens ?? 0) - cached, 0);
    const cost =
      uncachedInput * pricing.input +
      cached * (pricing.cachedInput ?? pricing.input) +
      (usage.outputTokens ?? 0) * pricing.output;

    return Number(cost.toFixed(8));
  }

  private lookup(model: string | undefined): ModelPricing | undefined {
    if (!model) return undefined;
    const exact = this.pricing.get(model);
    if (exact) return exact;

    // Try without the provider prefix ("openai/gpt-5.4-mini" -> "gpt-5.4-mini") and
    // dated response ids ("gpt-5.4-nano-2026-03-17" -> "gpt-5.4-nano").
    const bare = model.includes('/')
      ? model.slice(model.indexOf('/') + 1)
      : model;
    for (const [key, value] of this.pricing) {
      const bareKey = key.includes('/') ? key.slice(key.indexOf('/') + 1) : key;
      if (bareKey === bare || bare.startsWith(`${bareKey}-`)) return value;
    }
    return undefined;
  }

  private loadOverrides(json: string | undefined): void {
    if (!json) return;
    try {
      const parsed = JSON.parse(json) as Record<
        string,
        { input: number; output: number; cachedInput?: number }
      >;
      for (const [model, price] of Object.entries(parsed)) {
        this.pricing.set(model, {
          input: price.input / PER_MILLION,
          output: price.output / PER_MILLION,
          cachedInput:
            price.cachedInput !== undefined
              ? price.cachedInput / PER_MILLION
              : undefined,
        });
      }
    } catch (error) {
      this.logger.warn(`Ignoring invalid LLM_PRICING_JSON: ${String(error)}`);
    }
  }

  private async loadPollinationsPricing(
    baseUrl: string,
    apiKey: string,
    attempt = 1,
  ): Promise<void> {
    try {
      const response = await fetch(`${baseUrl}/models`, {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
        signal: AbortSignal.timeout(PRICING_FETCH_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const body = (await response.json()) as {
        data?: Array<{
          id: string;
          pricing?: {
            promptTextTokens?: string | number;
            completionTextTokens?: string | number;
            promptCachedTokens?: string | number;
          };
        }>;
      };

      let loaded = 0;
      for (const model of body.data ?? []) {
        const input = Number(model.pricing?.promptTextTokens);
        if (!Number.isFinite(input)) continue;
        const output = Number(model.pricing?.completionTextTokens);
        const cached = Number(model.pricing?.promptCachedTokens);
        this.pricing.set(model.id, {
          input,
          output: Number.isFinite(output) ? output : input,
          cachedInput: Number.isFinite(cached) ? cached : undefined,
        });
        loaded++;
      }
      this.logger.log(`Loaded pricing for ${loaded} Pollinations models`);
    } catch (error) {
      this.logger.warn(
        `Could not load Pollinations pricing (attempt ${attempt}/${PRICING_MAX_ATTEMPTS}; cost tracking uses defaults until it succeeds): ${error instanceof Error ? error.message : String(error)}`,
      );
      // A transient failure at startup must not zero out cost tracking for the process lifetime.
      if (attempt < PRICING_MAX_ATTEMPTS) {
        setTimeout(() => {
          void this.loadPollinationsPricing(baseUrl, apiKey, attempt + 1);
        }, PRICING_RETRY_DELAY_MS).unref();
      }
    }
  }
}
