export const ImageModel = {
  FLUX: 'flux',
  FLUX_2_DEV: 'flux-2-dev',
  GPTIMAGE: 'gptimage',
  SEEDREAM: 'seedream',
  IMAGEN_4: 'imagen-4',
  GROK_IMAGINE: 'grok-imagine',
  ZIMAGE: 'zimage',
  DIRTBERRY: 'dirtberry',
} as const;

export type ImageModel = (typeof ImageModel)[keyof typeof ImageModel];
