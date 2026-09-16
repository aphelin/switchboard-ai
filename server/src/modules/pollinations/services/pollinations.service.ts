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
  TRANSCRIPTION_TIMEOUT_MS,
} from '../../../shared/constants/app.constants';
import type { AppConfiguration } from '../../../config/configuration.interface';
import type {
  PollinationsImageEditOptions,
  PollinationsImageOptions,
  PollinationsImageResult,
  PollinationsTranscriptionOptions,
  PollinationsTranscriptionResult,
} from '../types/pollinations.types';

/** The bytes say what the picture is; the edit endpoint does not always name the type. */
function sniffImageType(data: Buffer): string | null {
  if (data.length < 12) return null;
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff)
    return 'image/jpeg';
  if (
    data
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return 'image/png';
  if (
    data.subarray(0, 4).toString('ascii') === 'RIFF' &&
    data.subarray(8, 12).toString('ascii') === 'WEBP'
  )
    return 'image/webp';
  if (data.subarray(0, 3).toString('ascii') === 'GIF') return 'image/gif';
  return null;
}

/**
 * Pollinations client for the image endpoints and speech to text. Text
 * generation goes through LlmService (OpenAI-compatible) instead.
 *
 * The API key travels with every request, which is why image bytes are
 * downloaded here and stored locally: an upstream URL must never reach a browser.
 */
@Injectable()
export class PollinationsService {
  private readonly logger = new Logger(PollinationsService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly imageBreaker: CircuitBreaker<any[], PollinationsImageResult>;
  private readonly editBreaker: CircuitBreaker<any[], PollinationsImageResult>;
  private readonly transcribeBreaker: CircuitBreaker<
    any[],
    PollinationsTranscriptionResult
  >;

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
    this.editBreaker = circuitBreakerService.create<PollinationsImageResult>(
      this.editImageInternal.bind(this),
      { name: 'pollinations:image-edit', timeout: IMAGE_GENERATION_TIMEOUT_MS },
    );
    this.transcribeBreaker =
      circuitBreakerService.create<PollinationsTranscriptionResult>(
        this.transcribeInternal.bind(this),
        { name: 'pollinations:transcribe', timeout: TRANSCRIPTION_TIMEOUT_MS },
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

  /** Applies a prompt to a source image on a model that takes images in (FLUX.2 Klein and the like). */
  async editImage(
    options: PollinationsImageEditOptions,
  ): Promise<PollinationsImageResult> {
    try {
      return await this.editBreaker.fire(options);
    } catch (error) {
      if (isCircuitOpenError(error)) {
        throw new ServiceUnavailableError(
          'Image editing is temporarily unavailable (circuit open)',
        );
      }
      throw toUpstreamError('Pollinations image API', error);
    }
  }

  async transcribe(
    options: PollinationsTranscriptionOptions,
  ): Promise<PollinationsTranscriptionResult> {
    try {
      return await this.transcribeBreaker.fire(options);
    } catch (error) {
      if (isCircuitOpenError(error)) {
        throw new ServiceUnavailableError(
          'Speech to text is temporarily unavailable (circuit open)',
        );
      }
      throw toUpstreamError('Pollinations speech API', error);
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

  /**
   * OpenAI-compatible edit: the source goes in as a data URL and the result comes
   * back base64, so no upstream URL is involved on either side.
   */
  private async editImageInternal(
    options: PollinationsImageEditOptions,
  ): Promise<PollinationsImageResult> {
    const { prompt, model, image, width, height } = options;
    this.logger.log(
      `Editing image on ${model} for prompt: "${prompt.substring(0, 50)}..."`,
    );

    const response = await fetch(`${this.baseUrl}/v1/images/edits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.authHeader() },
      body: JSON.stringify({
        model,
        prompt,
        image: [
          {
            image_url: `data:${image.contentType};base64,${image.data.toString('base64')}`,
          },
        ],
        response_format: 'b64_json',
        ...(width && height && { size: `${width}x${height}` }),
      }),
      signal: AbortSignal.timeout(IMAGE_GENERATION_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`,
      );
    }

    const body = (await response.json()) as {
      data?: Array<{ b64_json?: string; url?: string; media_type?: string }>;
    };
    const first = body.data?.[0];
    if (!first?.b64_json) {
      throw new Error('Pollinations returned no image data for the edit');
    }
    const data = Buffer.from(first.b64_json, 'base64');
    const contentType =
      first.media_type ?? sniffImageType(data) ?? 'image/jpeg';

    this.logger.log(
      `Image edited (${data.byteLength} bytes, ${contentType}) for prompt: "${prompt.substring(0, 50)}..."`,
    );
    return { data, contentType };
  }

  private async transcribeInternal(
    options: PollinationsTranscriptionOptions,
  ): Promise<PollinationsTranscriptionResult> {
    const form = new FormData();
    form.append(
      'file',
      new Blob([new Uint8Array(options.data)], { type: options.contentType }),
      options.filename,
    );
    form.append('model', options.model);
    form.append('response_format', 'json');
    if (options.language) form.append('language', options.language);

    const response = await fetch(`${this.baseUrl}/v1/audio/transcriptions`, {
      method: 'POST',
      headers: this.authHeader(),
      body: form,
      signal: AbortSignal.timeout(TRANSCRIPTION_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`,
      );
    }

    const body = (await response.json()) as {
      text?: string;
      usage?: { seconds?: number };
    };
    // The billed length comes in the body and as a header; either will do.
    const headerSeconds = Number(
      response.headers.get('x-usage-prompt-audio-seconds'),
    );
    const seconds =
      typeof body.usage?.seconds === 'number'
        ? body.usage.seconds
        : Number.isFinite(headerSeconds) && headerSeconds > 0
          ? headerSeconds
          : null;

    return { text: (body.text ?? '').trim(), seconds };
  }

  private authHeader(): Record<string, string> {
    return this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {};
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
