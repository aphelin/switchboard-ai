import { describe, expect, it } from 'vitest';
import {
  BYOK_MODELS,
  BYOK_PROVIDERS,
  byokModelsFor,
  fastModelFor,
  isByokProvider,
  platformModels,
} from './model-catalog';

describe('model catalog', () => {
  it('uses unique "<provider>:<model id>" ids', () => {
    const ids = BYOK_MODELS.map((model) => model.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const model of BYOK_MODELS) {
      expect(model.id).toBe(`${model.provider}:${model.modelId}`);
    }
  });

  it('offers one priced flagship, balanced and fast model per provider', () => {
    for (const provider of BYOK_PROVIDERS) {
      const models = byokModelsFor(provider);
      expect(models.map((model) => model.tier).sort()).toEqual([
        'balanced',
        'fast',
        'flagship',
      ]);
      for (const model of models) {
        expect(model.pricing?.input).toBeGreaterThan(0);
        expect(model.pricing?.output).toBeGreaterThan(0);
        expect(model.capabilities.tools).toBe(true);
      }
    }
  });

  it("resolves each provider's fast model from the catalog", () => {
    for (const provider of BYOK_PROVIDERS) {
      const fast = fastModelFor(provider);
      expect(fast.provider).toBe(provider);
      expect(fast.tier).toBe('fast');
    }
  });

  it('lists the configured platform main and fast models', () => {
    const models = platformModels({
      primary: {
        name: 'pollinations',
        baseUrl: 'https://example.test/v1',
        apiKey: 'unused',
        model: 'openai/gpt-5.4-mini',
      },
      fastModel: 'openai/gpt-5.4-nano',
    });
    expect(models.map((model) => model.id)).toEqual([
      'platform:openai/gpt-5.4-mini',
      'platform:openai/gpt-5.4-nano',
    ]);
    expect(models.every((model) => model.pricing === undefined)).toBe(true);
  });

  it('only treats OpenAI, Anthropic and Google as key-backed providers', () => {
    expect(isByokProvider('anthropic')).toBe(true);
    expect(isByokProvider('platform')).toBe(false);
    expect(isByokProvider('mistral')).toBe(false);
  });
});
