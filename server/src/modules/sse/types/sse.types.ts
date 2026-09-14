export interface SseEvent {
  type: string;
  data: Record<string, unknown>;
}

export interface StatusUpdateEvent {
  generationId: string;
  /** Owner of the generation; events are only delivered to this user. */
  userId: string;
  status: string;
  imageUrl?: string;
  textResult?: string;
  error?: string;
  enhancedPrompt?: string;
}

export interface DocumentUpdateEvent {
  documentId: string;
  /** Owner of the document; events are only delivered to this user. */
  userId: string;
  status: string;
  chunkCount?: number;
  error?: string;
}

export type SseEventPayload = StatusUpdateEvent | DocumentUpdateEvent;

export interface InternalSseEvent {
  type: string;
  payload: SseEventPayload;
}
