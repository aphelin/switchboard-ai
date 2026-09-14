import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import type CircuitBreaker from 'opossum';
import { CircuitBreakerService } from '../../../shared/circuit-breaker/circuit-breaker.service';
import {
  isCircuitOpenError,
  ServiceUnavailableError,
  toUpstreamError,
} from '../../../shared/errors/upstream.error';
import {
  DEFAULT_IMAGE_MODEL,
  IMAGE_GENERATION_TIMEOUT_MS,
} from '../../../shared/constants/app.constants';
import type { AppConfiguration } from '../../../config/configuration.interface';
import type {
  PollinationsImageOptions,
  PollinationsImageResult,
} from '../types/pollinations.types';

/**
 * Pollinations image API client. Text generation goes through LlmService
 * (OpenAI-compatible), so this service only handles images.
 *
 * The API key travels in the request URL, which is why the image bytes are
 * downloaded here and stored locally: the upstream URL must never reach a browser.
 */
@Injectable()
export class PollinationsService {
  private readonly logger = new Logger(PollinationsService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly imageBreaker: CircuitBreaker<any[], PollinationsImageResult>;

  constructor(
    private readonly httpService: HttpService,
    configService: ConfigService<AppConfiguration, true>,
    circuitBreakerService: CircuitBreakerService,
  ) {
    const pollinations = configService.get('pollinations', { infer: true });
    this.baseUrl = pollinations.baseUrl;
    this.apiKey = pollinations.apiKey;

    this.imageBreaker = circuitBreakerService.create<PollinationsImageResult>(
      this.generateImageInternal.bind(this),
      { name: 'pollinations:image', timeout: IMAGE_GENERATION_TIMEOUT_MS },
    );
  }

  async generateImage(
    options: PollinationsImageOptions,
  ): Promise<PollinationsImageResult> {
    try {
      return await this.imageBreaker.fire(options);
    } catch (error) {
      if (isCircuitOpenError(error)) {
        throw new ServiceUnavailableError(
          'Image generation is temporarily unavailable (circuit open)',
        );
      }
      throw toUpstreamError('Pollinations image API', error);
    }
  }

  private async generateImageInternal(
    options: PollinationsImageOptions,
  ): Promise<PollinationsImageResult> {
    const imageUrl = this.buildImageUrl(options);

    this.logger.log(
      `Generating image for prompt: "${options.prompt.substring(0, 50)}..."`,
    );

    const response = await firstValueFrom(
      this.httpService.get<ArrayBuffer>(imageUrl, {
        responseType: 'arraybuffer',
        timeout: IMAGE_GENERATION_TIMEOUT_MS,
        maxRedirects: 5,
      }),
    );

    const contentType =
      (response.headers['content-type'] as string | undefined) ?? 'image/jpeg';
    const data = Buffer.from(response.data);

    this.logger.log(
      `Image generated (${data.byteLength} bytes, ${contentType}) for prompt: "${options.prompt.substring(0, 50)}..."`,
    );

    return { data, contentType };
  }

  private buildImageUrl(options: PollinationsImageOptions): string {
    const {
      prompt,
      model = DEFAULT_IMAGE_MODEL,
      width,
      height,
      seed,
      negativePrompt,
    } = options;

    const params = new URLSearchParams();
    params.set('model', model);
    params.set('nologo', 'true');
    if (this.apiKey) params.set('key', this.apiKey);
    if (width) params.set('width', width.toString());
    if (height) params.set('height', height.toString());
    if (seed !== undefined) params.set('seed', seed.toString());
    if (negativePrompt) params.set('negative_prompt', negativePrompt);

    const encodedPrompt = encodeURIComponent(prompt);
    return `${this.baseUrl}/image/${encodedPrompt}?${params.toString()}`;
  }
}
