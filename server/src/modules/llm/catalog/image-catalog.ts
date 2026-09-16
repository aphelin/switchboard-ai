import { catalogModelId, type ModelProvider } from './model-catalog';

export interface ImageCatalogModel {
  /** Stable id used by the API and the UI: "<provider>:<model id>". */
  id: string;
  provider: ModelProvider;
  /** The id the provider's API expects. */
  modelId: string;
  label: string;
  description: string;
  /** USD per image at the default size; null when the provider prices by tokens. */
  pricePerImageUsd: number | null;
  /** Other names the provider accepts; older generations store bare ids like "flux". */
  aliases: string[];
  capabilities: {
    /** Takes a source image and a prompt (image-to-image editing). */
    edit: boolean;
  };
}

export const DEFAULT_PLATFORM_IMAGE_MODEL_ID = catalogModelId(
  'platform',
  'flux',
);

/**
 * The app pays for included models and users deposit nothing, so only cheap
 * models with a known per-image price are offered: every image can then be
 * charged to the daily budget. Premium models are available on users' own keys.
 */
export const MAX_INCLUDED_IMAGE_PRICE_USD = 0.01;

const googleImage = (
  modelId: string,
  label: string,
  description: string,
  pricePerImageUsd: number,
): ImageCatalogModel => ({
  id: catalogModelId('google', modelId),
  provider: 'google',
  modelId,
  label,
  description,
  pricePerImageUsd,
  aliases: [],
  capabilities: { edit: true },
});

/**
 * Gemini native image models ("Nano Banana") on the user's own Google key.
 * Prices per 1K image as of 2026-09-14; Gemini has no free tier for images.
 */
export const BYOK_IMAGE_MODELS: ImageCatalogModel[] = [
  googleImage(
    'gemini-3-pro-image',
    'Nano Banana Pro',
    "Google's premium image model for complex scenes and legible text",
    0.134,
  ),
  googleImage(
    'gemini-3.1-flash-image',
    'Nano Banana 2',
    'Versatile, fast Gemini image generation',
    0.067,
  ),
  googleImage(
    'gemini-3.1-flash-lite-image',
    'Nano Banana 2 Lite',
    'Fastest and cheapest Gemini image model',
    0.0336,
  ),
];

const platformImage = (
  modelId: string,
  label: string,
  description: string,
  pricePerImageUsd: number | null,
  aliases: string[],
  edit = false,
): ImageCatalogModel => ({
  id: catalogModelId('platform', modelId),
  provider: 'platform',
  modelId,
  label,
  description,
  pricePerImageUsd,
  aliases,
  capabilities: { edit },
});

/** Used until Pollinations' live model list has loaded, or when it cannot be reached. */
export const FALLBACK_PLATFORM_IMAGE_MODELS: ImageCatalogModel[] = [
  platformImage(
    'flux',
    'FLUX.1 Schnell',
    'Fast, high-quality images at a tiny cost',
    0.002,
    [],
  ),
  platformImage(
    'zimage',
    'Z-Image Turbo',
    'Instant, budget-friendly images',
    0.004,
    ['z-image', 'z-image-turbo'],
  ),
  platformImage(
    'klein',
    'FLUX.2 Klein 4B',
    'Fast image generation and editing up to 2.4 megapixels',
    0.005,
    ['flux-klein'],
    true,
  ),
];

/** One entry of Pollinations' GET /image/models. */
export interface PollinationsModelInfo {
  name: string;
  aliases?: string[];
  category?: string;
  community?: boolean;
  title?: string;
  description?: string;
  input_modalities?: string[];
  output_modalities?: string[];
  pricing?: Record<string, string | number>;
}

/** Pollen ≈ USD. Flat-rate models only charge per image; token-priced ones depend on size and prompt. */
function flatImagePrice(
  pricing: PollinationsModelInfo['pricing'],
): number | null {
  if (!pricing) return null;
  const keys = Object.keys(pricing).filter((key) => key !== 'currency');
  if (keys.length !== 1 || keys[0] !== 'completionImageTokens') return null;
  const price = Number(pricing.completionImageTokens);
  return Number.isFinite(price) ? price : null;
}

/**
 * Official text-to-image models from Pollinations' live list that are cheap
 * enough to include. Left out: community models (third-party proxies that
 * would see users' prompts), video models, token-priced models (the cost of an
 * image isn't known up front, so the budget couldn't cap it) and models above
 * MAX_INCLUDED_IMAGE_PRICE_USD.
 */
export function parsePollinationsImageModels(
  models: PollinationsModelInfo[],
): ImageCatalogModel[] {
  return models
    .filter(
      (model) =>
        !model.community &&
        !model.name.startsWith('community/') &&
        (model.output_modalities ?? [model.category]).includes('image') &&
        (model.input_modalities ?? ['text']).includes('text'),
    )
    .map((model) => {
      // The shortest alias matches the ids stored on older generations ("flux", "zimage").
      const aliases = model.aliases ?? [];
      const modelId =
        [...aliases].sort((a, b) => a.length - b.length)[0] ?? model.name;
      return platformImage(
        modelId,
        model.title || modelId,
        model.description ?? '',
        flatImagePrice(model.pricing),
        [model.name, ...aliases].filter((alias) => alias !== modelId),
        // Models that take an image in also edit one: the same flat price per image.
        (model.input_modalities ?? []).includes('image'),
      );
    })
    .filter(
      (model) =>
        model.pricePerImageUsd !== null &&
        model.pricePerImageUsd <= MAX_INCLUDED_IMAGE_PRICE_USD,
    );
}

/** The first model that can edit an image, for edits that name no model. */
export function findEditModel(
  models: ImageCatalogModel[],
): ImageCatalogModel | undefined {
  return models.find((model) => model.capabilities.edit);
}

/** Finds a model by catalog id, alias, or a bare legacy id (treated as a platform model). */
export function findImageModel(
  models: ImageCatalogModel[],
  choice: string,
): ImageCatalogModel | undefined {
  const separator = choice.indexOf(':');
  const provider = separator === -1 ? 'platform' : choice.slice(0, separator);
  const modelId = separator === -1 ? choice : choice.slice(separator + 1);
  return models.find(
    (model) =>
      model.provider === provider &&
      (model.modelId === modelId || model.aliases.includes(modelId)),
  );
}
