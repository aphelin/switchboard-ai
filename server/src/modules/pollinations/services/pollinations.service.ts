import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import CircuitBreaker from 'opossum';
import { CircuitBreakerService } from '../../../shared/circuit-breaker/circuit-breaker.service';
import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_TEXT_MODEL,
  PROMPT_ENHANCE_TEMPERATURE,
  IMAGE_GENERATION_TIMEOUT_MS,
  TEXT_GENERATION_TIMEOUT_MS,
  TEXT_HTTP_TIMEOUT_MS,
} from '../../../shared/constants/app.constants';
import type { AppConfiguration } from '../../../config/configuration.interface';
import type {
  ChatMessage,
  PollinationsImageOptions,
  PollinationsImageResult,
  PollinationsTextOptions,
  PollinationsTextResult,
  PollinationsTextResponse,
} from '../types/pollinations.types';

@Injectable()
export class PollinationsService {
  private readonly logger = new Logger(PollinationsService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly imageBreaker: CircuitBreaker;
  private readonly textBreaker: CircuitBreaker;

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
      { timeout: IMAGE_GENERATION_TIMEOUT_MS },
      async () => {
        throw new Error('Image generation service is temporarily unavailable');
      },
    );

    this.textBreaker = circuitBreakerService.create<PollinationsTextResult>(
      this.generateTextInternal.bind(this),
      { timeout: TEXT_GENERATION_TIMEOUT_MS },
      async () => {
        throw new Error('Text generation service is temporarily unavailable');
      },
    );
  }

  async generateImage(
    options: PollinationsImageOptions,
  ): Promise<PollinationsImageResult> {
    return this.imageBreaker.fire(options) as Promise<PollinationsImageResult>;
  }

  async generateText(
    options: PollinationsTextOptions,
  ): Promise<PollinationsTextResult> {
    return this.textBreaker.fire(options) as Promise<PollinationsTextResult>;
  }

  async enhancePrompt(prompt: string): Promise<string> {
    try {
      const result = await this.generateText({
        prompt: `You are a prompt engineer. Improve the following image generation prompt to be more descriptive, detailed, and produce better results. Only return the improved prompt, nothing else.\n\nOriginal prompt: "${prompt}"`,
        model: DEFAULT_TEXT_MODEL,
        temperature: PROMPT_ENHANCE_TEMPERATURE,
      });
      return result.text.trim();
    } catch (error) {
      this.logger.warn(`Prompt enhancement failed, using original: ${error}`);
      return prompt;
    }
  }

  private async generateImageInternal(
    options: PollinationsImageOptions,
  ): Promise<PollinationsImageResult> {
    const imageUrl = this.buildImageUrl(options);

    this.logger.log(
      `Triggering image generation for prompt: "${options.prompt.substring(0, 50)}..."`,
    );

    const response = await firstValueFrom(
      this.httpService.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: IMAGE_GENERATION_TIMEOUT_MS,
        maxRedirects: 5,
      }),
    );

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Image generation returned status ${response.status}`);
    }

    this.logger.log(
      `Image generated successfully for prompt: "${options.prompt.substring(0, 50)}..."`,
    );

    return { imageUrl };
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

  private async generateTextInternal(
    options: PollinationsTextOptions,
  ): Promise<PollinationsTextResult> {
    const {
      prompt,
      model = DEFAULT_TEXT_MODEL,
      temperature,
      systemPrompt,
    } = options;

    const messages = this.buildChatMessages(prompt, systemPrompt);

    const response = await firstValueFrom(
      this.httpService.post<PollinationsTextResponse>(
        `${this.baseUrl}/v1/chat/completions`,
        { model, messages, temperature },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: TEXT_HTTP_TIMEOUT_MS,
        },
      ),
    );

    const text = response.data.choices[0]?.message?.content || '';

    this.logger.log(
      `Text generated for prompt: "${prompt.substring(0, 50)}..."`,
    );

    return { text };
  }

  private buildChatMessages(
    prompt: string,
    systemPrompt?: string,
  ): ChatMessage[] {
    const messages: ChatMessage[] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });
    return messages;
  }
}
