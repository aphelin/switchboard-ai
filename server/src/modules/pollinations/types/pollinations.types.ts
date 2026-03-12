export interface PollinationsImageOptions {
  prompt: string;
  model?: string;
  width?: number;
  height?: number;
  seed?: number;
  enhance?: boolean;
  negativePrompt?: string;
}

export interface PollinationsTextOptions {
  prompt: string;
  model?: string;
  temperature?: number;
  systemPrompt?: string;
}

export interface ChatMessage {
  role: string;
  content: string;
}

export interface PollinationsTextResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface PollinationsImageResult {
  imageUrl: string;
}

export interface PollinationsTextResult {
  text: string;
}
