import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  Generation,
  GenerationType,
  PaginatedResult,
} from '../types/generation.types';
import { JobStatus, Prisma } from 'generated/prisma/browser';

@Injectable()
export class GenerationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    prompt: string;
    type: GenerationType;
    parameters?: Record<string, unknown>;
    jobId?: string;
  }): Promise<Generation> {
    return this.prisma.generation.create({
      data: {
        ...data,
        parameters: data.parameters as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async findById(id: string): Promise<Generation | null> {
    return this.prisma.generation.findUnique({ where: { id } });
  }

  async findByJobId(jobId: string): Promise<Generation | null> {
    return this.prisma.generation.findUnique({ where: { jobId } });
  }

  async findMany(params: {
    type?: GenerationType;
    status?: JobStatus;
    page: number;
    limit: number;
  }): Promise<PaginatedResult<Generation>> {
    const { type, status, page, limit } = params;

    const where: Record<string, unknown> = {};
    if (type) where.type = type;
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.generation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.generation.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateStatus(
    id: string,
    status: JobStatus,
    extra?: {
      imageUrl?: string;
      textResult?: string;
      error?: string;
      enhancedPrompt?: string;
      parameters?: Record<string, unknown>;
    },
  ): Promise<Generation> {
    const cleared = this.getFieldsToClear(status);
    const { parameters, ...rest } = extra || {};
    return this.prisma.generation.update({
      where: { id },
      data: {
        ...cleared,
        status,
        ...rest,
        ...(parameters && { parameters: parameters as Prisma.InputJsonValue }),
      },
    });
  }

  private getFieldsToClear(status: JobStatus): Record<string, null> {
    switch (status) {
      case JobStatus.PENDING:
      case JobStatus.GENERATING:
        return { error: null, imageUrl: null, textResult: null, enhancedPrompt: null };
      case JobStatus.COMPLETED:
        return { error: null };
      case JobStatus.FAILED:
        return { imageUrl: null, textResult: null };
      default:
        return {};
    }
  }

  async updateJobId(id: string, jobId: string): Promise<Generation> {
    return this.prisma.generation.update({
      where: { id },
      data: { jobId },
    });
  }
}
