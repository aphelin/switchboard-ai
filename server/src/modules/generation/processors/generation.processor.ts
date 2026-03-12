import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { GenerationRepository } from '../repositories/generation.repository';
import { PollinationsService } from '../../pollinations/services/pollinations.service';
import { SseService } from '../../sse/services/sse.service';
import {
  GENERATION_QUEUE,
  DEFAULT_IMAGE_MODEL,
  DEFAULT_TEXT_MODEL,
} from '../../../shared/constants/app.constants';
import { GenerationType, JobStatus } from 'generated/prisma/enums';
import type {
  GenerationJobData,
  ImageParameters,
  TextParameters,
} from '../types/generation.types';

@Processor(GENERATION_QUEUE)
export class GenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(GenerationProcessor.name);

  constructor(
    private readonly generationRepository: GenerationRepository,
    private readonly pollinationsService: PollinationsService,
    private readonly sseService: SseService,
  ) {
    super();
  }

  async process(job: Job<GenerationJobData>): Promise<void> {
    const { generationId, prompt, type, enhance, parameters } = job.data;

    this.logger.log(`Processing generation ${generationId} (type: ${type})`);

    try {
      await this.markAsGenerating(generationId);

      const effectivePrompt = await this.resolvePrompt(
        prompt,
        type,
        enhance,
      );

      if (type === GenerationType.IMAGE) {
        await this.processImageGeneration(
          generationId,
          effectivePrompt,
          parameters as ImageParameters,
          effectivePrompt !== prompt ? effectivePrompt : undefined,
        );
      } else {
        await this.processTextGeneration(
          generationId,
          effectivePrompt,
          parameters as TextParameters,
          effectivePrompt !== prompt ? effectivePrompt : undefined,
        );
      }

      this.logger.log(`Generation ${generationId} completed successfully`);
    } catch (error) {
      await this.handleFailure(generationId, error);
    }
  }

  private async markAsGenerating(generationId: string): Promise<void> {
    await this.generationRepository.updateStatus(
      generationId,
      JobStatus.GENERATING,
    );
    this.sseService.emitStatusUpdate({
      generationId,
      status: JobStatus.GENERATING,
    });
  }

  private async resolvePrompt(
    prompt: string,
    type: GenerationType,
    enhance: boolean,
  ): Promise<string> {
    if (!enhance || type !== GenerationType.IMAGE) return prompt;

    const enhanced = await this.pollinationsService.enhancePrompt(prompt);
    this.logger.log(
      `Prompt enhanced: "${prompt}" -> "${enhanced.substring(0, 80)}..."`,
    );
    return enhanced;
  }

  private async processImageGeneration(
    generationId: string,
    prompt: string,
    parameters: ImageParameters | undefined,
    enhancedPrompt: string | undefined,
  ): Promise<void> {
    const imageParams = parameters || {};
    const effectiveModel = imageParams.model || DEFAULT_IMAGE_MODEL;

    const result = await this.pollinationsService.generateImage({
      prompt,
      model: effectiveModel,
      width: imageParams.width,
      height: imageParams.height,
      seed: imageParams.seed,
      negativePrompt: imageParams.negativePrompt,
    });

    await this.generationRepository.updateStatus(
      generationId,
      JobStatus.COMPLETED,
      {
        imageUrl: result.imageUrl,
        enhancedPrompt,
        parameters: { ...imageParams, model: effectiveModel },
      },
    );

    this.sseService.emitGenerationComplete({
      generationId,
      status: JobStatus.COMPLETED,
      imageUrl: result.imageUrl,
      enhancedPrompt,
    });
  }

  private async processTextGeneration(
    generationId: string,
    prompt: string,
    parameters: TextParameters | undefined,
    enhancedPrompt: string | undefined,
  ): Promise<void> {
    const textParams = parameters || {};
    const effectiveModel = textParams.model || DEFAULT_TEXT_MODEL;

    const result = await this.pollinationsService.generateText({
      prompt,
      model: effectiveModel,
      temperature: textParams.temperature,
      systemPrompt: textParams.systemPrompt,
    });

    await this.generationRepository.updateStatus(
      generationId,
      JobStatus.COMPLETED,
      {
        textResult: result.text,
        enhancedPrompt,
        parameters: { ...textParams, model: effectiveModel },
      },
    );

    this.sseService.emitGenerationComplete({
      generationId,
      status: JobStatus.COMPLETED,
      textResult: result.text,
      enhancedPrompt,
    });
  }

  private async handleFailure(
    generationId: string,
    error: unknown,
  ): Promise<void> {
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
        generationId,
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
