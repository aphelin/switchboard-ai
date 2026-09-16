import { Injectable, Logger } from '@nestjs/common';
import {
  generateText,
  streamText,
  Output,
  NoObjectGeneratedError,
  type GenerateTextResult,
  type LanguageModel,
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
  isNotProviderOutage,
  isUpstreamClientError,
  ServiceUnavailableError,
  toUpstreamError,
  toUserKeyError,
} from '../../../shared/errors/upstream.error';
import { redactSecrets } from '../../../shared/ai/redact-secrets';
import { LLM_CALL_TIMEOUT_MS } from '../../../shared/constants/app.constants';
import {
  BYOK_PROVIDER_INFO,
  type ByokProvider,
  type ProviderOptions,
} from '../catalog/model-catalog';
import {
  PLATFORM_ROUTE,
  summarizeUsage,
  type KeySource,
  type LlmCallContext,
  type ModelRoute,
  type ModelSelector,
  type ModelTier,
  type PlatformRoute,
  type ProviderSlot,
} from '../types/llm.types';

export type TextResult = GenerateTextResult<ToolSet, any, any>;
export type StreamResult = StreamTextResult<ToolSet, any, any>;

type Breaker = CircuitBreaker<any[], unknown>;
type InstructionsInput = Parameters<typeof generateText>[0]['instructions'];

/** The SDK takes either `prompt` or `messages`, never both. */
const promptInput = (options: {
  prompt?: string;
  messages?: ModelMessage[];
}) =>
  options.messages
    ? { messages: options.messages }
    : { prompt: options.prompt ?? '' };

/** Anthropic prompt caching: a breakpoint on the system message caches the tools and instructions before it. */
const ANTHROPIC_CACHE_BREAKPOINT: ProviderOptions = {
  anthropic: { cacheControl: { type: 'ephemeral' } },
};

export interface GenerateTextOptions extends LlmCallContext {
  model?: ModelSelector;
  instructions?: string;
  /** Mark the instructions as a prompt-cache breakpoint on providers that need it (Anthropic). */
  cacheInstructions?: boolean;
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

/** One concrete place a call can run: provider, model, the breaker guarding it and who pays. */
interface CallTarget {
  provider: string;
  /** Name used in error messages ("LLM" for the platform provider, the vendor for user keys). */
  service: string;
  modelId: string;
  /** Key into the price table; catalog models are qualified by provider. */
  pricingKey: string;
  model: LanguageModel;
  keySource: KeySource;
  breaker: Breaker;
  slot?: ProviderSlot;
  providerOptions?: ProviderOptions;
  supportsCacheBreakpoint: boolean;
}

/**
 * Single entry point for every model call. Adds what raw SDK calls lack in
 * production: per-provider circuit breaker, optional provider fallback,
 * schema-validated structured output with one repair attempt, and a trace
 * record (tokens, cost, latency, who pays) for each call.
 *
 * A call runs on the platform provider (the app's key, with fallback) or on a
 * provider with the user's own key (no fallback: a request is never silently
 * moved to another vendor or onto the app's bill).
 */
@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly platformBreakers = new Map<ProviderSlot, Breaker>();
  private readonly userKeyBreakers = new Map<ByokProvider, Breaker>();

  constructor(
    private readonly registry: ModelRegistryService,
    private readonly pricing: PricingService,
    private readonly trace: TraceService,
    private readonly circuitBreakerService: CircuitBreakerService,
  ) {
    const slots: ProviderSlot[] = registry.hasFallback
      ? ['primary', 'fallback']
      : ['primary'];
    for (const slot of slots) {
      this.platformBreakers.set(
        slot,
        circuitBreakerService.create((run: () => Promise<unknown>) => run(), {
          name: `llm:${registry.providerConfig(slot).name}`,
          timeout: LLM_CALL_TIMEOUT_MS,
        }),
      );
    }
  }

  /** The provider model id a tier resolves to on a route (to record what actually ran). */
  resolveModelId(tier: ModelTier, route: ModelRoute = PLATFORM_ROUTE): string {
    if (route.source === 'user') {
      return (tier === 'fast' ? route.fast : route.main).modelId;
    }
    return this.registry.resolveModelId(this.platformSelector(tier, route));
  }

