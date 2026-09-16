import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { Prisma } from 'generated/prisma/client';
import { DocumentStatus, JobStatus } from 'generated/prisma/enums';
import { PrismaService } from '../../../prisma/prisma.service';
import { DEMO } from '../../../shared/constants/app.constants';
import { createIdRemapper } from '../utils/remap-ids';
import type { AppConfiguration } from '../../../config/configuration.interface';
import type { CopiedCounts } from '../types/demo.types';

/** Enough for a few seconds of lock waits on a busy database; the copy itself takes milliseconds. */
const COPY_TRANSACTION_TIMEOUT_MS = 20_000;

const toJson = (
  value: Prisma.JsonValue | null,
): Prisma.InputJsonValue | undefined =>
  value === null ? undefined : (value as Prisma.InputJsonValue);

/**
 * Gives each new guest a private copy of the template account's finished work:
 * completed generations, indexed documents (chunks and embeddings included),
 * conversations and the LLM calls behind them. The template is a real account
 * filled through the real pipeline (`npm run demo:seed`), so every trace a guest
 * sees was an actual call.
 *
 * Copies get new ids, so guests stay isolated by the same userId filters as
 * everyone else. Image files are shared with the template, not duplicated.
 */
@Injectable()
export class DemoTemplateService {
  private readonly logger = new Logger(DemoTemplateService.name);
  private readonly templateEmail: string | null;

  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService<AppConfiguration, true>,
  ) {
    this.templateEmail = configService.get('demo', {
      infer: true,
    }).templateEmail;
  }

  /** Never throws: a failed copy leaves an empty guest session that still works. */
  async copyInto(guestId: string): Promise<void> {
    if (!this.templateEmail) return;

    const started = Date.now();
    try {
      const template = await this.prisma.user.findUnique({
        where: { email: this.templateEmail },
        select: { id: true, isAnonymous: true },
      });
      if (!template || template.isAnonymous || template.id === guestId) {
        this.logger.warn(
          `Demo template ${this.templateEmail} not found: guest ${guestId} starts empty (run npm run demo:seed)`,
        );
        return;
      }

      const counts = await this.copy(template.id, guestId);
      this.logger.log(
        `Guest ${guestId} received ${counts.generations} generations, ${counts.documents} documents, ${counts.conversations} conversations and ${counts.llmCalls} traces in ${Date.now() - started} ms`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to copy the demo template into guest ${guestId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async copy(
    templateId: string,
    guestId: string,
  ): Promise<CopiedCounts> {
    const limits = DEMO.COPY_LIMITS;
    const [generations, documents, conversations] = await Promise.all([
      this.prisma.generation.findMany({
        where: { userId: templateId, status: JobStatus.COMPLETED },
        orderBy: { createdAt: 'desc' },
        take: limits.generations,
      }),
      this.prisma.document.findMany({
        where: { userId: templateId, status: DocumentStatus.READY },
        orderBy: { createdAt: 'desc' },
        take: limits.documents,
      }),
      this.prisma.conversation.findMany({
        where: { userId: templateId },
        orderBy: { updatedAt: 'desc' },
        take: limits.conversations,
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      }),
    ]);

    const ids = new Map<string, string>();
    for (const row of [...generations, ...documents, ...conversations]) {
      ids.set(row.id, randomUUID());
    }
    if (ids.size === 0) {
      return { generations: 0, documents: 0, conversations: 0, llmCalls: 0 };
    }

    // Only the calls behind the copied rows, so every trace links to something the guest can open.
    const llmCalls = await this.prisma.llmCall.findMany({
      where: { userId: templateId, traceId: { in: [...ids.keys()] } },
      orderBy: { createdAt: 'desc' },
      take: limits.llmCalls,
    });

    // Search results inside copied messages name chunks, so chunk ids are mapped like the rest.
    const chunks = await this.prisma.documentChunk.findMany({
      where: { documentId: { in: documents.map((document) => document.id) } },
      select: { id: true, documentId: true },
    });
    for (const chunk of chunks) ids.set(chunk.id, randomUUID());

    const remap = createIdRemapper(ids);
    const copyOf = (id: string): string => ids.get(id) ?? id;
    // An edit names the image it started from; the copy must name that image's copy, or nothing.
    const remapSource = <T>(parameters: T): T => {
      if (!parameters || typeof parameters !== 'object') return parameters;
      const { sourceGenerationId, ...rest } = parameters as {
        sourceGenerationId?: unknown;
      };
      if (typeof sourceGenerationId !== 'string') return parameters;
      const copied = ids.get(sourceGenerationId);
      return (copied ? { ...rest, sourceGenerationId: copied } : rest) as T;
    };

    await this.prisma.$transaction(
      async (tx) => {
        await tx.generation.createMany({
          data: generations.map((generation) => ({
            id: copyOf(generation.id),
            userId: guestId,
            prompt: generation.prompt,
            enhancedPrompt: generation.enhancedPrompt,
            type: generation.type,
            status: generation.status,
            priority: generation.priority,
            // The URL names the generation, so it must name the copy. `parameters.storageKey`
            // is left as is: the copy serves the template's file.
            imageUrl: remap(generation.imageUrl),
            textResult: generation.textResult,
            error: generation.error,
            parameters: toJson(remapSource(generation.parameters)),
            createdAt: generation.createdAt,
            updatedAt: generation.updatedAt,
          })),
        });

        await tx.document.createMany({
          data: documents.map((document) => ({
            id: copyOf(document.id),
            userId: guestId,
            title: document.title,
            source: document.source,
            mimeType: document.mimeType,
            content: document.content,
            status: document.status,
            chunkCount: document.chunkCount,
            error: document.error,
            metadata: toJson(document.metadata),
            createdAt: document.createdAt,
            updatedAt: document.updatedAt,
          })),
        });
        if (chunks.length > 0) {
          // Chunks and their vectors are copied inside Postgres: re-embedding on every demo sign-in would burn CPU.
          const oldChunkIds = chunks.map((chunk) => chunk.id);
          const newChunkIds = oldChunkIds.map(copyOf);
          const newDocumentIds = chunks.map((chunk) =>
            copyOf(chunk.documentId),
          );
          await tx.$executeRaw`
            INSERT INTO "DocumentChunk" ("id", "documentId", "index", "content", "tokenCount", "embedding", "createdAt")
            SELECT pair.new_id, pair.new_document_id, c."index", c."content", c."tokenCount", c."embedding", c."createdAt"
            FROM "DocumentChunk" c
            JOIN unnest(${oldChunkIds}::text[], ${newChunkIds}::text[], ${newDocumentIds}::text[])
              AS pair(old_id, new_id, new_document_id)
              ON c."id" = pair.old_id`;
        }

        await tx.conversation.createMany({
          data: conversations.map((conversation) => ({
            id: copyOf(conversation.id),
            userId: guestId,
            title: conversation.title,
            createdAt: conversation.createdAt,
            updatedAt: conversation.updatedAt,
          })),
        });
        await tx.message.createMany({
          data: conversations.flatMap((conversation) =>
            conversation.messages.map((message) => ({
              id: randomUUID(),
              conversationId: copyOf(conversation.id),
              role: message.role,
              parts: remap(message.parts) as Prisma.InputJsonValue,
              metadata: toJson(remap(message.metadata)),
              createdAt: message.createdAt,
            })),
          ),
        });

        await tx.llmCall.createMany({
          data: llmCalls.map((call) => ({
            userId: guestId,
            traceId: call.traceId ? copyOf(call.traceId) : null,
            name: call.name,
            provider: call.provider,
            model: call.model,
            inputTokens: call.inputTokens,
            outputTokens: call.outputTokens,
            cachedInputTokens: call.cachedInputTokens,
            costUsd: call.costUsd,
            latencyMs: call.latencyMs,
            status: call.status,
            keySource: call.keySource,
            error: call.error,
            metadata: toJson(remap(call.metadata)),
            // Keeps the original timestamp and marks the row, so it never counts toward the guest's budget.
            copiedFromId: call.id,
            createdAt: call.createdAt,
          })),
        });
      },
      { timeout: COPY_TRANSACTION_TIMEOUT_MS },
    );

    return {
      generations: generations.length,
      documents: documents.length,
      conversations: conversations.length,
      llmCalls: llmCalls.length,
    };
  }
}
