import { Injectable } from '@nestjs/common';
import { generateImage } from 'ai';
import type CircuitBreaker from 'opossum';
import { PollinationsService } from '../../pollinations/services/pollinations.service';
import { TraceService } from '../../observability/services/trace.service';
import { CircuitBreakerService } from '../../../shared/circuit-breaker/circuit-breaker.service';
import {
  isCircuitOpenError,
  isNotProviderOutage,
  ServiceUnavailableError,
  toUserKeyError,
} from '../../../shared/errors/upstream.error';
import { redactSecrets } from '../../../shared/ai/redact-secrets';
import { IMAGE_GENERATION_TIMEOUT_MS } from '../../../shared/constants/app.constants';
import {
  BYOK_PROVIDER_INFO,
  type ByokProvider,
} from '../../llm/catalog/model-catalog';
import type { ImageRoute, UserKeyImageRoute } from '../../llm/types/llm.types';
import { closestAspectRatio, withNegativePrompt } from '../utils/image-request';

type Breaker = CircuitBreaker<any[], unknown>;

export interface ImageRequest {
  route: ImageRoute;
  prompt: string;
  width?: number;
  height?: number;
  seed?: number;
  negativePrompt?: string;
  /** An edit: the prompt is applied to this finished image instead of drawing from scratch. */
  source?: { data: Buffer; contentType: string; generationId: string };
  /** Who the image is for (trace attribution and budget). */
  userId: string;
  traceId?: string;
}

export interface GeneratedImage {
  data: Buffer;
  contentType: string;
}

/**
 * Runs an image generation where the user's choice points: Pollinations on the
 * app's key, or a provider's image model on the user's own key (no fallback
 * between them). Every call is traced like an LLM call, with the per-image price
 * and who pays, so image spend on the app's key counts toward the daily budget.
 */
@Injectable()
export class ImageGenerationService {
  private readonly userKeyBreakers = new Map<ByokProvider, Breaker>();

  constructor(
    private readonly pollinations: PollinationsService,
    private readonly trace: TraceService,
    private readonly circuitBreakerService: CircuitBreakerService,
  ) {}

  async generate(request: ImageRequest): Promise<GeneratedImage> {
    const { route, source } = request;
    const call = {
      // Edits are their own line in the ledger's call types.
      name: source ? 'generation.image-edit' : 'generation.image',
      traceId: request.traceId,
      userId: request.userId,
      provider: route.source === 'user' ? route.provider : 'pollinations',
      model: route.model.modelId,
      keySource: route.source,
    };
    const startedAt = Date.now();

    try {
      const image = await this.run(request);
      await this.trace.record({
        ...call,
        costUsd: route.model.pricePerImageUsd,
        latencyMs: Date.now() - startedAt,
        status: 'ok',
        metadata: {
          catalogModel: route.model.id,
          contentType: image.contentType,
          bytes: image.data.byteLength,
          ...(source && { sourceGenerationId: source.generationId }),
        },
      });
      return image;
    } catch (error) {
      await this.trace.record({
        ...call,
        latencyMs: Date.now() - startedAt,
        status: 'error',
        error: redactSecrets(
          error instanceof Error ? error.message : String(error),
        ),
        metadata: {
          catalogModel: route.model.id,
          ...(source && { sourceGenerationId: source.generationId }),
        },
      });
      throw error;
    }
  }

  private async run(request: ImageRequest): Promise<GeneratedImage> {
    const { route, source } = request;
    if (route.source === 'user') {
      return this.generateOnUserKey(route, request);
    }
    if (source) {
      return this.pollinations.editImage({
        prompt: request.prompt,
        model: route.model.modelId,
        image: { data: source.data, contentType: source.contentType },
        width: request.width,
        height: request.height,
      });
    }
    return this.pollinations.generateImage({
      prompt: request.prompt,
      model: route.model.modelId,
      width: request.width,
      height: request.height,
      seed: request.seed,
      negativePrompt: request.negativePrompt,
    });
  }

  private async generateOnUserKey(
    route: UserKeyImageRoute,
    request: ImageRequest,
  ): Promise<GeneratedImage> {
    const service = BYOK_PROVIDER_INFO[route.provider].label;
    const text = withNegativePrompt(request.prompt, request.negativePrompt);
    try {
      const result = (await this.userKeyBreaker(route.provider).fire(() =>
        generateImage({
          model: route.imageModel(route.model.modelId),
          prompt: request.source
            ? { text, images: [request.source.data] }
            : text,
          aspectRatio: closestAspectRatio(request.width, request.height),
          seed: request.seed,
        }),
      )) as Awaited<ReturnType<typeof generateImage>>;
      return {
        data: Buffer.from(result.image.uint8Array),
        contentType: result.image.mediaType,
      };
    } catch (error) {
      if (isCircuitOpenError(error)) {
        throw new ServiceUnavailableError(
          `${service} image generation is temporarily unavailable (circuit open)`,
        );
      }
      throw toUserKeyError(service, error);
    }
  }

  /** One breaker per provider for users' keys; one user's rate limit is not a provider outage. */
  private userKeyBreaker(provider: ByokProvider): Breaker {
    let breaker = this.userKeyBreakers.get(provider);
    if (!breaker) {
      breaker = this.circuitBreakerService.create(
        (run: () => Promise<unknown>) => run(),
        {
          name: `image:user-key:${provider}`,
          timeout: IMAGE_GENERATION_TIMEOUT_MS,
          errorFilter: isNotProviderOutage,
        },
      );
      this.userKeyBreakers.set(provider, breaker);
    }
    return breaker;
  }
}
