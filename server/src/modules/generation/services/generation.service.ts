import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { GenerationRepository } from '../repositories/generation.repository';
import { CreateGenerationDto } from '../dto/create-generation.dto';
import { QueryGenerationDto } from '../dto/query-generation.dto';
import {
  GENERATION_QUEUE,
  GENERATION_JOB_NAME,
  JOB_ATTEMPTS,
  JOB_BACKOFF_DELAY,
  BULLMQ_PRIORITY,
} from '../../../shared/constants/app.constants';
import { JobStatus, JobPriority } from 'generated/prisma/enums';
import type {
  Generation,
  GenerationJobData,
  ImageParameters,
  TextParameters,
  PaginatedResult,
} from '../types/generation.types';

@Injectable()
export class GenerationService {
  private readonly logger = new Logger(GenerationService.name);

  constructor(
    private readonly generationRepository: GenerationRepository,
    @InjectQueue(GENERATION_QUEUE) private readonly generationQueue: Queue,
  ) {}

  async create(dto: CreateGenerationDto): Promise<Generation> {
    const priority = dto.priority ?? JobPriority.NORMAL;

    const generation = await this.generationRepository.create({
      prompt: dto.prompt,
      type: dto.type,
      priority,
      parameters: dto.parameters as Record<string, unknown>,
    });

    const jobData: GenerationJobData = {
      generationId: generation.id,
      prompt: dto.prompt,
      type: dto.type,
      enhance: dto.enhance ?? false,
      parameters: dto.parameters,
    };

    const job = await this.generationQueue.add(GENERATION_JOB_NAME, jobData, {
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

  async findAll(query: QueryGenerationDto): Promise<PaginatedResult<Generation>> {
    return this.generationRepository.findMany({
      type: query.type,
      status: query.status,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  async findOne(id: string): Promise<Generation> {
    const generation = await this.generationRepository.findById(id);
    if (!generation) {
      throw new NotFoundException(`Generation ${id} not found`);
    }
    return generation;
  }

  async retry(id: string): Promise<Generation> {
    const generation = await this.findOne(id);

    if (
      generation.status !== JobStatus.FAILED &&
      generation.status !== JobStatus.CANCELLED
    ) {
      throw new BadRequestException(
        'Only failed or cancelled generations can be retried',
      );
    }

    const updated = await this.generationRepository.updateStatus(
      id,
      JobStatus.PENDING,
    );

    const jobData: GenerationJobData = {
      generationId: generation.id,
      prompt: generation.prompt,
      type: generation.type,
      enhance: false,
      parameters: generation.parameters as ImageParameters | TextParameters | undefined,
    };

    const job = await this.generationQueue.add(GENERATION_JOB_NAME, jobData, {
      priority: BULLMQ_PRIORITY[generation.priority],
      attempts: JOB_ATTEMPTS,
      backoff: { type: 'exponential', delay: JOB_BACKOFF_DELAY },
    });

    await this.generationRepository.updateJobId(id, job.id!);
    this.logger.log(`Generation ${id} retried as job ${job.id}`);

    return { ...updated, jobId: job.id! };
  }

  async cancel(id: string): Promise<Generation> {
    const generation = await this.findOne(id);

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
    this.logger.log(`Generation ${id} cancelled`);
    return updated;
  }
}
