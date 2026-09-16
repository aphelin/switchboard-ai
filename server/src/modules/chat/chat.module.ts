import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { DocumentsModule } from '../documents/documents.module';
import { GenerationModule } from '../generation/generation.module';
import { ProvidersModule } from '../providers/providers.module';
import { PollinationsModule } from '../pollinations/pollinations.module';
import { ObservabilityModule } from '../observability/observability.module';
import { ChatController } from './controllers/chat.controller';
import { ChatService } from './services/chat.service';
import { ChatAttachmentsService } from './services/chat-attachments.service';
import { TranscriptionService } from './services/transcription.service';
import { ChatRepository } from './repositories/chat.repository';

@Module({
  imports: [
    LlmModule,
    DocumentsModule,
    GenerationModule,
    ProvidersModule,
    PollinationsModule,
    ObservabilityModule,
  ],
  controllers: [ChatController],
  providers: [
    ChatService,
    ChatAttachmentsService,
    TranscriptionService,
    ChatRepository,
  ],
  exports: [ChatService],
})
export class ChatModule {}
