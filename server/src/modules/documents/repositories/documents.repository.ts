import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma } from 'generated/prisma/client';
import { DocumentStatus } from 'generated/prisma/enums';
import type {
  ChunkRow,
  DocumentSummary,
  TextChunk,
} from '../types/documents.types';
import type { PaginatedResult } from '../../generation/types/generation.types';

const DOCUMENT_SUMMARY_SELECT = {
  id: true,
  title: true,
  source: true,
  mimeType: true,
  status: true,
  chunkCount: true,
  error: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DocumentSelect;

const toVectorLiteral = (vector: number[]): string => `[${vector.join(',')}]`;

/**
 * Builds an OR'ed tsquery ("vaultctl | freeze | command"): a passage that matches
 * some of the terms still ranks (higher with more matches) instead of being
 * dropped by the default AND semantics. Precision is restored by rank fusion.
 */
const toOrTsQuery = (query: string): string =>
  query
    .toLowerCase()
    .split(/[^\p{L}\p{N}_.-]+/u)
    .map((term) => term.replace(/^[.-]+|[.-]+$/g, ''))
    .filter((term) => term.length > 1)
    .map((term) => `'${term.replace(/'/g, "''")}'`)
    .join(' | ');

@Injectable()
export class DocumentsRepository implements OnModuleInit {
  private readonly logger = new Logger(DocumentsRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * pgvector's HNSW index and the full-text GIN index cannot be expressed in the
   * Prisma schema, so they are created here (idempotently) on every start.
   * The vector extension itself is declared in schema.prisma (postgresqlExtensions).
   */
  async onModuleInit(): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      'CREATE EXTENSION IF NOT EXISTS vector',
    );
    await this.prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "DocumentChunk_embedding_hnsw_idx" ON "DocumentChunk" USING hnsw (embedding vector_cosine_ops)',
    );
    await this.prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "DocumentChunk_content_fts_idx" ON "DocumentChunk" USING gin (to_tsvector('english', content))`,
    );
    this.logger.log('Vector and full-text indexes ready');
  }

  async create(data: {
    userId: string;
    title: string;
    content: string;
    source?: string;
    mimeType?: string;
    metadata?: Record<string, unknown>;
  }): Promise<DocumentSummary> {
    return this.prisma.document.create({
      data: {
        ...data,
        metadata: data.metadata as Prisma.InputJsonValue | undefined,
      },
      select: DOCUMENT_SUMMARY_SELECT,
    });
  }

  /** Unscoped lookup for internal use (queue workers). Request handlers use findByIdForUser. */
  findById(id: string) {
    return this.prisma.document.findUnique({ where: { id } });
  }

  findByIdForUser(id: string, userId: string) {
    return this.prisma.document.findFirst({ where: { id, userId } });
  }

  async findMany(params: {
    userId: string;
    status?: DocumentStatus;
    page: number;
    limit: number;
  }): Promise<PaginatedResult<DocumentSummary>> {
    const { userId, status, page, limit } = params;
    const where: Prisma.DocumentWhereInput = {
      userId,
      ...(status && { status }),
    };

    const [data, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        select: DOCUMENT_SUMMARY_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.document.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  findReady(userId: string): Promise<DocumentSummary[]> {
    return this.prisma.document.findMany({
      where: { userId, status: DocumentStatus.READY },
      select: DOCUMENT_SUMMARY_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  updateStatus(
    id: string,
    status: DocumentStatus,
    extra?: { chunkCount?: number; error?: string | null },
  ): Promise<DocumentSummary> {
    return this.prisma.document.update({
      where: { id },
      data: { status, ...extra },
      select: DOCUMENT_SUMMARY_SELECT,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.document.delete({ where: { id } });
  }

  findChunks(documentId: string) {
    return this.prisma.documentChunk.findMany({
      where: { documentId },
      orderBy: { index: 'asc' },
      select: {
        id: true,
        index: true,
        content: true,
        tokenCount: true,
        section: true,
      },
    });
  }

  /**
   * Replaces a document's chunks atomically: re-indexing never leaves a
   * half-indexed document, and the old chunks stay searchable until the swap.
   */
  async replaceChunks(
    documentId: string,
    chunks: Array<TextChunk & { embedding: number[] }>,
    embeddingModel: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.documentChunk.deleteMany({ where: { documentId } });
      if (chunks.length === 0) return;

      const values = chunks.map(
        (chunk) =>
          Prisma.sql`(${randomUUID()}, ${documentId}, ${chunk.index}, ${chunk.content}, ${chunk.tokenCount}, ${chunk.section}, ${toVectorLiteral(chunk.embedding)}::vector, ${embeddingModel})`,
      );
      await tx.$executeRaw(
        Prisma.sql`INSERT INTO "DocumentChunk" ("id", "documentId", "index", "content", "tokenCount", "section", "embedding", "embeddingModel") VALUES ${Prisma.join(values)}`,
      );
    });
  }

  /**
   * Nearest neighbours by cosine similarity (score = 1 - cosine distance).
   *
   * The owner filter is part of the query, and the HNSW scan is iterative: a
   * plain HNSW scan returns about `ef_search` (40) nearest chunks across all
   * users and only then applies the WHERE clause, so a user with few documents
   * in a large table would get fewer than `limit` results, or none. With
   * `iterative_scan` (pgvector 0.8+) the index keeps scanning until the filtered
   * result is full. Only vectors from the configured embedding model are
   * compared: a vector from another model lives in a different space.
   */
  vectorSearch(params: {
    userId: string;
    embedding: number[];
    embeddingModel: string;
    limit: number;
    documentIds?: string[];
  }): Promise<ChunkRow[]> {
    const vector = toVectorLiteral(params.embedding);
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        'SET LOCAL hnsw.iterative_scan = strict_order',
      );
      return tx.$queryRaw<ChunkRow[]>(Prisma.sql`
        SELECT c.id, c."documentId", d.title AS "documentTitle", c.index, c.content, c."tokenCount", c.section,
               1 - (c.embedding <=> ${vector}::vector) AS score
        FROM "DocumentChunk" c
        JOIN "Document" d ON d.id = c."documentId"
        WHERE d."userId" = ${params.userId}
          AND c."embeddingModel" = ${params.embeddingModel}
          AND c.embedding IS NOT NULL
          ${this.documentFilter(params.documentIds)}
        ORDER BY c.embedding <=> ${vector}::vector
        LIMIT ${params.limit}
      `);
    });
  }

  /**
   * Postgres full-text search (BM25-like ranking via ts_rank_cd), scoped to the owner.
   * Searches the same chunk set as vectorSearch, so fusion never mixes a document's
   * current chunks with ones from an index built by another embedding model.
   */
  keywordSearch(params: {
    userId: string;
    query: string;
    embeddingModel: string;
    limit: number;
    documentIds?: string[];
  }): Promise<ChunkRow[]> {
    const tsQuery = toOrTsQuery(params.query);
    if (!tsQuery) return Promise.resolve([]);

    return this.prisma.$queryRaw<ChunkRow[]>(Prisma.sql`
      SELECT c.id, c."documentId", d.title AS "documentTitle", c.index, c.content, c."tokenCount", c.section,
             ts_rank_cd(to_tsvector('english', c.content), to_tsquery('english', ${tsQuery})) AS score
      FROM "DocumentChunk" c
      JOIN "Document" d ON d.id = c."documentId"
      WHERE d."userId" = ${params.userId}
        AND c."embeddingModel" = ${params.embeddingModel}
        AND to_tsvector('english', c.content) @@ to_tsquery('english', ${tsQuery})
        ${this.documentFilter(params.documentIds)}
      ORDER BY score DESC
      LIMIT ${params.limit}
    `);
  }

  /** Documents whose chunks were embedded by a different model than the configured one (they need re-indexing). */
  async findStaleEmbeddingDocumentIds(
    embeddingModel: string,
  ): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT DISTINCT c."documentId" AS id
      FROM "DocumentChunk" c
      WHERE c."embeddingModel" IS DISTINCT FROM ${embeddingModel}
    `);
    return rows.map((row) => row.id);
  }

  private documentFilter(documentIds?: string[]): Prisma.Sql {
    return documentIds && documentIds.length > 0
      ? Prisma.sql`AND c."documentId" IN (${Prisma.join(documentIds)})`
      : Prisma.empty;
  }
}
