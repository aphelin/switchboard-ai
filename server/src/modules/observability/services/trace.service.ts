import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma } from 'generated/prisma/client';

export interface RecordLlmCallInput {
  name: string;
  traceId?: string;
  /** Who the call was made for; drives per-user cost views and the daily budget. */
  userId?: string;
  provider: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
  costUsd?: number | null;
  latencyMs: number;
  status: 'ok' | 'error';
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface TraceListParams {
  userId: string;
  traceId?: string;
  name?: string;
  page: number;
  limit: number;
}

/**
 * Minimal LLM observability: every model call is persisted with tokens, cost,
 * latency and outcome, grouped by a trace id (conversation, generation, eval run).
 * A hosted tracer (Langfuse, LangSmith) could be plugged in next to this.
 */
@Injectable()
export class TraceService {
  private readonly logger = new Logger(TraceService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Never throws: observability must not break the request it observes. */
  async record(input: RecordLlmCallInput): Promise<void> {
    try {
      await this.prisma.llmCall.create({
        data: {
          ...input,
          costUsd: input.costUsd ?? null,
          error: input.error?.slice(0, 2000),
          metadata: input.metadata as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to record LLM call "${input.name}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async list(params: TraceListParams) {
    const { userId, traceId, name, page, limit } = params;
    const where: Prisma.LlmCallWhereInput = { userId };
    if (traceId) where.traceId = traceId;
    if (name) where.name = name;

    const [data, total] = await Promise.all([
      this.prisma.llmCall.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.llmCall.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async summary(userId: string) {
    const where: Prisma.LlmCallWhereInput = { userId };
    const [totals, errors, byModel, byName] = await Promise.all([
      this.prisma.llmCall.aggregate({
        where,
        _count: { _all: true },
        _sum: { inputTokens: true, outputTokens: true, costUsd: true },
        _avg: { latencyMs: true },
      }),
      this.prisma.llmCall.count({ where: { ...where, status: 'error' } }),
      this.prisma.llmCall.groupBy({
        by: ['provider', 'model'],
        where,
        _count: { _all: true },
        _sum: { inputTokens: true, outputTokens: true, costUsd: true },
        _avg: { latencyMs: true },
        orderBy: { _count: { model: 'desc' } },
      }),
      this.prisma.llmCall.groupBy({
        by: ['name'],
        where,
        _count: { _all: true },
        _sum: { costUsd: true },
        _avg: { latencyMs: true },
        orderBy: { _count: { name: 'desc' } },
      }),
    ]);

    return {
      totals: {
        calls: totals._count._all,
        errors,
        inputTokens: totals._sum.inputTokens ?? 0,
        outputTokens: totals._sum.outputTokens ?? 0,
        costUsd: totals._sum.costUsd ?? 0,
        avgLatencyMs: Math.round(totals._avg.latencyMs ?? 0),
      },
      byModel: byModel.map((row) => ({
        provider: row.provider,
        model: row.model,
        calls: row._count._all,
        inputTokens: row._sum.inputTokens ?? 0,
        outputTokens: row._sum.outputTokens ?? 0,
        costUsd: row._sum.costUsd ?? 0,
        avgLatencyMs: Math.round(row._avg.latencyMs ?? 0),
      })),
      byName: byName.map((row) => ({
        name: row.name,
        calls: row._count._all,
        costUsd: row._sum.costUsd ?? 0,
        avgLatencyMs: Math.round(row._avg.latencyMs ?? 0),
      })),
    };
  }
}
