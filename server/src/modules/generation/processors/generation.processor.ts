import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { GenerationRepository } from '../repositories/generation.repository';
import {
  ImageGenerationService,
  type ImageRequest,
} from '../services/image-generation.service';
import { SseService } from '../../sse/services/sse.service';
import { LlmService } from '../../llm/services/llm.service';
import { PromptEnhancerService } from '../../llm/services/prompt-enhancer.service';
import { ModelRouterService } from '../../providers/services/model-router.service';
import { StorageService } from '../../../shared/storage/storage.service';
import { GENERATION_QUEUE } from '../../../shared/constants/app.constants';
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
  /** Catalog model id for LLM calls (default: the included model). */
  llmModel?: string;
}

@Processor(GENERATION_QUEUE)
export class GenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(GenerationProcessor.name);
  private readonly publicUrl: string;

  constructor(
    private readonly generationRepository: GenerationRepository,
    private readonly imageGeneration: ImageGenerationService,
    private readonly sseService: SseService,
    private readonly llmService: LlmService,
    private readonly modelRouter: ModelRouterService,
    private readonly promptEnhancer: PromptEnhancerService,
    private readonly storage: StorageService,
    configService: ConfigService<AppConfiguration, true>,
  ) {
    super();
    this.publicUrl = configService.get('app', { infer: true }).publicUrl;
  }

  async process(job: Job<GenerationJobData>): Promise<void> {
    const {
      generationId,
      userId,
      prompt,
      type,
      enhance,
      parameters,
      llmModel,
    } = job.data;
    const context: JobContext = { generationId, userId, llmModel };

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

    const route = await this.modelRouter.resolve(
      context.userId,
      context.llmModel,
    );
    const enhanced = await this.promptEnhancer.enhance(
      prompt,
      { traceId: context.generationId, userId: context.userId },
      route,
    );
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
    const negativePrompt =
      imageParams.negativePrompt || resolved.negativePrompt;
    // An edit reads the source image here, not at creation: the bytes never travel through the queue.
    const source = imageParams.sourceGenerationId
      ? await this.loadSourceImage(context, imageParams.sourceGenerationId)
      : undefined;
    // Resolved in the worker, so a key removed while the job waited is not used.
    const route = await this.modelRouter.resolveImage(
      context.userId,
      imageParams.model,
      { edit: !!source },
    );

    const result = await this.imageGeneration.generate({
      route,
      prompt: resolved.prompt,
      width: imageParams.width,
      height: imageParams.height,
      seed: imageParams.seed,
      negativePrompt,
      source,
      userId: context.userId,
      traceId: generationId,
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
          // The catalog id, so a retry runs on the same model and the UI can show its name.
          model: route.model.id,
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

  /** The finished image an edit starts from. It must belong to the job's owner and still have its file. */
  private async loadSourceImage(
    context: JobContext,
    sourceGenerationId: string,
  ): Promise<NonNullable<ImageRequest['source']>> {
    const source = await this.generationRepository.findById(sourceGenerationId);
    if (!source || source.userId !== context.userId) {
      throw new Error('The image to edit was not found');
    }
    const storageKey = (source.parameters as { storageKey?: string } | null)
      ?.storageKey;
    if (source.status !== JobStatus.COMPLETED || !storageKey) {
      throw new Error('The image to edit is not finished');
    }
    return {
      data: await this.storage.get(storageKey),
      contentType: this.storage.contentTypeFor(storageKey),
      generationId: sourceGenerationId,
    };
  }

  private async processTextGeneration(
    context: JobContext,
    resolved: ResolvedPrompt,
    parameters: TextParameters | undefined,
  ): Promise<void> {
    const { generationId } = context;
    const textParams = parameters || {};
    // Resolved in the worker, so a key removed while the job waited is not used.
    const route = await this.modelRouter.resolve(
      context.userId,
      context.llmModel,
    );

    const result = await this.llmService.generateText({
      name: 'generation.text',
      traceId: generationId,
      userId: context.userId,
      route,
      model: 'main',
      instructions: textParams.systemPrompt,
      prompt: resolved.prompt,
      temperature: textParams.temperature,
    });

    if (await this.isCancelled(generationId)) return;

    await this.generationRepository.updateStatus(
      generationId,
      JobStatus.COMPLETED,
      {
        textResult: result.text,
        enhancedPrompt: resolved.enhancedPrompt,
        parameters: {
          ...textParams,
          ...(context.llmModel && { llmModel: context.llmModel }),
          model: this.llmService.resolveModelId('main', route),
        },
      },
    );

    this.sseService.emitGenerationComplete({
      generationId,
      userId: context.userId,
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
