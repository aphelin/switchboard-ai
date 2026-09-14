export interface PollinationsImageOptions {
  prompt: string;
  model?: string;
  width?: number;
  height?: number;
  seed?: number;
  negativePrompt?: string;
}

export interface PollinationsImageResult {
  /** Raw image bytes; stored by the caller and served from our own API. */
  data: Buffer;
  contentType: string;
}
