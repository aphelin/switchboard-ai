import { describe, expect, it, vi } from 'vitest';
import { ROOT_CONTEXT, SpanStatusCode } from '@opentelemetry/api';
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-node';
import type { ConfigService } from '@nestjs/config';
import {
  LANGFUSE_CALL,
  LangfuseService,
  LangfuseSpanShaper,
  RedactSecretsSpanProcessor,
  type LangfuseCall,
} from './langfuse.service';
import type { AppConfiguration } from '../../../config/configuration.interface';

const USER_KEY = 'sk-ant-api03-user-secret-key-1234567890';

describe('LangfuseService', () => {
  it('stays out of the way when the keys are not set', () => {
    const config = { get: () => null } as unknown as ConfigService<
      AppConfiguration,
      true
    >;
    const langfuse = new LangfuseService(config);
    const fn = vi.fn(() => 'result');

    expect(langfuse.telemetry('chat.stream')).toBeUndefined();
    expect(langfuse.run({ attributes: { userId: 'user-1' } }, fn)).toBe(
      'result',
    );
    expect(fn).toHaveBeenCalledOnce();
    expect(langfuse.enabled).toBe(false);
  });

  it('runs jobs without a trace handle and records nothing when the keys are not set', async () => {
    const config = { get: () => null } as unknown as ConfigService<
      AppConfiguration,
      true
    >;
    const langfuse = new LangfuseService(config);

    const handle = await langfuse.job(
      { name: 'generation.image', userId: 'u', sessionId: 'g', input: 'x' },
      (trace) => Promise.resolve(trace),
    );
    expect(handle).toBeUndefined();
    expect(() =>
      langfuse.recordGeneration({
        name: 'generate-image',
        startTime: new Date(),
        model: 'flux',
        input: 'x',
      }),
    ).not.toThrow();
  });
});

describe('RedactSecretsSpanProcessor', () => {
  it('masks API keys in attributes, events and the status before later processors export the span', () => {
    const exporter = new InMemorySpanExporter();
    const provider = new BasicTracerProvider({
      spanProcessors: [
        new RedactSecretsSpanProcessor(),
        new SimpleSpanProcessor(exporter),
      ],
    });

    const span = provider.getTracer('test').startSpan('chat');
    span.setAttribute('gen_ai.output.messages', `here it is: ${USER_KEY}`);
    span.setAttribute('gen_ai.usage.input_tokens', 12);
    span.addEvent('exception', { 'exception.message': `bad key ${USER_KEY}` });
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: `provider said no to ${USER_KEY}`,
    });
    span.end();

    const [exported] = exporter.getFinishedSpans();
    expect(JSON.stringify(exported.attributes)).not.toContain(USER_KEY);
    expect(exported.attributes['gen_ai.output.messages']).toBe(
      'here it is: sk-ant-[redacted]',
    );
    expect(exported.attributes['gen_ai.usage.input_tokens']).toBe(12);
    expect(JSON.stringify(exported.events)).not.toContain(USER_KEY);
    expect(exported.status.message).toBe(
      'provider said no to sk-ant-[redacted]',
    );
  });
});

describe('LangfuseSpanShaper', () => {
  const setup = () => {
    const exporter = new InMemorySpanExporter();
    const provider = new BasicTracerProvider({
      spanProcessors: [
        new LangfuseSpanShaper(),
        new SimpleSpanProcessor(exporter),
      ],
    });
    return { tracer: provider.getTracer('ai'), exporter };
  };
  const messages = (...list: Array<[role: string, text: string]>) =>
    JSON.stringify(
      list.map(([role, content]) => ({
        role,
        parts: [{ type: 'text', content }],
      })),
    );

  it('names the root after the call and shows the latest user message and the reply', () => {
    const { tracer, exporter } = setup();
    const span = tracer.startSpan('invoke_agent openai/gpt-5.4-mini', {
      attributes: {
        'gen_ai.operation.name': 'invoke_agent',
        'gen_ai.agent.name': 'chat.stream',
        'gen_ai.input.messages': messages(
          ['user', 'Hi'],
          ['assistant', 'Hello!'],
          ['user', 'How many remote days?'],
        ),
      },
    });
    span.setAttribute(
      'gen_ai.output.messages',
      messages(['assistant', 'Three a week.']),
    );
    span.end();

    const [root] = exporter.getFinishedSpans();
    expect(root.name).toBe('chat.stream');
    expect(root.attributes['langfuse.observation.input']).toBe(
      '"How many remote days?"',
    );
    expect(root.attributes['langfuse.observation.output']).toBe(
      '"Three a week."',
    );
  });

  it('gives steps and model calls stable names, and labels and prices each model call like LlmCall', () => {
    const { tracer, exporter } = setup();
    const costOf = vi.fn<NonNullable<LangfuseCall['costOf']>>(() => 0.0042);
    const callContext = ROOT_CONTEXT.setValue(LANGFUSE_CALL, {
      attributes: {},
      costOf,
    } satisfies LangfuseCall);

    tracer
      .startSpan('step 2', {
        attributes: { 'gen_ai.operation.name': 'agent_step' },
      })
      .end();
    const modelCall = tracer.startSpan(
      'chat openai/gpt-5.4-mini',
      {
        attributes: {
          'gen_ai.operation.name': 'chat',
          'gen_ai.request.model': 'openai/gpt-5.4-mini',
        },
      },
      callContext,
    );
    modelCall.setAttributes({
      'gen_ai.response.model': 'gpt-5.4-mini-2026-03-17',
      'gen_ai.usage.input_tokens': 1000,
      'gen_ai.usage.output_tokens': 100,
      'gen_ai.usage.cache_read.input_tokens': 200,
    });
    modelCall.end();

    const [step, generation] = exporter.getFinishedSpans();
    expect(step.name).toBe('step');
    expect(step.attributes['langfuse.observation.metadata.step']).toBe('2');
    expect(generation.name).toBe('call-llm');
    // The requested id, as in LlmCall, not the dated one the provider answered with.
    expect(generation.attributes['langfuse.observation.model.name']).toBe(
      'openai/gpt-5.4-mini',
    );
    expect(costOf).toHaveBeenCalledWith(
      { inputTokens: 1000, outputTokens: 100, cachedInputTokens: 200 },
      'gpt-5.4-mini-2026-03-17',
    );
    expect(generation.attributes['langfuse.observation.cost_details']).toBe(
      '{"total":0.0042}',
    );
  });
});
