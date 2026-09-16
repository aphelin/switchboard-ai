import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { defer, firstValueFrom, fromEvent, merge, NEVER, of } from 'rxjs';
import { filter, map, timeout } from 'rxjs/operators';
import { GenerationRepository } from '../repositories/generation.repository';
import { SseService } from '../../sse/services/sse.service';
import { BudgetService } from '../../auth/services/budget.service';
import { ModelRouterService } from '../../providers/services/model-router.service';
import { StorageService } from '../../../shared/storage/storage.service';
import { CreateGenerationDto } from '../dto/create-generation.dto';
import { QueryGenerationDto } from '../dto/query-generation.dto';
import {
  GENERATION_QUEUE,
  GENERATION_JOB_NAME,
  JOB_ATTEMPTS,
  JOB_BACKOFF_DELAY,
  BULLMQ_PRIORITY,
} from '../../../shared/constants/app.constants';
import { GenerationType, JobStatus, JobPriority } from 'generated/prisma/enums';
import type { ImageRoute } from '../../llm/types/llm.types';
import type { AppConfiguration } from '../../../config/configuration.interface';
import type {
  Generation,
  GenerationJobData,
  ImageParameters,
  TextParameters,
  PaginatedResult,
} from '../types/generation.types';

const TERMINAL_STATUSES = new Set<string>([
  JobStatus.COMPLETED,
  JobStatus.FAILED,
  JobStatus.CANCELLED,
]);

@Injectable()
export class GenerationService {
  private readonly logger = new Logger(GenerationService.name);
  private readonly publicUrl: string;

  constructor(
    private readonly generationRepository: GenerationRepository,
    private readonly sseService: SseService,
    private readonly budget: BudgetService,
    private readonly router: ModelRouterService,
    private readonly storage: StorageService,
    @InjectQueue(GENERATION_QUEUE) private readonly generationQueue: Queue,
    configService: ConfigService<AppConfiguration, true>,
  ) {
    this.publicUrl = configService.get('app', { infer: true }).publicUrl;
  }

  /**
   * Saves an image the user attached in chat as one of their finished images, so
   * it can be edited through the normal pipeline (ownership, queue, traces, retry).
   * Free: nothing is generated. Importing the same attachment again returns the
   * existing row.
   */
  async importImage(
    userId: string,
    image: { attachmentKey: string; data: Buffer; contentType: string },
  ): Promise<Generation> {
    const existing = await this.generationRepository.findImportedAttachment(
      userId,
      image.attachmentKey,
    );
    if (existing) return existing;

    const generation = await this.generationRepository.create({
      userId,
      prompt: 'Image attached in chat',
      type: GenerationType.IMAGE,
      priority: JobPriority.NORMAL,
    });
    const storageKey = `images/${generation.id}${this.storage.extensionFor(image.contentType)}`;
    await this.storage.put(storageKey, image.data);
    const imageUrl = `${this.publicUrl}/api/generations/${generation.id}/image?v=${Date.now()}`;

    const completed = await this.generationRepository.updateStatus(
      generation.id,
      JobStatus.COMPLETED,
      {
        imageUrl,
        parameters: { attachmentKey: image.attachmentKey, storageKey },
      },
    );
    this.sseService.emitGenerationComplete({
      generationId: generation.id,
      userId,
      status: JobStatus.COMPLETED,
      imageUrl,
    });
    this.logger.log(`Chat attachment imported as generation ${generation.id}`);
    return completed;
  }

