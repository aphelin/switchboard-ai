import { describe, expect, it, vi } from 'vitest';
import { APICallError, simulateReadableStream, type Telemetry } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import type { ConfigService } from '@nestjs/config';
import { LlmService } from './llm.service';
import { PricingService } from './pricing.service';
import { CircuitBreakerService } from '../../../shared/circuit-breaker/circuit-breaker.service';
import { findByokModel, type CatalogModel } from '../catalog/model-catalog';
import type { ModelRegistryService } from './model-registry.service';
import type {
  RecordLlmCallInput,
  TraceService,
} from '../../observability/services/trace.service';
import {
  LangfuseService,
  type LangfuseCall,
} from '../../observability/services/langfuse.service';
import type { UserKeyRoute } from '../types/llm.types';
import type { AppConfiguration } from '../../../config/configuration.interface';

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

const langfuseOff = () =>
  new LangfuseService({ get: () => null } as unknown as ConfigService<
    AppConfiguration,
    true
  >);

function setup(
  options: { hasFallback?: boolean; langfuse?: LangfuseService } = {},
) {
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
    options.langfuse ?? langfuseOff(),
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

describe('LlmService.streamText', () => {
  /**
   * A provider stream that sends one text delta and then hangs, like a long
   * reply. Like a real fetch, it errors when the request is aborted.
   */
  const hangingStream = (capture?: (options: unknown) => void) =>
    new MockLanguageModelV4({
      doStream: (options) => {
        capture?.(options);
        return Promise.resolve({
          stream: new ReadableStream({
            start(controller) {
              options.abortSignal?.addEventListener('abort', () =>
                controller.error(new DOMException('aborted', 'AbortError')),
              );
              controller.enqueue({ type: 'stream-start', warnings: [] });
              controller.enqueue({ type: 'text-start', id: 't1' });
              controller.enqueue({
                type: 'text-delta',
                id: 't1',
                delta: 'Hel',
              });
            },
          }),
        });
      },
    });

  it('records the usage of a stopped stream', async () => {
    const { llm, records } = setup();
    const route = userRoute(hangingStream());
    const controller = new AbortController();

    const result = llm.streamText({
      name: 'chat.stream',
      userId: 'user-1',
      route,
      prompt: 'Tell me a very long story about lighthouses. '.repeat(40),
      abortSignal: controller.signal,
    });
    for await (const part of result.stream) {
      if (part.type === 'text-delta') controller.abort();
    }
    await vi.waitFor(() => expect(records).toHaveLength(1));
    // Recorded once: an abort is not also reported as an end or an error.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(records).toHaveLength(1);

    expect(records[0]).toMatchObject({
      name: 'chat.stream',
      userId: 'user-1',
      keySource: 'user',
      status: 'ok',
      metadata: expect.objectContaining({ aborted: true }) as unknown,
    });
    // The unfinished call is charged for its prompt, so a stop is never free.
    expect(records[0].inputTokens).toBeGreaterThan(400);
    expect(records[0].costUsd).toBeGreaterThan(0);
  });

  it('applies a default output token cap to streams', async () => {
    const { llm } = setup();
    let callOptions: { maxOutputTokens?: number } | undefined;
    const controller = new AbortController();
    const result = llm.streamText({
      name: 'chat.stream',
      route: userRoute(
        hangingStream((options) => {
          callOptions = options as { maxOutputTokens?: number };
        }),
      ),
      prompt: 'hi',
      abortSignal: controller.signal,
    });
    for await (const part of result.stream) {
      if (part.type === 'text-delta') controller.abort();
    }
    expect(callOptions?.maxOutputTokens).toBe(8192);
  });
});

describe('LlmService with Langfuse', () => {
  /** A Langfuse stand-in that records each call's Langfuse context and telemetry events. */
  const fakeLangfuse = () => {
    const integration = {
      onStart: vi.fn(),
      onEnd: vi.fn(),
    } satisfies Telemetry;
    const calls: LangfuseCall[] = [];
    const langfuse = {
      telemetry: (functionId: string) => ({
        functionId,
        integrations: integration,
      }),
      run: (call: LangfuseCall, fn: () => unknown) => {
        calls.push(call);
        return fn();
      },
    } as unknown as LangfuseService;
    return { langfuse, calls, integration };
  };

  const expectedAttributes = {
    traceName: 'chat.stream',
    userId: 'user-1',
    sessionId: 'conversation-1',
    version: '2026-09-16.1',
    tags: ['anthropic', 'user'],
    metadata: { documentScope: 'all' },
  };

  it('sends a call under the same name, user and trace id as its LlmCall row, priced the same way', async () => {
    const { langfuse, calls, integration } = fakeLangfuse();
    const { llm, records } = setup({ langfuse });

    await llm.generateText({
      name: 'chat.stream',
      userId: 'user-1',
      traceId: 'conversation-1',
      metadata: {
        promptVersion: '2026-09-16.1',
        documentScope: 'all',
        documentIds: ['doc-1'],
      },
      route: userRoute(
        new MockLanguageModelV4({ doGenerate: textResult('ok') }),
      ),
      prompt: 'hi',
    });

    expect(calls[0].attributes).toEqual(expectedAttributes);
    expect(integration.onStart).toHaveBeenCalledWith(
      expect.objectContaining({ functionId: 'chat.stream' }),
    );
    expect(integration.onEnd).toHaveBeenCalledOnce();
    // The same usage costs the same in Langfuse as in the LlmCall row.
    expect(
      calls[0].costOf?.({ inputTokens: 1000, outputTokens: 100 }),
    ).toBeCloseTo(records[0].costUsd!, 10);
  });

  it('sends streamed calls too', async () => {
    const { langfuse, calls, integration } = fakeLangfuse();
    const { llm } = setup({ langfuse });
    const model = new MockLanguageModelV4({
      doStream: {
        stream: simulateReadableStream({
          chunks: [
            { type: 'text-start', id: 't1' },
            { type: 'text-delta', id: 't1', delta: 'Hello' },
            { type: 'text-end', id: 't1' },
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: undefined },
              usage: textResult('').usage,
            },
          ],
        }),
      },
    });

    const result = llm.streamText({
      name: 'chat.stream',
      userId: 'user-1',
      traceId: 'conversation-1',
      metadata: { promptVersion: '2026-09-16.1', documentScope: 'all' },
      route: userRoute(model),
      prompt: 'hi',
    });

    expect(await result.text).toBe('Hello');
    expect(calls[0].attributes).toEqual(expectedAttributes);
    await vi.waitFor(() => expect(integration.onEnd).toHaveBeenCalledOnce());
  });
});
