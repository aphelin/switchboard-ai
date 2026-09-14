import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { LlmModule } from '../llm/llm.module';
import { DocumentsController } from './controllers/documents.controller';
import { DocumentsService } from './services/documents.service';
import { DocumentParserService } from './services/document-parser.service';
import { ChunkingService } from './services/chunking.service';
import { RetrievalService } from './services/retrieval.service';
import { DocumentsRepository } from './repositories/documents.repository';
import { DocumentIngestionProcessor } from './processors/document-ingestion.processor';
import { DOCUMENT_INGESTION_QUEUE } from '../../shared/constants/app.constants';

@Module({
  imports: [
    BullModule.registerQueue({ name: DOCUMENT_INGESTION_QUEUE }),
    LlmModule,
  ],
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    DocumentParserService,
    ChunkingService,
    RetrievalService,
    DocumentsRepository,
    DocumentIngestionProcessor,
  ],
  exports: [DocumentsService, RetrievalService],
})
export class DocumentsModule {}
