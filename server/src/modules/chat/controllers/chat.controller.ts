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
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthUser } from '../../auth/types/auth.types';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /** Streams an AI SDK UI message stream (consumed by `useChat` on the client). */
  @Post()
  @HttpCode(HttpStatus.OK)
  async chat(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(ChatRequestSchema)) dto: ChatRequestDto,
    @Res() res: Response,
  ): Promise<void> {
    await this.chatService.stream(user.id, dto, res);
  }

  @Get('conversations')
  listConversations(
    @CurrentUser() user: AuthUser,
    @Query() query: QueryConversationsDto,
  ) {
    return this.chatService.listConversations(user.id, query);
  }

  @Get('conversations/:id')
  getConversation(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.chatService.getConversation(user.id, id);
  }

  @Delete('conversations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteConversation(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.chatService.deleteConversation(user.id, id);
  }
}
