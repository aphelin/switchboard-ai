import { describe, expect, it, vi } from 'vitest';
import { APICallError } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { LlmService } from './llm.service';
import { PricingService } from './pricing.service';
import { CircuitBreakerService } from '../../../shared/circuit-breaker/circuit-breaker.service';
import { findByokModel, type CatalogModel } from '../catalog/model-catalog';
import type { ModelRegistryService } from './model-registry.service';
import type {
  RecordLlmCallInput,
  TraceService,
} from '../../observability/services/trace.service';
import type { UserKeyRoute } from '../types/llm.types';

const USER_KEY = 'sk-ant-api03-user-secret-key-1234567890';

const textResult = (text: string) => ({
  content: [{ type: 'text' as const, text }],
  finishReason: { unified: 'stop' as const, raw: undefined },
  usage: {
    inputTokens: { total: 1000, noCache: 1000, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 100, text: 100, reasoning: 0 },
  },
  warnings: [],
});

const failingModel = (statusCode: number) =>
  new MockLanguageModelV4({
    doGenerate: () => {
      throw new APICallError({
        message: `provider said no to ${USER_KEY}`,
        url: 'https://api.anthropic.com/v1/messages',
        requestBodyValues: {},
        statusCode,
        isRetryable: false,
      });
    },
  });

const catalogModel = (id: string): CatalogModel => {
  const model = findByokModel(id);
  if (!model) throw new Error(`${id} is not in the catalog`);
  return model;
};

const userRoute = (model: MockLanguageModelV4): UserKeyRoute => ({
  source: 'user',
  provider: 'anthropic',
  main: catalogModel('anthropic:claude-sonnet-5'),
  fast: catalogModel('anthropic:claude-haiku-4-5'),
  languageModel: vi.fn(() => model),
});

function setup(options: { hasFallback?: boolean } = {}) {
  const platformModel = new MockLanguageModelV4({
    provider: 'pollinations',
    doGenerate: textResult('from the platform'),
  });
  const primary = {
    name: 'pollinations' as const,
    baseUrl: 'https://example.test/v1',
    apiKey: '',
    model: 'openai/gpt-5.4-mini',
  };
  const registry = {
    hasFallback: options.hasFallback ?? false,
    config: { primary, fastModel: 'openai/gpt-5.4-nano' },
    providerConfig: () => primary,
    resolveModelId: (selector: string) =>
      selector === 'main'
        ? primary.model
        : selector === 'fast'
          ? 'openai/gpt-5.4-nano'
          : selector,
    languageModel: vi.fn(() => platformModel),
  } as unknown as ModelRegistryService & {
    languageModel: ReturnType<typeof vi.fn>;
  };

  const records: RecordLlmCallInput[] = [];
  const trace = {
    record: vi.fn((input: RecordLlmCallInput) => {
      records.push(input);
      return Promise.resolve();
    }),
  } as unknown as TraceService;

  const llm = new LlmService(
    registry,
    new PricingService(registry),
    trace,
    new CircuitBreakerService(),
  );
  return { llm, registry, platformModel, records };
}

describe("LlmService on a user's own key", () => {
  it('runs on the route model and traces provider, key source and catalog price', async () => {
    const { llm, registry, records } = setup();
    const userModel = new MockLanguageModelV4({
      doGenerate: textResult('from claude'),
    });
    const route = userRoute(userModel);

    const result = await llm.generateText({
      name: 'test.call',
      userId: 'user-1',
      route,
      prompt: 'hi',
    });

    expect(result.text).toBe('from claude');
    expect(route.languageModel).toHaveBeenCalledWith('claude-sonnet-5');
    expect(registry.languageModel).not.toHaveBeenCalled();
    expect(records[0]).toMatchObject({
      provider: 'anthropic',
      model: 'claude-sonnet-5',
      keySource: 'user',
      status: 'ok',
      inputTokens: 1000,
      outputTokens: 100,
    });
    // claude-sonnet-5: $2 input / $10 output per 1M tokens
    expect(records[0].costUsd).toBeCloseTo((1000 * 2 + 100 * 10) / 1e6, 10);
  });

  it("uses the provider's fast model for the fast tier", async () => {
    const { llm, records } = setup();
    const route = userRoute(
      new MockLanguageModelV4({ doGenerate: textResult('ok') }),
    );

    await llm.generateText({
      name: 'test.fast',
      route,
      model: 'fast',
      prompt: 'hi',
    });

    expect(route.languageModel).toHaveBeenCalledWith('claude-haiku-4-5');
    expect(records[0].model).toBe('claude-haiku-4-5');
  });

  it('explains a rejected key without leaking it', async () => {
    const { llm, records } = setup();
    const route = userRoute(failingModel(401));

    const error = (await llm
      .generateText({ name: 'test.rejected', route, prompt: 'hi' })
      .catch((e: unknown) => e)) as Error;

    expect(error.message).toMatch(
      /Anthropic: rejected your API key \(HTTP 401\)/,
    );
    expect(error.message).not.toContain(USER_KEY);
    expect(records[0]).toMatchObject({ keySource: 'user', status: 'error' });
    expect(records[0].error).not.toContain(USER_KEY);
    expect(
      llm.describeError(new Error(`bad key ${USER_KEY}`), route),
    ).not.toContain(USER_KEY);
  });

  it('never moves a failed call onto the platform provider, even with a fallback configured', async () => {
    const { llm, registry } = setup({ hasFallback: true });
    const route = userRoute(failingModel(503));

    await expect(
      llm.generateText({ name: 'test.outage', route, prompt: 'hi' }),
    ).rejects.toThrow(/Anthropic/);
    expect(registry.languageModel).not.toHaveBeenCalled();
  });

  it('marks the instructions as an Anthropic prompt-cache breakpoint when asked', async () => {
    const { llm } = setup();
    const userModel = new MockLanguageModelV4({ doGenerate: textResult('ok') });

    await llm.generateText({
      name: 'test.cache',
      route: userRoute(userModel),
      instructions: 'You are a helpful assistant.',
      cacheInstructions: true,
      prompt: 'hi',
    });

    expect(userModel.doGenerateCalls[0].prompt[0]).toMatchObject({
      role: 'system',
      content: 'You are a helpful assistant.',
      providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
    });
  });
});

describe('LlmService on the platform key', () => {
  it('traces calls as platform spend and runs the platform model the user picked', async () => {
    const { llm, registry, records } = setup();

    await llm.generateText({
      name: 'test.platform',
      route: { source: 'platform', mainModelId: 'openai/gpt-5.4-nano' },
      prompt: 'hi',
    });

    expect(registry.languageModel).toHaveBeenCalledWith(
      'openai/gpt-5.4-nano',
      'primary',
    );
    expect(records[0]).toMatchObject({
      provider: 'pollinations',
      model: 'openai/gpt-5.4-nano',
      keySource: 'platform',
      status: 'ok',
    });
  });
});
