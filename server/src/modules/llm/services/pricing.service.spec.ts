import { describe, expect, it } from 'vitest';
import { PricingService } from './pricing.service';
import type { ModelRegistryService } from './model-registry.service';

const MILLION = 1_000_000;

/** PricingService only reads `config` from the registry, so a plain object is enough. */
const makeService = (pricingJson?: string) =>
  new PricingService({
    config: {
      primary: {
        name: 'custom',
        baseUrl: 'http://localhost',
        apiKey: '',
        model: 'x',
      },
      fastModel: 'x',
      pricingJson,
    },
  } as unknown as ModelRegistryService);

describe('PricingService.estimateCost', () => {
  it('prices a known model from the default table (USD per 1M tokens)', () => {
    const service = makeService();
    // gpt-4o-mini: $0.15 input / $0.60 output per 1M tokens
    expect(
      service.estimateCost('gpt-4o-mini', undefined, {
        inputTokens: MILLION,
        outputTokens: 0,
      }),
    ).toBeCloseTo(0.15, 8);
    expect(
      service.estimateCost('gpt-4o-mini', undefined, {
        inputTokens: MILLION,
        outputTokens: MILLION,
      }),
    ).toBeCloseTo(0.75, 8);
  });

  it('ignores a provider prefix on the requested model id', () => {
    const service = makeService();
    expect(
      service.estimateCost('openai/gpt-4o-mini', undefined, {
        inputTokens: MILLION,
        outputTokens: 0,
      }),
    ).toBeCloseTo(0.15, 8);
  });

  it('falls back to the dated response model id when the requested id is unknown', () => {
    const service = makeService();
    expect(
      service.estimateCost('openai', 'gpt-4o-mini-2024-07-18', {
        inputTokens: MILLION,
        outputTokens: 0,
      }),
    ).toBeCloseTo(0.15, 8);
  });

  it('returns null for unknown models instead of guessing', () => {
    const service = makeService();
    expect(
      service.estimateCost('mystery-model', undefined, {
        inputTokens: 10,
        outputTokens: 10,
      }),
    ).toBeNull();
    expect(
      service.estimateCost('mystery-model', 'still-unknown', {
        inputTokens: 10,
      }),
    ).toBeNull();
  });

  it('applies LLM_PRICING_JSON overrides, including cached-input pricing', () => {
    const service = makeService(
      JSON.stringify({ 'my-model': { input: 1, output: 2, cachedInput: 0.1 } }),
    );

    expect(
      service.estimateCost('my-model', undefined, {
        inputTokens: MILLION,
        outputTokens: MILLION,
      }),
    ).toBeCloseTo(3, 8);

    // Half of the input tokens were served from cache at the cheaper rate.
    expect(
      service.estimateCost('my-model', undefined, {
        inputTokens: MILLION,
        cachedInputTokens: MILLION / 2,
        outputTokens: 0,
      }),
    ).toBeCloseTo(0.5 * 1 + 0.5 * 0.1, 8);
  });

  it('lets overrides replace a default price', () => {
    const service = makeService(
      JSON.stringify({ 'gpt-4o-mini': { input: 10, output: 10 } }),
    );
    expect(
      service.estimateCost('gpt-4o-mini', undefined, {
        inputTokens: MILLION,
        outputTokens: 0,
      }),
    ).toBeCloseTo(10, 8);
  });

  it('prices models on user keys from the catalog, including cache reads', () => {
    const service = makeService();
    // claude-sonnet-5: $2 input / $10 output / $0.20 cached input per 1M tokens
    expect(
      service.estimateCost('anthropic:claude-sonnet-5', 'claude-sonnet-5', {
        inputTokens: MILLION,
        cachedInputTokens: MILLION / 2,
        outputTokens: MILLION,
      }),
    ).toBeCloseTo(0.5 * 2 + 0.5 * 0.2 + 10, 8);
  });

  it('treats missing usage numbers as zero', () => {
    const service = makeService();
    expect(service.estimateCost('gpt-4o-mini', undefined, {})).toBe(0);
  });

  it('ignores invalid LLM_PRICING_JSON and keeps the defaults', () => {
    const service = makeService('{not json');
    expect(
      service.estimateCost('gpt-4o-mini', undefined, {
        inputTokens: MILLION,
        outputTokens: 0,
      }),
    ).toBeCloseTo(0.15, 8);
  });
});
