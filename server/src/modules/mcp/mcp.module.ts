import { Module } from '@nestjs/common';
import { GenerationModule } from '../generation/generation.module';
import { DocumentsModule } from '../documents/documents.module';
import { ChatModule } from '../chat/chat.module';
import { LlmModule } from '../llm/llm.module';
import { McpController } from './controllers/mcp.controller';
import { McpService } from './services/mcp.service';

@Module({
  imports: [GenerationModule, DocumentsModule, ChatModule, LlmModule],
  controllers: [McpController],
  providers: [McpService],
})
export class McpModule {}
