import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DocumentsRepository } from '../repositories/documents.repository';
import { ChunkingService } from '../services/chunking.service';
import { EmbeddingService } from '../../llm/services/embedding.service';
import { SseService } from '../../sse/services/sse.service';
import { DOCUMENT_INGESTION_QUEUE } from '../../../shared/constants/app.constants';
import { DocumentStatus } from 'generated/prisma/enums';
import type {
  DocumentIngestionJobData,
  TextChunk,
} from '../types/documents.types';

interface DocumentRef {
  id: string;
  userId: string | null;
}

/**
 * The text that is embedded for a chunk. "Contextual" embedding: the document
 * title and heading path give short or generic passages ("Restart it with the
 * command below") a hint of what they are about. The stored chunk stays clean.
 */
export const embeddingTextFor = (title: string, chunk: TextChunk): string =>
  [title, chunk.section, '', chunk.content]
    .filter((line) => line !== null)
    .join('\n');

/**
 * Ingestion pipeline: document -> chunks -> embeddings -> pgvector.
 * Runs as a queue job so uploads return immediately and embedding load never
 * blocks the API; progress is pushed to the owner's UI over SSE.
 * A failed attempt is retried with backoff (a hosted embedding API can have a
 * bad minute); the document is only marked FAILED after the last attempt.
 */
@Processor(DOCUMENT_INGESTION_QUEUE, { concurrency: 1 })
export class DocumentIngestionProcessor extends WorkerHost {
  private readonly logger = new Logger(DocumentIngestionProcessor.name);

  constructor(
    private readonly repository: DocumentsRepository,
    private readonly chunking: ChunkingService,
    private readonly embedding: EmbeddingService,
    private readonly sseService: SseService,
  ) {
    super();
  }

  async process(job: Job<DocumentIngestionJobData>): Promise<void> {
    const { documentId } = job.data;
    const document = await this.repository.findById(documentId);
    if (!document) {
      this.logger.warn(`Document ${documentId} no longer exists, skipping`);
      return;
    }

    this.logger.log(
      `Ingesting document ${documentId} ("${document.title}"), attempt ${job.attemptsMade + 1}`,
    );
    await this.setStatus(document, DocumentStatus.PROCESSING);

    try {
      const chunks = await this.chunking.chunk(document.content, {
        countTokens: (text) => this.embedding.countTokens(text),
      });
      if (chunks.length === 0) {
        throw new Error('Document has no extractable text');
      }

      const embeddings = await this.embedding.embedDocuments(
        chunks.map((chunk) => embeddingTextFor(document.title, chunk)),
        { traceId: documentId, userId: document.userId ?? undefined },
      );

      await this.repository.replaceChunks(
        documentId,
        chunks.map((chunk, i) => ({ ...chunk, embedding: embeddings[i] })),
        this.embedding.modelName,
      );

      await this.setStatus(document, DocumentStatus.READY, {
        chunkCount: chunks.length,
        error: null,
      });
      this.logger.log(`Document ${documentId} ready (${chunks.length} chunks)`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const attempts = job.opts.attempts ?? 1;
      const finalAttempt = job.attemptsMade + 1 >= attempts;
      this.logger.error(
        `Ingestion attempt ${job.attemptsMade + 1}/${attempts} failed for document ${documentId}: ${message}`,
      );
      // Earlier attempts leave the document PENDING (it will be retried); the last one marks it FAILED.
      await this.setStatus(
        document,
        finalAttempt ? DocumentStatus.FAILED : DocumentStatus.PENDING,
        { error: message },
      );
      throw error;
    }
  }

  private async setStatus(
    document: DocumentRef,
    status: DocumentStatus,
    extra?: { chunkCount?: number; error?: string | null },
  ): Promise<void> {
    const updated = await this.repository.updateStatus(
      document.id,
      status,
      extra,
    );
    // Rows from before auth have no owner yet, so there is nobody to notify.
    if (!document.userId) return;
    this.sseService.emitDocumentUpdate({
      documentId: document.id,
      userId: document.userId,
      status,
      chunkCount: updated.chunkCount,
      error: updated.error ?? undefined,
    });
  }
}
