import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { DocumentsModule } from '../documents/documents.module';
import { GenerationModule } from '../generation/generation.module';
import { ChatController } from './controllers/chat.controller';
import { ChatService } from './services/chat.service';
import { ChatRepository } from './repositories/chat.repository';

@Module({
  imports: [LlmModule, DocumentsModule, GenerationModule],
  controllers: [ChatController],
  providers: [ChatService, ChatRepository],
  exports: [ChatService],
})
export class ChatModule {}
