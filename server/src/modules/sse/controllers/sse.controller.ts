import { Controller, Sse, Param, ParseUUIDPipe } from '@nestjs/common';
import { SkipAllThrottles } from '../../../shared/decorators/skip-all-throttles.decorator';
import { Observable } from 'rxjs';
import { SseService } from '../services/sse.service';
import {
  DOCUMENT_SSE_EVENTS,
  GENERATION_SSE_EVENTS,
} from '../../../shared/constants/app.constants';

@Controller()
@SkipAllThrottles()
export class SseController {
  constructor(private readonly sseService: SseService) {}

  @Sse('generations/sse')
  streamGenerations(): Observable<MessageEvent> {
    return this.sseService.getEventStream(GENERATION_SSE_EVENTS);
  }

  @Sse('generations/sse/:id')
  streamGeneration(
    @Param('id', ParseUUIDPipe) id: string,
  ): Observable<MessageEvent> {
    return this.sseService.getEventStreamForGeneration(id);
  }

  @Sse('documents/sse')
  streamDocuments(): Observable<MessageEvent> {
    return this.sseService.getEventStream(DOCUMENT_SSE_EVENTS);
  }
}
