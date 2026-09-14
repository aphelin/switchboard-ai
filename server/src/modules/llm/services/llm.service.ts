import { Injectable, Logger } from '@nestjs/common';
import {
  generateText,
  streamText,
  Output,
  NoObjectGeneratedError,
  type GenerateTextResult,
  type ModelMessage,
  type StopCondition,
  type StreamTextResult,
  type ToolApprovalStatus,
  type ToolSet,
} from 'ai';
import type CircuitBreaker from 'opossum';
import type { z } from 'zod';
import { ModelRegistryService } from './model-registry.service';
import { PricingService } from './pricing.service';
import { TraceService } from '../../observability/services/trace.service';
import { CircuitBreakerService } from '../../../shared/circuit-breaker/circuit-breaker.service';
import {
  isCircuitOpenError,
  isUpstreamClientError,
  ServiceUnavailableError,
  toUpstreamError,
} from '../../../shared/errors/upstream.error';
import { LLM_CALL_TIMEOUT_MS } from '../../../shared/constants/app.constants';
import {
  summarizeUsage,
  type LlmCallContext,
  type ModelSelector,
  type ProviderSlot,
} from '../types/llm.types';

export type TextResult = GenerateTextResult<ToolSet, any, any>;
export type StreamResult = StreamTextResult<ToolSet, any, any>;

/** The SDK takes either `prompt` or `messages`, never both. */
const promptInput = (options: {
  prompt?: string;
  messages?: ModelMessage[];
}) =>
  options.messages
    ? { messages: options.messages }
    : { prompt: options.prompt ?? '' };

export interface GenerateTextOptions extends LlmCallContext {
  model?: ModelSelector;
  instructions?: string;
  prompt?: string;
  messages?: ModelMessage[];
  temperature?: number;
  maxOutputTokens?: number;
  tools?: ToolSet;
  stopWhen?: StopCondition<any, any> | StopCondition<any, any>[];
  abortSignal?: AbortSignal;
}

export interface GenerateObjectOptions extends LlmCallContext {
  model?: ModelSelector;
  instructions?: string;
  prompt: string;
  temperature?: number;
  /** Retries once with the validation error fed back to the model. */
  repair?: boolean;
}

export interface StreamTextOptions extends GenerateTextOptions {
  toolApproval?: Record<string, ToolApprovalStatus>;
}

/**
 * Single entry point for every model call. Adds what raw SDK calls lack in
 * production: per-provider circuit breaker, optional provider fallback,
 * schema-validated structured output with one repair attempt, and a trace
 * record (tokens, cost, latency) for each call.
 */
