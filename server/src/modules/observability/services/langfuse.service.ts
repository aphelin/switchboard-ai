import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TelemetryOptions } from 'ai';
import {
  context,
  createContextKey,
  type Attributes,
  type Context,
} from '@opentelemetry/api';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import {
  propagateAttributes,
  startActiveObservation,
  startObservation,
  type PropagateAttributesParams,
} from '@langfuse/tracing';
import { LangfuseVercelAiSdkIntegration } from '@langfuse/vercel-ai-sdk';
import {
  NodeTracerProvider,
  type ReadableSpan,
  type Span,
  type SpanProcessor,
} from '@opentelemetry/sdk-trace-node';
import { redactSecrets } from '../../../shared/ai/redact-secrets';
import type { AppConfiguration } from '../../../config/configuration.interface';
import type { UsageSummary } from '../../llm/types/llm.types';

/** What LlmService tells Langfuse about one call, beyond what the AI SDK spans record. */
export interface LangfuseCall {
  /** Trace name, user, session, version, tags and metadata, applied to every span of the call. */
  attributes: PropagateAttributesParams;
  /** Prices one model invocation with the app's own rates, so Langfuse shows the same cost as the LlmCall table. */
  costOf?: (usage: UsageSummary, responseModel?: string) => number | null;
}

/** Carries the current LangfuseCall to the span processors, next to Langfuse's propagated attributes. */
export const LANGFUSE_CALL = createContextKey('switchboard.langfuse-call');

/** A job with several model calls (an image generation: prompt enhancement, then the image), traced as one unit. */
export interface LangfuseJob {
  name: string;
  userId: string;
  sessionId: string;
  /** What a reviewer should see as the job's input, e.g. the user's prompt. */
  input: unknown;
}

/** Lets a running job report its result on its trace. */
export interface LangfuseJobTrace {
  /** The job's result as a reviewer should see it, e.g. the image (see `imageDataUri`). */
  setOutput(output: unknown): void;
  /** Marks the job as failed when it handles its own error. */
  setError(message: string): void;
}

/** A model call made outside the AI SDK (an image generation), recorded once it has finished. */
export interface LangfuseGenerationRecord {
  name: string;
  startTime: Date;
  model: string;
  input: unknown;
  output?: unknown;
  costUsd?: number | null;
  error?: string;
  metadata?: Record<string, unknown>;
}

/** Set while a job trace is active, so model calls inside it become its children instead of traces of their own. */
const LANGFUSE_JOB = createContextKey('switchboard.langfuse-job');

/** An image as a base64 data URI: Langfuse's processor uploads it and shows it as media, not as text. */
export const imageDataUri = (image: { data: Buffer; contentType: string }) =>
  `data:${image.contentType};base64,${image.data.toString('base64')}`;

/** The AI SDK's span names contain the model id and the step number; these replace them. */
export const SPAN_NAMES = { step: 'step', modelCall: 'call-llm' } as const;

interface GenAiMessage {
  role?: string;
  parts?: Array<{ type?: string; content?: unknown }>;
}

const parseMessages = (value: unknown): GenAiMessage[] => {
  if (typeof value !== 'string') return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as GenAiMessage[]) : [];
  } catch {
    return [];
  }
};

const textOf = (messages: GenAiMessage[]) =>
  messages
    .flatMap((message) => message.parts ?? [])
    .filter((part) => part.type === 'text' && typeof part.content === 'string')
    .map((part) => part.content as string)
    .join('\n\n');

const numberAttribute = (value: unknown) =>
  typeof value === 'number' ? value : undefined;

/**
 * Brings the AI SDK's spans in line with Langfuse's trace guidelines before export:
 * - stable names without the model id or step number: the root is named after the
 *   call (`chat.stream`), each agent step `step`, each model invocation `call-llm`;
 * - the root's input and output are the user's message and the reply, instead of
 *   the whole prompt (each `call-llm` generation still shows the full context);
 * - each generation carries the app's own cost for it (the platform provider
 *   resells models at its own prices, which Langfuse's price table doesn't know)
 *   and the requested model id, as in LlmCall: some providers answer with a dated
 *   id and some with none, which would split one model in two in Langfuse.
 */
