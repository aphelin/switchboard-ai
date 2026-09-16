import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  MaxFileSizeValidator,
  NotFoundException,
  Param,
  ParseFilePipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ChatService } from '../services/chat.service';
import { ChatAttachmentsService } from '../services/chat-attachments.service';
import { TranscriptionService } from '../services/transcription.service';
import { ChatRequestSchema } from '../dto/chat-request.dto';
import type { ChatRequestDto } from '../dto/chat-request.dto';
import { TranscribeDto } from '../dto/transcribe.dto';
import { ZodValidationPipe } from '../../../shared/pipes/zod-validation.pipe';
import { SkipAllThrottles } from '../../../shared/decorators/skip-all-throttles.decorator';
import { CHAT } from '../../../shared/constants/app.constants';
import { QueryConversationsDto } from '../dto/query-conversations.dto';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthUser } from '../../auth/types/auth.types';
import type { UploadedFileLike } from '../../documents/types/documents.types';

@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly attachments: ChatAttachmentsService,
    private readonly transcription: TranscriptionService,
  ) {}

  /** Streams an AI SDK UI message stream (consumed by `useChat` on the client). */
  @Post()
  @HttpCode(HttpStatus.OK)
  async chat(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(ChatRequestSchema)) dto: ChatRequestDto,
    @Res() res: Response,
  ): Promise<void> {
    // The browser's stop button closes the connection; the abort reaches the model call and its tools.
    const abort = new AbortController();
    res.on('close', () => {
      if (!res.writableFinished) abort.abort();
    });
    await this.chatService.stream(user.id, dto, res, abort.signal);
  }

  /** Turns a recording from the chat microphone into text (Pollinations speech to text, budgeted and traced). */
  @Post('transcribe')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('audio', { limits: { fileSize: CHAT.MAX_AUDIO_BYTES } }),
  )
  transcribe(
    @CurrentUser() user: AuthUser,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: CHAT.MAX_AUDIO_BYTES }),
        ],
        fileIsRequired: true,
      }),
    )
    audio: UploadedFileLike,
    @Body() dto: TranscribeDto,
  ) {
    return this.transcription.transcribe(user.id, audio, dto.conversationId);
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

  /** An image the user attached to a message, served to the conversation's owner (the browser sends the session cookie). */
  @Get('conversations/:id/attachments/:fileId')
  @SkipAllThrottles()
  async attachment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('fileId') fileId: string,
    @Res() res: Response,
  ): Promise<void> {
    await this.chatService.assertOwner(user.id, id);
    const file = await this.attachments.read(id, fileId);
    if (!file) throw new NotFoundException('Attachment not found');
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Length', file.size);
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    file.stream.pipe(res);
  }

  @Delete('conversations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteConversation(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.chatService.deleteConversation(user.id, id);
  }
}
