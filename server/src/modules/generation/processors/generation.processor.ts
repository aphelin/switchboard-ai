import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { GenerationRepository } from '../repositories/generation.repository';
import { PollinationsService } from '../../pollinations/services/pollinations.service';
import { SseService } from '../../sse/services/sse.service';
import { LlmService } from '../../llm/services/llm.service';
import { ModelRegistryService } from '../../llm/services/model-registry.service';
import { PromptEnhancerService } from '../../llm/services/prompt-enhancer.service';
import { StorageService } from '../../../shared/storage/storage.service';
import {
  GENERATION_QUEUE,
  DEFAULT_IMAGE_MODEL,
} from '../../../shared/constants/app.constants';
import { GenerationType, JobStatus } from 'generated/prisma/enums';
import type { AppConfiguration } from '../../../config/configuration.interface';
import type {
  GenerationJobData,
  ImageParameters,
  TextParameters,
} from '../types/generation.types';

interface ResolvedPrompt {
  prompt: string;
  enhancedPrompt?: string;
  negativePrompt?: string;
}

/** Identifies the job being processed; the owner id routes SSE events and attributes LLM cost. */
interface JobContext {
  generationId: string;
  userId: string;
}

@Processor(GENERATION_QUEUE)
export class GenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(GenerationProcessor.name);
  private readonly publicUrl: string;

  constructor(
    private readonly generationRepository: GenerationRepository,
    private readonly pollinationsService: PollinationsService,
    private readonly sseService: SseService,
    private readonly llmService: LlmService,
    private readonly modelRegistry: ModelRegistryService,
    private readonly promptEnhancer: PromptEnhancerService,
    private readonly storage: StorageService,
    configService: ConfigService<AppConfiguration, true>,
  ) {
    super();
    this.publicUrl = configService.get('app', { infer: true }).publicUrl;
  }

  async process(job: Job<GenerationJobData>): Promise<void> {
    const { generationId, userId, prompt, type, enhance, parameters } =
      job.data;
    const context: JobContext = { generationId, userId };

    this.logger.log(`Processing generation ${generationId} (type: ${type})`);

    try {
      if (await this.isCancelled(generationId)) return;

      await this.markAsGenerating(context);

      const resolved = await this.resolvePrompt(context, prompt, type, enhance);

      if (await this.isCancelled(generationId)) return;

      if (type === GenerationType.IMAGE) {
        await this.processImageGeneration(
          context,
          resolved,
          parameters as ImageParameters,
        );
      } else {
        await this.processTextGeneration(
          context,
          resolved,
          parameters as TextParameters,
        );
      }

      this.logger.log(`Generation ${generationId} completed successfully`);
    } catch (error) {
      await this.handleFailure(context, error);
    }
  }

  private async isCancelled(generationId: string): Promise<boolean> {
    const generation = await this.generationRepository.findById(generationId);
    if (generation?.status === JobStatus.CANCELLED) {
      this.logger.log(`Generation ${generationId} was cancelled, skipping`);
      return true;
    }
    return false;
  }

  private async markAsGenerating(context: JobContext): Promise<void> {
    await this.generationRepository.updateStatus(
      context.generationId,
      JobStatus.GENERATING,
    );
    this.sseService.emitStatusUpdate({
      ...context,
      status: JobStatus.GENERATING,
    });
  }

  /** Optional structured prompt enhancement; falls back to the original prompt on any failure. */
  private async resolvePrompt(
    context: JobContext,
    prompt: string,
    type: GenerationType,
    enhance: boolean,
  ): Promise<ResolvedPrompt> {
    if (!enhance || type !== GenerationType.IMAGE) return { prompt };

    const enhanced = await this.promptEnhancer.enhance(prompt, {
      traceId: context.generationId,
      userId: context.userId,
    });
    if (!enhanced) return { prompt };

    this.logger.log(
      `Prompt enhanced: "${prompt}" -> "${enhanced.enhancedPrompt.substring(0, 80)}..."`,
    );
    return {
      prompt: enhanced.enhancedPrompt,
      enhancedPrompt: enhanced.enhancedPrompt,
      negativePrompt: enhanced.negativePrompt ?? undefined,
    };
  }

  private async processImageGeneration(
    context: JobContext,
    resolved: ResolvedPrompt,
    parameters: ImageParameters | undefined,
  ): Promise<void> {
    const { generationId } = context;
    const imageParams = parameters || {};
    const effectiveModel = imageParams.model || DEFAULT_IMAGE_MODEL;
    const negativePrompt =
      imageParams.negativePrompt || resolved.negativePrompt;

    const result = await this.pollinationsService.generateImage({
      prompt: resolved.prompt,
      model: effectiveModel,
      width: imageParams.width,
      height: imageParams.height,
      seed: imageParams.seed,
      negativePrompt,
    });

    if (await this.isCancelled(generationId)) return;

    // Store the bytes ourselves and hand out our own URL: the upstream URL contains the API key.
    const storageKey = `images/${generationId}${this.storage.extensionFor(result.contentType)}`;
    await this.storage.put(storageKey, result.data);
    const imageUrl = `${this.publicUrl}/api/generations/${generationId}/image?v=${Date.now()}`;

    await this.generationRepository.updateStatus(
      generationId,
      JobStatus.COMPLETED,
      {
        imageUrl,
        enhancedPrompt: resolved.enhancedPrompt,
        parameters: {
          ...imageParams,
          model: effectiveModel,
          ...(negativePrompt && { negativePrompt }),
          storageKey,
        },
      },
    );

    this.sseService.emitGenerationComplete({
      ...context,
      status: JobStatus.COMPLETED,
      imageUrl,
      enhancedPrompt: resolved.enhancedPrompt,
    });
  }

  private async processTextGeneration(
    context: JobContext,
    resolved: ResolvedPrompt,
    parameters: TextParameters | undefined,
  ): Promise<void> {
    const { generationId } = context;
    const textParams = parameters || {};
    const modelSelector = textParams.model || 'main';

    const result = await this.llmService.generateText({
      name: 'generation.text',
      traceId: generationId,
      userId: context.userId,
      model: modelSelector,
      instructions: textParams.systemPrompt,
      prompt: resolved.prompt,
      temperature: textParams.temperature,
    });

    if (await this.isCancelled(generationId)) return;

    const effectiveModel = this.modelRegistry.resolveModelId(modelSelector);

    await this.generationRepository.updateStatus(
      generationId,
      JobStatus.COMPLETED,
      {
        textResult: result.text,
        enhancedPrompt: resolved.enhancedPrompt,
        parameters: { ...textParams, model: effectiveModel },
      },
    );

    this.sseService.emitGenerationComplete({
      ...context,
      status: JobStatus.COMPLETED,
      textResult: result.text,
      enhancedPrompt: resolved.enhancedPrompt,
    });
  }

  private async handleFailure(
    context: JobContext,
    error: unknown,
  ): Promise<void> {
    const { generationId } = context;
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';

    this.logger.error(
      `Generation ${generationId} failed: ${errorMessage}`,
      error instanceof Error ? error.stack : undefined,
    );

    try {
      await this.generationRepository.updateStatus(
        generationId,
        JobStatus.FAILED,
        { error: errorMessage },
      );

      this.sseService.emitStatusUpdate({
        ...context,
        status: JobStatus.FAILED,
        error: errorMessage,
      });
    } catch (cleanupError) {
      this.logger.error(
        `Failed to update status for generation ${generationId}`,
        cleanupError instanceof Error ? cleanupError.stack : undefined,
      );
    }
  }
}
