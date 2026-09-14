import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ChatService } from '../services/chat.service';
import { ChatRequestSchema } from '../dto/chat-request.dto';
import type { ChatRequestDto } from '../dto/chat-request.dto';
import { ZodValidationPipe } from '../../../shared/pipes/zod-validation.pipe';
import { QueryConversationsDto } from '../dto/query-conversations.dto';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /** Streams an AI SDK UI message stream (consumed by `useChat` on the client). */
  @Post()
  @HttpCode(HttpStatus.OK)
  async chat(
    @Body(new ZodValidationPipe(ChatRequestSchema)) dto: ChatRequestDto,
    @Res() res: Response,
  ): Promise<void> {
    await this.chatService.stream(dto, res);
  }

  @Get('conversations')
  listConversations(@Query() query: QueryConversationsDto) {
    return this.chatService.listConversations(query);
  }

  @Get('conversations/:id')
  getConversation(@Param('id') id: string) {
    return this.chatService.getConversation(id);
  }

  @Delete('conversations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteConversation(@Param('id') id: string) {
    return this.chatService.deleteConversation(id);
  }
}
