import { describe, expect, it } from 'vitest';
import {
  BYOK_IMAGE_MODELS,
  DEFAULT_PLATFORM_IMAGE_MODEL_ID,
  FALLBACK_PLATFORM_IMAGE_MODELS,
  MAX_INCLUDED_IMAGE_PRICE_USD,
  findImageModel,
  parsePollinationsImageModels,
  type PollinationsModelInfo,
} from './image-catalog';

const LIVE_LIST: PollinationsModelInfo[] = [
  {
    name: 'black-forest-labs/flux.1-schnell',
    aliases: ['flux'],
    category: 'image',
    title: 'FLUX.1 Schnell',
    description: 'Fast, high-quality images at a tiny cost',
    input_modalities: ['text'],
    output_modalities: ['image'],
    pricing: { currency: 'pollen', completionImageTokens: '0.002' },
  },
  {
    name: 'tongyi-mai/z-image-turbo',
    aliases: ['z-image', 'z-image-turbo', 'zimage'],
    category: 'image',
    title: 'Z-Image Turbo',
    input_modalities: ['text'],
    output_modalities: ['image'],
    pricing: { currency: 'pollen', completionImageTokens: '0.004' },
  },
  {
    name: 'openai/gpt-image-2',
    aliases: ['gpt-image-2'],
    category: 'image',
    title: 'GPT Image 2',
    input_modalities: ['text', 'image'],
    output_modalities: ['image'],
    pricing: {
      currency: 'pollen',
      promptTextTokens: '0.00000375',
      completionImageTokens: '0.0000225',
    },
  },
  {
    name: 'amazon/nova-canvas-v1',
    aliases: ['nova-canvas'],
    category: 'image',
    title: 'Nova Canvas',
    input_modalities: ['text', 'image'],
    output_modalities: ['image'],
    pricing: { currency: 'pollen', completionImageTokens: '0.04' },
  },
  {
    name: 'amazon/nova-reel-v1',
    aliases: ['nova-reel'],
    category: 'video',
    input_modalities: ['text', 'image'],
    output_modalities: ['video'],
  },
  {
    name: 'community/vendouple/nano-banana-pro',
    category: 'image',
    community: false,
    output_modalities: ['image'],
    pricing: { currency: 'pollen', completionImageTokens: '0.001' },
  },
];

describe('parsePollinationsImageModels', () => {
  const models = parsePollinationsImageModels(LIVE_LIST);

  it('keeps only cheap, per-image priced, official image models', () => {
    // Left out: GPT Image 2 (token-priced), Nova Canvas ($0.04), the video model and the community proxy.
    expect(models.map((model) => model.id)).toEqual([
      'platform:flux',
      'platform:zimage',
    ]);
    for (const model of models) {
      expect(model.pricePerImageUsd).not.toBeNull();
      expect(model.pricePerImageUsd).toBeLessThanOrEqual(
        MAX_INCLUDED_IMAGE_PRICE_USD,
      );
    }
  });

  it('uses the shortest alias as the model id and keeps the rest as aliases', () => {
    const zimage = models.find((model) => model.modelId === 'zimage');
    expect(zimage?.aliases).toEqual(
      expect.arrayContaining([
        'z-image',
        'z-image-turbo',
        'tongyi-mai/z-image-turbo',
      ]),
    );
  });

  it('reads the per-image price', () => {
    expect(models.find((m) => m.modelId === 'flux')?.pricePerImageUsd).toBe(
      0.002,
    );
  });
});

describe('findImageModel', () => {
  const catalog = [
    ...parsePollinationsImageModels(LIVE_LIST),
    ...BYOK_IMAGE_MODELS,
  ];

  it('finds models by catalog id, alias and legacy bare id', () => {
    expect(findImageModel(catalog, 'platform:flux')?.modelId).toBe('flux');
    expect(findImageModel(catalog, 'platform:z-image-turbo')?.modelId).toBe(
      'zimage',
    );
    expect(findImageModel(catalog, 'zimage')?.id).toBe('platform:zimage');
    expect(
      findImageModel(catalog, 'google:gemini-3.1-flash-image')?.label,
    ).toBe('Nano Banana 2');
  });

  it('does not match hidden, unknown or wrong-provider models', () => {
    expect(findImageModel(catalog, 'google:flux')).toBeUndefined();
    expect(findImageModel(catalog, 'seedream')).toBeUndefined();
    expect(findImageModel(catalog, 'gpt-image-2')).toBeUndefined();
    expect(findImageModel(catalog, 'platform:nova-canvas')).toBeUndefined();
  });
});

describe('image catalog defaults', () => {
  it('has the default model in the fallback list, all cheap and priced', () => {
    expect(
      findImageModel(
        FALLBACK_PLATFORM_IMAGE_MODELS,
        DEFAULT_PLATFORM_IMAGE_MODEL_ID,
      ),
    ).toBeDefined();
    for (const model of FALLBACK_PLATFORM_IMAGE_MODELS) {
      expect(model.pricePerImageUsd).toBeLessThanOrEqual(
        MAX_INCLUDED_IMAGE_PRICE_USD,
      );
    }
  });

  it('prices every Nano Banana model and marks them editable', () => {
    expect(BYOK_IMAGE_MODELS).toHaveLength(3);
    for (const model of BYOK_IMAGE_MODELS) {
      expect(model.pricePerImageUsd).toBeGreaterThan(0);
      expect(model.capabilities.edit).toBe(true);
    }
  });
});
