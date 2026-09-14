export interface SseEvent {
  type: string;
  data: Record<string, unknown>;
}

export interface StatusUpdateEvent {
  generationId: string;
  status: string;
  imageUrl?: string;
  textResult?: string;
  error?: string;
  enhancedPrompt?: string;
}

export interface DocumentUpdateEvent {
  documentId: string;
  status: string;
  chunkCount?: number;
  error?: string;
}

export type SseEventPayload = StatusUpdateEvent | DocumentUpdateEvent;

export interface InternalSseEvent {
  type: string;
  payload: SseEventPayload;
}
