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