export class LangfuseSpanShaper implements SpanProcessor {
  private readonly pricing = new WeakMap<object, LangfuseCall['costOf']>();

  onStart(span: Span, parentContext: Context): void {
    const operation = span.attributes['gen_ai.operation.name'];
    if (operation === 'invoke_agent') {
      const callName = span.attributes['gen_ai.agent.name'];
      if (typeof callName === 'string') span.updateName(callName);
    } else if (operation === 'agent_step') {
      span.setAttribute(
        'langfuse.observation.metadata.step',
        span.name.replace(/^step /, ''),
      );
      span.updateName(SPAN_NAMES.step);
    } else if (operation === 'chat') {
      span.updateName(SPAN_NAMES.modelCall);
      const call = parentContext.getValue(LANGFUSE_CALL) as
        | LangfuseCall
        | undefined;
      if (call?.costOf) this.pricing.set(span, call.costOf);
    }
  }

  onEnd(span: ReadableSpan): void {
    const operation = span.attributes['gen_ai.operation.name'];
    if (operation === 'invoke_agent') this.summarize(span.attributes);
    if (operation === 'chat') this.describeModelCall(span);
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }

  private summarize(attributes: Attributes): void {
    const userMessages = parseMessages(
      attributes['gen_ai.input.messages'],
    ).filter((message) => message.role === 'user');
    const input = textOf(userMessages.slice(-1));
    const output = textOf(parseMessages(attributes['gen_ai.output.messages']));
    if (input) attributes['langfuse.observation.input'] = JSON.stringify(input);
    if (output) {
      attributes['langfuse.observation.output'] = JSON.stringify(output);
    }
  }

  private describeModelCall(span: ReadableSpan): void {
    const { attributes } = span;
    const requestedModel = attributes['gen_ai.request.model'];
    if (typeof requestedModel === 'string') {
      attributes['langfuse.observation.model.name'] = requestedModel;
    }

    const costOf = this.pricing.get(span);
    if (!costOf) return;
    this.pricing.delete(span);
    const responseModel = attributes['gen_ai.response.model'];
    const cost = costOf(
      {
        inputTokens: numberAttribute(attributes['gen_ai.usage.input_tokens']),
        outputTokens: numberAttribute(attributes['gen_ai.usage.output_tokens']),
        cachedInputTokens: numberAttribute(
          attributes['gen_ai.usage.cache_read.input_tokens'],
        ),
      },
      typeof responseModel === 'string' ? responseModel : undefined,
    );
    if (cost !== null) {
      attributes['langfuse.observation.cost_details'] = JSON.stringify({
        total: cost,
      });
    }
  }
}

const redactAttributes = (attributes: Attributes) => {
  for (const [key, value] of Object.entries(attributes)) {
    if (typeof value === 'string') attributes[key] = redactSecrets(value);
  }
};

/**
 * Masks API keys in everything a span carries before it is exported: prompts,
 * outputs, error messages (upstream errors can echo the key that was sent).
 * Langfuse's own `mask` option only covers its langfuse.* attributes, while the
 * AI SDK records prompts and outputs as gen_ai.* attributes. Registered before
 * the Langfuse processor, so spans are clean by the time it reads them.
 */
export class RedactSecretsSpanProcessor implements SpanProcessor {
  onStart(): void {}