@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly breakers = new Map<
    ProviderSlot,
    CircuitBreaker<any[], unknown>
  >();

  constructor(
    private readonly registry: ModelRegistryService,
    private readonly pricing: PricingService,
    private readonly trace: TraceService,
    circuitBreakerService: CircuitBreakerService,
  ) {
    const slots: ProviderSlot[] = registry.hasFallback
      ? ['primary', 'fallback']
      : ['primary'];
    for (const slot of slots) {
      this.breakers.set(
        slot,
        circuitBreakerService.create((run: () => Promise<unknown>) => run(), {
          name: `llm:${registry.providerConfig(slot).name}`,
          timeout: LLM_CALL_TIMEOUT_MS,
        }),
      );
    }
  }

  async generateText(options: GenerateTextOptions): Promise<TextResult> {
    return this.withFallback(options, async (slot) => {
      const modelId = this.registry.resolveModelId(
        options.model ?? 'main',
        slot,
      );
      const startedAt = Date.now();
      try {
        const result = await this.fire(slot, () =>
          generateText({
            model: this.registry.languageModel(options.model ?? 'main', slot),
            instructions: options.instructions,
            ...promptInput(options),
            temperature: options.temperature,
            maxOutputTokens: options.maxOutputTokens,
            tools: options.tools,
            stopWhen: options.stopWhen,
            abortSignal: options.abortSignal,
          }),
        );
        await this.recordSuccess(options, slot, modelId, startedAt, {
          usage: result.totalUsage,
          responseModel: result.response?.modelId,
          finishReason: result.finishReason,
          steps: result.steps.length,
        });
        return result;
      } catch (error) {
        await this.recordFailure(options, slot, modelId, startedAt, error);
        throw error;
      }
    });
  }

  /**
   * Structured output: the model must return JSON matching the Zod schema.
   * The SDK validates it; on failure we retry once with the error message so the
   * model can repair its answer, then give up (callers decide the fallback).
   */
  async generateObject<T>(
    schema: z.ZodType<T>,
    options: GenerateObjectOptions,
  ): Promise<T> {
    const run = (prompt: string, attempt: number) =>
      this.withFallback(options, async (slot) => {
        const modelId = this.registry.resolveModelId(
          options.model ?? 'main',
          slot,
        );
        const startedAt = Date.now();
        try {
          const result = await this.fire(slot, () =>
            generateText({
              model: this.registry.languageModel(options.model ?? 'main', slot),
              output: Output.object({ schema }),
              instructions: options.instructions,
              prompt,
              temperature: options.temperature,
            }),
          );
          await this.recordSuccess(options, slot, modelId, startedAt, {
            usage: result.totalUsage,
            responseModel: result.response?.modelId,
            finishReason: result.finishReason,
            attempt,
          });
          return result.output;
        } catch (error) {
          await this.recordFailure(options, slot, modelId, startedAt, error, {
            attempt,
          });
          throw error;
        }
      });

    try {
      return await run(options.prompt, 1);
    } catch (error) {
      if (options.repair === false || !NoObjectGeneratedError.isInstance(error))
        throw error;
      this.logger.warn(
        `Structured output invalid for "${options.name}", retrying with repair hint`,
      );
      const cause =
        error.cause instanceof Error
          ? error.cause.message
          : 'schema validation failed';
      const repairPrompt =
        `${options.prompt}\n\n` +
        `Your previous answer was rejected (${cause}). Previous answer:\n${error.text ?? '(empty)'}\n` +
        `Return only a valid JSON object that matches the schema.`;
      return run(repairPrompt, 2);
    }
  }

  /**
   * Streaming (chat). Not wrapped in the breaker's timeout because a stream is
   * long-lived by design; it does fail fast when the circuit is open, and the
   * call is traced when the stream ends.
   */
  streamText(options: StreamTextOptions): StreamResult {
    const slot: ProviderSlot = 'primary';
    if (this.breakers.get(slot)?.opened) {
      throw new ServiceUnavailableError(
        'LLM provider is temporarily unavailable (circuit open)',
      );
    }

    const modelId = this.registry.resolveModelId(options.model ?? 'main', slot);
    const startedAt = Date.now();

    return streamText({
      model: this.registry.languageModel(options.model ?? 'main', slot),
      instructions: options.instructions,
      ...promptInput(options),
      temperature: options.temperature,
      maxOutputTokens: options.maxOutputTokens,
      tools: options.tools,
      toolApproval: options.toolApproval,
      stopWhen: options.stopWhen,
      abortSignal: options.abortSignal,
      onEnd: async (event) => {
        await this.recordSuccess(options, slot, modelId, startedAt, {
          usage: event.totalUsage,
          responseModel: event.response?.modelId,
          finishReason: event.finishReason,
          steps: event.steps.length,
        });
      },
      onError: async ({ error }) => {
        await this.recordFailure(options, slot, modelId, startedAt, error);
      },
    });
  }

  private fire<T>(slot: ProviderSlot, run: () => Promise<T>): Promise<T> {
    const breaker = this.breakers.get(slot);
    if (!breaker) throw new Error(`No circuit breaker for ${slot} provider`);
    return breaker.fire(run) as Promise<T>;
  }

  /** Runs on the primary provider; on an outage (not a 4xx) retries once on the fallback provider. */
  private async withFallback<T>(
    context: LlmCallContext,
    run: (slot: ProviderSlot) => Promise<T>,
  ): Promise<T> {
    try {
      return await run('primary');
    } catch (error) {
      const canFallback =
        this.registry.hasFallback && !isUpstreamClientError(error);
      if (!canFallback) throw this.normalizeError(error);

      this.logger.warn(
        `Primary LLM provider failed for "${context.name}" (${error instanceof Error ? error.message : String(error)}), trying fallback provider`,
      );
      try {
        return await run('fallback');
      } catch (fallbackError) {
        throw this.normalizeError(fallbackError);
      }
    }
  }

  private normalizeError(error: unknown): Error {
    if (isCircuitOpenError(error)) {
      return new ServiceUnavailableError(
        'LLM provider is temporarily unavailable (circuit open)',
      );
    }
    if (NoObjectGeneratedError.isInstance(error)) return error;
    return toUpstreamError('LLM', error);
  }

  private async recordSuccess(
    context: LlmCallContext,
    slot: ProviderSlot,
    modelId: string,
    startedAt: number,
    details: {
      usage: Parameters<typeof summarizeUsage>[0];
      responseModel?: string;
      finishReason?: string;
      steps?: number;
      attempt?: number;
    },
  ): Promise<void> {
    const usage = summarizeUsage(details.usage);
    await this.trace.record({
      name: context.name,
      traceId: context.traceId,
      userId: context.userId,
      provider: this.registry.providerConfig(slot).name,
      model: modelId,
      ...usage,
      costUsd: this.pricing.estimateCost(modelId, details.responseModel, usage),
      latencyMs: Date.now() - startedAt,
      status: 'ok',
      metadata: {
        ...context.metadata,
        responseModel: details.responseModel,
        finishReason: details.finishReason,
        steps: details.steps,
        attempt: details.attempt,
        slot,
      },
    });
  }

  private async recordFailure(
    context: LlmCallContext,
    slot: ProviderSlot,
    modelId: string,
    startedAt: number,
    error: unknown,
    extra?: Record<string, unknown>,
  ): Promise<void> {
    await this.trace.record({
      name: context.name,
      traceId: context.traceId,
      userId: context.userId,
      provider: this.registry.providerConfig(slot).name,
      model: modelId,
      latencyMs: Date.now() - startedAt,
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      metadata: { ...context.metadata, ...extra, slot },
    });
  }
}