  /** A client-safe message for a failed call: provider named, key rejections explained, secrets masked. */
  describeError(error: unknown, route: ModelRoute = PLATFORM_ROUTE): string {
    return this.normalizeError(error, {
      service:
        route.source === 'user'
          ? BYOK_PROVIDER_INFO[route.provider].label
          : 'LLM',
      keySource: route.source,
    }).message;
  }

  async generateText(options: GenerateTextOptions): Promise<TextResult> {
    return this.withFallback(options, async (target) => {
      const startedAt = Date.now();
      try {
        const result = await this.fire(target, () =>
          generateText({
            model: target.model,
            instructions: this.instructionsFor(target, options),
            ...promptInput(options),
            temperature: options.temperature,
            maxOutputTokens: options.maxOutputTokens,
            tools: options.tools,
            stopWhen: options.stopWhen,
            abortSignal: options.abortSignal,
            providerOptions: target.providerOptions,
          }),
        );
        await this.recordSuccess(options, target, startedAt, {
          usage: result.totalUsage,
          responseModel: result.response?.modelId,
          finishReason: result.finishReason,
          steps: result.steps.length,
        });
        return result;
      } catch (error) {
        await this.recordFailure(options, target, startedAt, error);
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
      this.withFallback(options, async (target) => {
        const startedAt = Date.now();
        try {
          const result = await this.fire(target, () =>
            generateText({
              model: target.model,
              output: Output.object({ schema }),
              instructions: options.instructions,
              prompt,
              temperature: options.temperature,
              providerOptions: target.providerOptions,
            }),
          );
          await this.recordSuccess(options, target, startedAt, {
            usage: result.totalUsage,
            responseModel: result.response?.modelId,
            finishReason: result.finishReason,
            attempt,
          });
          return result.output;
        } catch (error) {
          await this.recordFailure(options, target, startedAt, error, {
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
    const [target] = this.targetsFor(options);
    if (target.breaker.opened) {
      throw new ServiceUnavailableError(
        `${target.service} provider is temporarily unavailable (circuit open)`,
      );
    }

    const startedAt = Date.now();

    return streamText({
      model: target.model,
      instructions: this.instructionsFor(target, options),
      ...promptInput(options),
      temperature: options.temperature,
      maxOutputTokens: options.maxOutputTokens,
      tools: options.tools,
      toolApproval: options.toolApproval,
      stopWhen: options.stopWhen,
      abortSignal: options.abortSignal,
      providerOptions: target.providerOptions,
      onEnd: async (event) => {
        await this.recordSuccess(options, target, startedAt, {
          usage: event.totalUsage,
          responseModel: event.response?.modelId,
          finishReason: event.finishReason,
          steps: event.steps.length,
        });
      },
      onError: async ({ error }) => {
        await this.recordFailure(options, target, startedAt, error);
      },
    });
  }

  /** Primary then fallback for the platform provider; exactly one target for a user's own key. */
  private targetsFor(
    options: LlmCallContext & { model?: ModelSelector },
  ): CallTarget[] {
    const selector = options.model ?? 'main';
    const route = options.route ?? PLATFORM_ROUTE;

    if (route.source === 'user') {
      const entry = selector === 'fast' ? route.fast : route.main;
      return [
        {
          provider: route.provider,
          service: BYOK_PROVIDER_INFO[route.provider].label,
          modelId: entry.modelId,
          pricingKey: entry.id,
          model: route.languageModel(entry.modelId),
          keySource: 'user',
          breaker: this.userKeyBreaker(route.provider),
          providerOptions: entry.providerOptions,
          supportsCacheBreakpoint: route.provider === 'anthropic',
        },
      ];
    }

    const platformSelector = this.platformSelector(selector, route);
    return [...this.platformBreakers].map(([slot, breaker]) => {
      const modelId = this.registry.resolveModelId(platformSelector, slot);
      return {
        provider: this.registry.providerConfig(slot).name,
        service: 'LLM',
        modelId,
        pricingKey: modelId,
        model: this.registry.languageModel(platformSelector, slot),
        keySource: 'platform',
        breaker,
        slot,
        supportsCacheBreakpoint: false,
      };
    });
  }

  private platformSelector(
    selector: ModelSelector,
    route: PlatformRoute,
  ): ModelSelector {
    return selector === 'main' && route.mainModelId
      ? route.mainModelId
      : selector;
  }

  /**
   * One breaker per provider for calls on users' own keys. A rate limit (429) on
   * one user's key says nothing about the provider's health, so unlike on the
   * platform breakers it doesn't count; outages (5xx, timeouts) still do.
   */
  private userKeyBreaker(provider: ByokProvider): Breaker {
    let breaker = this.userKeyBreakers.get(provider);
    if (!breaker) {
      breaker = this.circuitBreakerService.create(
        (run: () => Promise<unknown>) => run(),
        {
          name: `llm:user-key:${provider}`,
          timeout: LLM_CALL_TIMEOUT_MS,
          errorFilter: isNotProviderOutage,
        },
      );
      this.userKeyBreakers.set(provider, breaker);
    }
    return breaker;
  }

  private instructionsFor(
    target: CallTarget,
    options: { instructions?: string; cacheInstructions?: boolean },
  ): InstructionsInput {
    if (
      !options.instructions ||
      !options.cacheInstructions ||
      !target.supportsCacheBreakpoint
    ) {
      return options.instructions;
    }
    return {
      role: 'system',
      content: options.instructions,
      providerOptions: ANTHROPIC_CACHE_BREAKPOINT,
    };
  }

  private fire<T>(target: CallTarget, run: () => Promise<T>): Promise<T> {
    return target.breaker.fire(run) as Promise<T>;
  }

  /** Runs on the first target; on an outage (not a 4xx) retries once on the fallback target, if there is one. */
  private async withFallback<T>(
    context: LlmCallContext & { model?: ModelSelector },
    run: (target: CallTarget) => Promise<T>,
  ): Promise<T> {
    const [primary, fallback] = this.targetsFor(context);
    try {
      return await run(primary);
    } catch (error) {
      if (!fallback || isUpstreamClientError(error)) {
        throw this.normalizeError(error, primary);
      }

      this.logger.warn(
        `Primary LLM provider failed for "${context.name}" (${redactSecrets(error instanceof Error ? error.message : String(error))}), trying fallback provider`,
      );
      try {
        return await run(fallback);
      } catch (fallbackError) {
        throw this.normalizeError(fallbackError, fallback);
      }
    }
  }

  private normalizeError(
    error: unknown,
    target: Pick<CallTarget, 'service' | 'keySource'>,
  ): Error {
    if (isCircuitOpenError(error)) {
      return new ServiceUnavailableError(
        `${target.service} provider is temporarily unavailable (circuit open)`,
      );
    }
    if (NoObjectGeneratedError.isInstance(error)) return error;

    return target.keySource === 'user'
      ? toUserKeyError(target.service, error)
      : toUpstreamError(target.service, error);
  }

  private async recordSuccess(
    context: LlmCallContext,
    target: CallTarget,
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
      provider: target.provider,
      model: target.modelId,
      keySource: target.keySource,
      ...usage,
      costUsd: this.pricing.estimateCost(
        target.pricingKey,
        details.responseModel,
        usage,
      ),
      latencyMs: Date.now() - startedAt,
      status: 'ok',
      metadata: {
        ...context.metadata,
        responseModel: details.responseModel,
        finishReason: details.finishReason,
        steps: details.steps,
        attempt: details.attempt,
        slot: target.slot,
      },
    });
  }

  private async recordFailure(
    context: LlmCallContext,
    target: CallTarget,
    startedAt: number,
    error: unknown,
    extra?: Record<string, unknown>,
  ): Promise<void> {
    await this.trace.record({
      name: context.name,
      traceId: context.traceId,
      userId: context.userId,
      provider: target.provider,
      model: target.modelId,
      keySource: target.keySource,
      latencyMs: Date.now() - startedAt,
      status: 'error',
      error: redactSecrets(
        error instanceof Error ? error.message : String(error),
      ),
      metadata: { ...context.metadata, ...extra, slot: target.slot },
    });
  }
}