  onEnd(span: ReadableSpan): void {
    redactAttributes(span.attributes);
    for (const event of span.events) {
      if (event.attributes) redactAttributes(event.attributes);
    }
    if (span.status.message) {
      span.status.message = redactSecrets(span.status.message);
    }
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

/**
 * Optional export of model calls to Langfuse, next to the LlmCall table (which
 * stays the source for budgets and the in-app traces view). Off unless the
 * Langfuse keys are set. LlmService attaches it to each AI SDK call, so every
 * model call it makes shows up with its prompt, output, tool calls and tokens;
 * image jobs are traced as a whole, with their images, by the generation worker.
 */
@Injectable()
export class LangfuseService implements OnApplicationShutdown {
  private readonly logger = new Logger(LangfuseService.name);
  private readonly provider?: NodeTracerProvider;
  private readonly integration?: LangfuseVercelAiSdkIntegration;

  constructor(config: ConfigService<AppConfiguration, true>) {
    const langfuse = config.get('langfuse', { infer: true });
    if (!langfuse) return;

    this.provider = new NodeTracerProvider({
      resource: resourceFromAttributes({ 'service.name': 'switchboard-api' }),
      // Order matters: each processor sees the span after the ones before it.
      spanProcessors: [
        new LangfuseSpanShaper(),
        new RedactSecretsSpanProcessor(),
        new LangfuseSpanProcessor(langfuse),
      ],
    });
    // Also installs the async context manager that carries propagated attributes into streams.
    this.provider.register();
    this.integration = new LangfuseVercelAiSdkIntegration();
    this.logger.log(`Exporting model calls to Langfuse at ${langfuse.baseUrl}`);
  }

  /** The `telemetry` option for an AI SDK call; undefined (no telemetry) when Langfuse is off. */
  telemetry(functionId: string): TelemetryOptions | undefined {
    return this.integration && { functionId, integrations: this.integration };
  }

  get enabled(): boolean {
    return !!this.integration;
  }

  /** Runs `fn` so that every span started inside it, streamed steps included, belongs to `call`. */
  run<T>(call: LangfuseCall, fn: () => T): T {
    if (!this.integration) return fn();
    const withCall = () =>
      context.with(context.active().setValue(LANGFUSE_CALL, call), fn);
    // Inside a job the job names the trace; the call's own attributes would rename it.
    return context.active().getValue(LANGFUSE_JOB)
      ? withCall()
      : propagateAttributes(call.attributes, withCall);
  }

  /**
   * Runs a job with several model calls as one Langfuse trace: a `chain` root
   * with the job's input and result, and the calls made inside it as children.
   * `fn` gets no trace handle when Langfuse is off.
   */
  job<T>(
    job: LangfuseJob,
    fn: (trace?: LangfuseJobTrace) => Promise<T>,
  ): Promise<T> {
    if (!this.integration) return fn();
    return propagateAttributes(
      { traceName: job.name, userId: job.userId, sessionId: job.sessionId },
      () =>
        startActiveObservation(
          job.name,
          (root) => {
            root.update({ input: job.input });
            const trace: LangfuseJobTrace = {
              setOutput: (output) => root.update({ output }),
              setError: (message) =>
                root.update({ level: 'ERROR', statusMessage: message }),
            };
            return context.with(
              context.active().setValue(LANGFUSE_JOB, true),
              () => fn(trace),
            );
          },
          { asType: 'chain' },
        ),
    );
  }

  /** Records a finished model call as a generation, under the job trace it ran in. */
  recordGeneration(record: LangfuseGenerationRecord): void {
    if (!this.integration) return;
    startObservation(
      record.name,
      {
        model: record.model,
        input: record.input,
        output: record.output,
        costDetails:
          record.costUsd != null ? { total: record.costUsd } : undefined,
        metadata: record.metadata,
        ...(record.error && { level: 'ERROR', statusMessage: record.error }),
      },
      { asType: 'generation', startTime: record.startTime },
    ).end();
  }

  /** Flushes buffered spans; runs on app.close() (the eval runner closes the app when done). */
  async onApplicationShutdown(): Promise<void> {
    await this.provider?.shutdown();
  }
}
