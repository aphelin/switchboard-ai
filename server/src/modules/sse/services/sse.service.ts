import { Injectable } from '@nestjs/common';
import { Subject, Observable, interval, merge } from 'rxjs';
import { map, filter } from 'rxjs/operators';
import type { StatusUpdateEvent } from '../types/sse.types';
import {
  SSE_EVENTS,
  SSE_HEARTBEAT_INTERVAL_MS,
} from '../../../shared/constants/app.constants';

interface InternalEvent {
  type: string;
  payload: StatusUpdateEvent;
}

@Injectable()
export class SseService {
  private readonly eventSubject = new Subject<InternalEvent>();

  emitStatusUpdate(payload: StatusUpdateEvent): void {
    this.eventSubject.next({ type: SSE_EVENTS.STATUS_UPDATE, payload });
  }

  emitGenerationComplete(payload: StatusUpdateEvent): void {
    this.eventSubject.next({ type: SSE_EVENTS.GENERATION_COMPLETE, payload });
  }

  getEventStream(): Observable<MessageEvent> {
    const events$ = this.eventSubject
      .asObservable()
      .pipe(map((event) => this.toMessageEvent(event)));

    return merge(events$, this.heartbeat());
  }

  getEventStreamForGeneration(generationId: string): Observable<MessageEvent> {
    const events$ = this.eventSubject.asObservable().pipe(
      filter((event) => event.payload.generationId === generationId),
      map((event) => this.toMessageEvent(event)),
    );

    return merge(events$, this.heartbeat());
  }

  private toMessageEvent(event: InternalEvent): MessageEvent {
    return {
      data: JSON.stringify({ type: event.type, ...event.payload }),
    } as MessageEvent;
  }

  private heartbeat(): Observable<MessageEvent> {
    return interval(SSE_HEARTBEAT_INTERVAL_MS).pipe(
      map(() => ({ data: JSON.stringify({ type: 'ping' }) }) as MessageEvent),
    );
  }
}
