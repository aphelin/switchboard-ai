import { Controller, Sse, Param, ParseUUIDPipe } from '@nestjs/common';
import { SkipAllThrottles } from '../../../shared/decorators/skip-all-throttles.decorator';
import { Observable } from 'rxjs';
import { SseService } from '../services/sse.service';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthUser } from '../../auth/types/auth.types';
import {
  DOCUMENT_SSE_EVENTS,
  GENERATION_SSE_EVENTS,
} from '../../../shared/constants/app.constants';

/** EventSource sends the session cookie (withCredentials), so streams are per user. */
@Controller()
@SkipAllThrottles()
export class SseController {
  constructor(private readonly sseService: SseService) {}

  @Sse('generations/sse')
  streamGenerations(@CurrentUser() user: AuthUser): Observable<MessageEvent> {
    return this.sseService.getEventStream(user.id, GENERATION_SSE_EVENTS);
  }

  @Sse('generations/sse/:id')
  streamGeneration(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Observable<MessageEvent> {
    return this.sseService.getEventStreamForGeneration(user.id, id);
  }

  @Sse('documents/sse')
  streamDocuments(@CurrentUser() user: AuthUser): Observable<MessageEvent> {
    return this.sseService.getEventStream(user.id, DOCUMENT_SSE_EVENTS);
  }
}
