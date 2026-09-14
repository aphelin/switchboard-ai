import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { defer, firstValueFrom, merge } from 'rxjs';
import { filter, map, timeout } from 'rxjs/operators';
import { GenerationRepository } from '../repositories/generation.repository';
import { SseService } from '../../sse/services/sse.service';
import { BudgetService } from '../../auth/services/budget.service';
import { ModelRouterService } from '../../providers/services/model-router.service';
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

  constructor(
    private readonly generationRepository: GenerationRepository,
    private readonly sseService: SseService,
    private readonly budget: BudgetService,
    private readonly router: ModelRouterService,
    @InjectQueue(GENERATION_QUEUE) private readonly generationQueue: Queue,
  ) {}

  async create(userId: string, dto: CreateGenerationDto): Promise<Generation> {
    // Text generation and prompt enhancement are LLM calls; the model is only relevant for those.
    const usesLlm = dto.type === GenerationType.TEXT || !!dto.enhance;
    const llmModel = usesLlm ? dto.llmModel : undefined;
    if (usesLlm) await this.assertModelUsable(userId, llmModel);

    const priority = dto.priority ?? JobPriority.NORMAL;

    const generation = await this.generationRepository.create({
      userId,
      prompt: dto.prompt,
      type: dto.type,
      priority,
      // The model choice is stored so a retry runs on the same model.
      parameters: {
        ...dto.parameters,
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
      parameters: dto.parameters,
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
  ): Promise<Generation> {
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
        merge(fromEvents$, fromDatabase$).pipe(timeout(timeoutMs)),
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

    const llmModel = (generation.parameters as { llmModel?: string } | null)
      ?.llmModel;
    if (generation.type === GenerationType.TEXT) {
      await this.assertModelUsable(userId, llmModel);
    }

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

  /**
   * Fails the request before anything is queued when the model is unknown or
   * needs a key the user hasn't added. The worker resolves the model again, so
   * a key removed while the job waits is not used. Only calls on the app's key
   * count toward the daily budget.
   */
  private async assertModelUsable(
    userId: string,
    llmModel: string | undefined,
  ): Promise<void> {
    const route = await this.router.resolve(userId, llmModel);
    if (route.source === 'platform') {
      await this.budget.assertWithinBudget(userId);
    }
  }
}
