import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
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
  RAG,
} from '../../../shared/constants/app.constants';
import { DocumentStatus } from 'generated/prisma/enums';
import type {
  DocumentIngestionJobData,
  DocumentSummary,
  UploadedFileLike,
} from '../types/documents.types';
import type { PaginatedResult } from '../../generation/types/generation.types';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly repository: DocumentsRepository,
    private readonly parser: DocumentParserService,
    @InjectQueue(DOCUMENT_INGESTION_QUEUE)
    private readonly ingestionQueue: Queue<DocumentIngestionJobData>,
  ) {}

  async create(
    dto: CreateDocumentDto,
    metadata?: Record<string, unknown>,
  ): Promise<DocumentSummary> {
    const content = normalizeText(dto.content);
    if (!content) throw new BadRequestException('Document content is empty');

    const document = await this.repository.create({
      title: dto.title.trim(),
      content,
      mimeType: 'text/plain',
      metadata,
    });
    await this.enqueueIngestion(document.id);
    return document;
  }

  async upload(
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
      title: (title?.trim() || file.originalname).slice(0, 200),
      content: parsed.text,
      source: file.originalname,
      mimeType: parsed.mimeType,
    });
    await this.enqueueIngestion(document.id);
    return document;
  }

  findAll(query: QueryDocumentsDto): Promise<PaginatedResult<DocumentSummary>> {
    return this.repository.findMany({
      status: query.status,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  findReady(): Promise<DocumentSummary[]> {
    return this.repository.findReady();
  }

  async findOne(id: string) {
    const document = await this.repository.findById(id);
    if (!document) throw new NotFoundException(`Document ${id} not found`);
    return document;
  }

  async getChunks(id: string) {
    await this.findOne(id);
    return this.repository.findChunks(id);
  }

  async reindex(id: string): Promise<DocumentSummary> {
    await this.findOne(id);
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

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.repository.delete(id);
    this.logger.log(`Document ${id} deleted`);
  }

  private async enqueueIngestion(documentId: string): Promise<void> {
    await this.ingestionQueue.add(
      DOCUMENT_INGESTION_JOB_NAME,
      { documentId },
      {
        jobId: randomUUID(),
        attempts: 1,
        removeOnComplete: { age: 3600, count: 500 },
        removeOnFail: { age: 86400, count: 1000 },
      },
    );
    this.logger.log(`Document ${documentId} queued for ingestion`);
  }
}
