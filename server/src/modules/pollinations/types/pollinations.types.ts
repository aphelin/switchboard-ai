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

/** Image-to-image: a prompt applied to a source image (POST /v1/images/edits). */
export interface PollinationsImageEditOptions {
  prompt: string;
  model: string;
  image: { data: Buffer; contentType: string };
  width?: number;
  height?: number;
}

/** Speech to text (POST /v1/audio/transcriptions). */
export interface PollinationsTranscriptionOptions {
  data: Buffer;
  /** Pollinations reads the format from the extension: recording.webm, .wav, .mp3, .m4a, .mp4. */
  filename: string;
  contentType: string;
  model: string;
  /** ISO-639-1 hint, e.g. "en". */
  language?: string;
}

export interface PollinationsTranscriptionResult {
  text: string;
  /** Audio length billed by Pollinations; null if the response did not say. */
  seconds: number | null;
}
