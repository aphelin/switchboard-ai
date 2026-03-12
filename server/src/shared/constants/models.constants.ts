export const ImageModel = {
  FLUX: 'flux',
  FLUX_2_DEV: 'flux-2-dev',
  GPTIMAGE: 'gptimage',
  SEEDREAM: 'seedream',
} as const;

export type ImageModel = (typeof ImageModel)[keyof typeof ImageModel];

export const TextModel = {
  OPENAI: 'openai',
  MISTRAL: 'mistral',
  CLAUDE: 'claude',
  LLAMA: 'llama',
} as const;

export type TextModel = (typeof TextModel)[keyof typeof TextModel];