  async create(userId: string, dto: CreateGenerationDto): Promise<Generation> {
    const isImage = dto.type === GenerationType.IMAGE;
    // Text generation and prompt enhancement are LLM calls; the LLM model is only relevant for those.
    const usesLlm = dto.type === GenerationType.TEXT || !!dto.enhance;
    const llmModel = usesLlm ? dto.llmModel : undefined;
    const imageParams = isImage
      ? (dto.parameters as ImageParameters | undefined)
      : undefined;
    const sourceGenerationId = imageParams?.sourceGenerationId;
    if (sourceGenerationId)
      await this.assertEditable(userId, sourceGenerationId);

    const { imageRoute } = await this.assertModelsUsable(userId, {
      llm: usesLlm,
      llmModel,
      image: isImage,
      imageModel: imageParams?.model,
      edit: !!sourceGenerationId,
    });

    // An edit that named no model runs on the included editing model: stored, so the worker and a retry agree.
    const parameters = {
      ...dto.parameters,
      ...(sourceGenerationId && imageRoute && { model: imageRoute.model.id }),
    } as ImageParameters | TextParameters;

    const priority = dto.priority ?? JobPriority.NORMAL;

    const generation = await this.generationRepository.create({
      userId,
      prompt: dto.prompt,
      type: dto.type,
      priority,
      // The model choice is stored so a retry runs on the same model.
      parameters: {
        ...parameters,
        ...(llmModel && { llmModel }),
      } as Record<string, unknown>,
    });

    const jobData: GenerationJobData = {
      generationId: generation.id,
      userId,
      prompt: dto.prompt,
      type: dto.type,
      enhance: dto.enhance ?? false,
      llmModel,
      parameters,
    };

    const job = await this.generationQueue.add(GENERATION_JOB_NAME, jobData, {
      jobId: randomUUID(),
      priority: BULLMQ_PRIORITY[priority],
      attempts: JOB_ATTEMPTS,
      backoff: { type: 'exponential', delay: JOB_BACKOFF_DELAY },
      removeOnComplete: { age: 3600, count: 1000 },
      removeOnFail: { age: 86400, count: 5000 },
    });

    await this.generationRepository.updateJobId(generation.id, job.id!);

    this.logger.log(`Generation ${generation.id} queued as job ${job.id}`);
    return { ...generation, jobId: job.id! };
  }

