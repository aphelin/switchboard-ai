import { Injectable } from '@nestjs/common';
import { Subject, Observable, interval, merge } from 'rxjs';
import { map, filter } from 'rxjs/operators';
import type {
  DocumentUpdateEvent,
  InternalSseEvent,
  SseEventPayload,
  StatusUpdateEvent,
} from '../types/sse.types';
import {
  SSE_EVENTS,
  SSE_HEARTBEAT_INTERVAL_MS,
} from '../../../shared/constants/app.constants';

@Injectable()
export class SseService {
  private readonly eventSubject = new Subject<InternalSseEvent>();

  /** Raw in-process event bus; also used by services that wait for a job to finish. */
  get events$(): Observable<InternalSseEvent> {
    return this.eventSubject.asObservable();
  }

  emitStatusUpdate(payload: StatusUpdateEvent): void {
    this.eventSubject.next({ type: SSE_EVENTS.STATUS_UPDATE, payload });
  }

  emitGenerationComplete(payload: StatusUpdateEvent): void {
    this.eventSubject.next({ type: SSE_EVENTS.GENERATION_COMPLETE, payload });
  }

  emitDocumentUpdate(payload: DocumentUpdateEvent): void {
    this.eventSubject.next({ type: SSE_EVENTS.DOCUMENT_UPDATE, payload });
  }

  /** The user's own events, optionally restricted to the given event types. */
  getEventStream(
    userId: string,
    types?: readonly string[],
  ): Observable<MessageEvent> {
    const events$ = this.eventSubject.asObservable().pipe(
      filter(
        (event) =>
          event.payload.userId === userId &&
          (!types || types.includes(event.type)),
      ),
      map((event) => this.toMessageEvent(event)),
    );

    return merge(events$, this.heartbeat());
  }

  getEventStreamForGeneration(
    userId: string,
    generationId: string,
  ): Observable<MessageEvent> {
    const events$ = this.eventSubject.asObservable().pipe(
      filter(
        (event) =>
          event.payload.userId === userId &&
          'generationId' in event.payload &&
          event.payload.generationId === generationId,
      ),
      map((event) => this.toMessageEvent(event)),
    );

    return merge(events$, this.heartbeat());
  }

  private toMessageEvent(event: InternalSseEvent): MessageEvent {
    // The owner id is only used for routing; it is not sent to the browser.
    const payload: Partial<SseEventPayload> = { ...event.payload };
    delete payload.userId;
    return {
      data: JSON.stringify({ type: event.type, ...payload }),
    } as MessageEvent;
  }

  private heartbeat(): Observable<MessageEvent> {
    return interval(SSE_HEARTBEAT_INTERVAL_MS).pipe(
      map(() => ({ data: JSON.stringify({ type: 'ping' }) }) as MessageEvent),
    );
  }
}
