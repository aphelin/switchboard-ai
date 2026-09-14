import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DocumentsRepository } from '../repositories/documents.repository';
import { ChunkingService } from '../services/chunking.service';
import { EmbeddingService } from '../../llm/services/embedding.service';
import { SseService } from '../../sse/services/sse.service';
import { DOCUMENT_INGESTION_QUEUE } from '../../../shared/constants/app.constants';
import { DocumentStatus } from 'generated/prisma/enums';
import type { DocumentIngestionJobData } from '../types/documents.types';

interface DocumentRef {
  id: string;
  userId: string | null;
}

/**
 * Ingestion pipeline: document -> chunks -> embeddings -> pgvector.
 * Runs as a queue job so uploads return immediately and embedding load never
 * blocks the API; progress is pushed to the owner's UI over SSE.
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

    this.logger.log(`Ingesting document ${documentId} ("${document.title}")`);
    await this.setStatus(document, DocumentStatus.PROCESSING);

    try {
      const chunks = await this.chunking.chunk(document.content);
      if (chunks.length === 0) {
        throw new Error('Document has no extractable text');
      }

      // "Contextual" embedding: prefixing the title gives each chunk a hint of
      // what document it belongs to, which helps short or generic passages.
      const embeddings = await this.embedding.embedDocuments(
        chunks.map((chunk) => `${document.title}\n\n${chunk.content}`),
        { traceId: documentId, userId: document.userId ?? undefined },
      );

      await this.repository.replaceChunks(
        documentId,
        chunks.map((chunk, i) => ({ ...chunk, embedding: embeddings[i] })),
      );

      await this.setStatus(document, DocumentStatus.READY, {
        chunkCount: chunks.length,
        error: null,
      });
      this.logger.log(`Document ${documentId} ready (${chunks.length} chunks)`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Ingestion failed for document ${documentId}: ${message}`,
      );
      await this.setStatus(document, DocumentStatus.FAILED, {
        error: message,
      });
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