  async findAll(
    userId: string,
    query: QueryGenerationDto,
  ): Promise<PaginatedResult<Generation>> {
    return this.generationRepository.findMany({
      userId,
      type: query.type,
      status: query.status,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  /** Another user's generation is reported as not found, so ids can't be probed. */
  async findOne(userId: string, id: string): Promise<Generation> {
    const generation = await this.generationRepository.findByIdForUser(
      id,
      userId,
    );
    if (!generation) {
      throw new NotFoundException(`Generation ${id} not found`);
    }
    return generation;
  }

  /**
   * Resolves once the generation reaches a terminal status, or after the
   * timeout (in which case the current record is returned as-is). Lets
   * synchronous callers (agent tools, MCP) build on the async queue without polling.
   */
  async waitForTerminalStatus(
    userId: string,
    id: string,
    timeoutMs: number,
    signal?: AbortSignal,
  ): Promise<Generation> {
    // The caller went away (the chat stream was stopped): stop waiting straight away.
    const aborted$ = signal
      ? signal.aborted
        ? of(undefined)
        : fromEvent(signal, 'abort').pipe(map(() => undefined))
      : NEVER;
    const fromEvents$ = this.sseService.events$.pipe(
      filter(
        (event) =>
          'generationId' in event.payload &&
          event.payload.generationId === id &&
          TERMINAL_STATUSES.has(event.payload.status),
      ),
      map(() => undefined),
    );
    // Checked after subscribing to the event bus, so a status change can't slip between the two.
    const fromDatabase$ = defer(() => this.findOne(userId, id)).pipe(
      filter((generation) => TERMINAL_STATUSES.has(generation.status)),
      map(() => undefined),
    );

    try {
      await firstValueFrom(
        merge(fromEvents$, fromDatabase$, aborted$).pipe(timeout(timeoutMs)),
      );
    } catch {
      this.logger.warn(
        `Timed out after ${timeoutMs}ms waiting for generation ${id}`,
      );
    }

    return this.findOne(userId, id);
  }

  async retry(userId: string, id: string): Promise<Generation> {
    const generation = await this.findOne(userId, id);

    if (
      generation.status !== JobStatus.FAILED &&
      generation.status !== JobStatus.CANCELLED
    ) {
      throw new BadRequestException(
        'Only failed or cancelled generations can be retried',
      );
    }

    const stored = generation.parameters as {
      llmModel?: string;
      model?: string;
      sourceGenerationId?: string;
    } | null;
    const llmModel = stored?.llmModel;
    if (stored?.sourceGenerationId) {
      await this.assertEditable(userId, stored.sourceGenerationId);
    }
    await this.assertModelsUsable(userId, {
      llm: generation.type === GenerationType.TEXT,
      llmModel,
      image: generation.type === GenerationType.IMAGE,
      imageModel: stored?.model,
      edit: !!stored?.sourceGenerationId,
    });

    const updated = await this.generationRepository.updateStatus(
      id,
      JobStatus.PENDING,
    );

    const jobData: GenerationJobData = {
      generationId: generation.id,
      userId,
      prompt: generation.prompt,
      type: generation.type,
      enhance: false,
      llmModel,
      parameters: generation.parameters as
        | ImageParameters
        | TextParameters
        | undefined,
    };

    const job = await this.generationQueue.add(GENERATION_JOB_NAME, jobData, {
      jobId: randomUUID(),
      priority: BULLMQ_PRIORITY[generation.priority],
      attempts: JOB_ATTEMPTS,
      backoff: { type: 'exponential', delay: JOB_BACKOFF_DELAY },
    });

    await this.generationRepository.updateJobId(id, job.id!);
    this.logger.log(`Generation ${id} retried as job ${job.id}`);

    return { ...updated, jobId: job.id! };
  }

  async cancel(userId: string, id: string): Promise<Generation> {
    const generation = await this.findOne(userId, id);

    if (
      generation.status !== JobStatus.PENDING &&
      generation.status !== JobStatus.GENERATING
    ) {
      throw new BadRequestException(
        'Only pending or generating jobs can be cancelled',
      );
    }

    if (generation.jobId) {
      const job = await this.generationQueue.getJob(generation.jobId);
      if (job) {
        await job.remove().catch(() => {
          this.logger.warn(
            `Could not remove job ${generation.jobId} from queue`,
          );
        });
      }
    }

    const updated = await this.generationRepository.updateStatus(
      id,
      JobStatus.CANCELLED,
    );
    this.sseService.emitStatusUpdate({
      generationId: id,
      userId,
      status: JobStatus.CANCELLED,
    });
    this.logger.log(`Generation ${id} cancelled`);
    return updated;
  }

  /** Deletes a generation and its stored image. A job still in flight is cancelled first so the worker skips it. */
  async remove(userId: string, id: string): Promise<void> {
    const generation = await this.findOne(userId, id);
    if (
      generation.status === JobStatus.PENDING ||
      generation.status === JobStatus.GENERATING
    ) {
      await this.cancel(userId, id);
    }

    const storageKey = (generation.parameters as { storageKey?: string } | null)
      ?.storageKey;
    if (storageKey) await this.storage.delete(storageKey);

    await this.generationRepository.delete(id);
    this.logger.log(`Generation ${id} deleted`);
  }

  /**
   * Fails the request before anything is queued when a model is unknown or needs
   * a key the user hasn't added. The worker resolves the models again, so a key
   * removed while the job waits is not used. Only calls on the app's keys (LLM
   * or Pollinations images) count toward the daily budget.
   */
  private async assertModelsUsable(
    userId: string,
    models: {
      llm: boolean;
      llmModel?: string;
      image: boolean;
      imageModel?: string;
      /** The image request edits an existing image, so the model must take one in. */
      edit?: boolean;
    },
  ): Promise<{ imageRoute?: ImageRoute }> {
    const sources: string[] = [];
    let imageRoute: ImageRoute | undefined;
    if (models.llm) {
      sources.push((await this.router.resolve(userId, models.llmModel)).source);
    }
    if (models.image) {
      imageRoute = await this.router.resolveImage(userId, models.imageModel, {
        edit: models.edit,
      });
      sources.push(imageRoute.source);
    }
    if (sources.includes('platform')) {
      await this.budget.assertWithinBudget(userId);
    }
    return { imageRoute };
  }

  /** An edit starts from one of the user's own finished images; anything else is refused before queueing. */
  private async assertEditable(userId: string, id: string): Promise<void> {
    const source = await this.findOne(userId, id);
    const storageKey = (source.parameters as { storageKey?: string } | null)
      ?.storageKey;
    if (
      source.type !== GenerationType.IMAGE ||
      source.status !== JobStatus.COMPLETED ||
      !storageKey
    ) {
      throw new BadRequestException(
        'Only a finished image can be edited. Pick a completed image generation.',
      );
    }
  }
}
