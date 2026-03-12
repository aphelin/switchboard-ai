import { Controller, Sse, Param } from '@nestjs/common';
import { Observable } from 'rxjs';
import { SseService } from '../services/sse.service';

@Controller('generations')
export class SseController {
  constructor(private readonly sseService: SseService) {}

  @Sse('sse')
  streamAll(): Observable<MessageEvent> {
    return this.sseService.getEventStream();
  }

  @Sse('sse/:id')
  streamOne(@Param('id') id: string): Observable<MessageEvent> {
    return this.sseService.getEventStreamForGeneration(id);
  }
}
