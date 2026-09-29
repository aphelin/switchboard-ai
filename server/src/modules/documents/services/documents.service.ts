import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DocumentsRepository } from '../repositories/documents.repository';
import {
  DocumentParserService,
  normalizeText,
} from './document-parser.service';
import { CreateDocumentDto } from '../dto/create-document.dto';
import { QueryDocumentsDto } from '../dto/query-documents.dto';
import {
  DOCUMENT_INGESTION_JOB_NAME,
  DOCUMENT_INGESTION_QUEUE,
  JOB_ATTEMPTS,
  JOB_BACKOFF_DELAY,
  RAG,
} from '../../../shared/constants/app.constants';
import { EmbeddingService } from '../../llm/services/embedding.service';
import { DocumentStatus } from 'generated/prisma/enums';
import type {
  DocumentIngestionJobData,
  DocumentSummary,
  UploadedFileLike,
} from '../types/documents.types';
import type { PaginatedResult } from '../../generation/types/generation.types';

/** One ingestion job per document at a time: a double click on "reindex" queues it once. */
export const ingestionJobId = (documentId: string) => `ingest-${documentId}`;

@Injectable()
export class DocumentsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly repository: DocumentsRepository,
    private readonly parser: DocumentParserService,
    private readonly embedding: EmbeddingService,
    @InjectQueue(DOCUMENT_INGESTION_QUEUE)
    private readonly ingestionQueue: Queue<DocumentIngestionJobData>,
  ) {}

  /**
   * Vectors from different embedding models can't be compared, so search only
   * reads chunks from the configured model. After EMBEDDING_MODEL changes, every
   * document indexed with the old one is queued for re-indexing here; until its
   * job finishes it simply doesn't match.
   */
  async onApplicationBootstrap(): Promise<void> {
    const stale = await this.repository.findStaleEmbeddingDocumentIds(
      this.embedding.modelName,
    );
    if (stale.length === 0) return;
    this.logger.warn(
      `${stale.length} document(s) were indexed with another embedding model; re-indexing with ${this.embedding.modelName}`,
    );
    for (const documentId of stale) await this.enqueueIngestion(documentId);
  }

  async create(
    userId: string,
    dto: CreateDocumentDto,
    metadata?: Record<string, unknown>,
  ): Promise<DocumentSummary> {
    const content = normalizeText(dto.content);
    if (!content) throw new BadRequestException('Document content is empty');

    const document = await this.repository.create({
      userId,
      title: dto.title.trim(),
      content,
      mimeType: 'text/plain',
      metadata,
    });
    await this.enqueueIngestion(document.id);
    return document;
  }

  async upload(
    userId: string,
    file: UploadedFileLike,
    title?: string,
  ): Promise<DocumentSummary> {
    if (file.size > RAG.MAX_UPLOAD_BYTES) {
      throw new BadRequestException(
        `File is too large (max ${RAG.MAX_UPLOAD_BYTES / 1024 / 1024} MB)`,
      );
    }

    const parsed = await this.parser.parse(file);
    if (!parsed.text) {
      throw new BadRequestException('No text could be extracted from the file');
    }
    if (parsed.text.length > RAG.MAX_DOCUMENT_CHARS) {
      throw new BadRequestException(
        `Document text is too long (max ${RAG.MAX_DOCUMENT_CHARS} characters)`,
      );
    }

    const document = await this.repository.create({
      userId,
      title: (title?.trim() || file.originalname).slice(0, 200),
      content: parsed.text,
      source: file.originalname,
      mimeType: parsed.mimeType,
    });
    await this.enqueueIngestion(document.id);
    return document;
  }

  findAll(
    userId: string,
    query: QueryDocumentsDto,
  ): Promise<PaginatedResult<DocumentSummary>> {
    return this.repository.findMany({
      userId,
      status: query.status,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  findReady(userId: string): Promise<DocumentSummary[]> {
    return this.repository.findReady(userId);
  }

  /** Another user's document is reported as not found, so ids can't be probed. */
  async findOne(userId: string, id: string) {
    const document = await this.repository.findByIdForUser(id, userId);
    if (!document) throw new NotFoundException(`Document ${id} not found`);
    return document;
  }

  async getChunks(userId: string, id: string) {
    await this.findOne(userId, id);
    return this.repository.findChunks(id);
  }

  async reindex(userId: string, id: string): Promise<DocumentSummary> {
    await this.findOne(userId, id);
    const updated = await this.repository.updateStatus(
      id,
      DocumentStatus.PENDING,
      {
        error: null,
      },
    );
    await this.enqueueIngestion(id);
    return updated;
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.findOne(userId, id);
    await this.repository.delete(id);
    this.logger.log(`Document ${id} deleted`);
  }

  private async enqueueIngestion(documentId: string): Promise<void> {
    const jobId = ingestionJobId(documentId);
    // A finished job keeps its id for a while (removeOnComplete), and BullMQ ignores
    // an add with a known id: clear a finished one so a later reindex still runs.
    // A waiting or running job is left alone, so the document is queued once.
    const existing = await this.ingestionQueue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (state === 'completed' || state === 'failed') {
        await existing.remove();
      } else {
        this.logger.log(`Document ${documentId} is already queued (${state})`);
        return;
      }
    }

    await this.ingestionQueue.add(
      DOCUMENT_INGESTION_JOB_NAME,
      { documentId },
      {
        jobId,
        attempts: JOB_ATTEMPTS,
        backoff: { type: 'exponential', delay: JOB_BACKOFF_DELAY },
        removeOnComplete: { age: 3600, count: 500 },
        removeOnFail: { age: 86400, count: 1000 },
      },
    );
    this.logger.log(`Document ${documentId} queued for ingestion`);
  }
}
