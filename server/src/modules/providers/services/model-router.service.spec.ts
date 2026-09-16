import { describe, expect, it, vi } from 'vitest';
import { ModelRouterService } from './model-router.service';
import type { ProviderCredentialsService } from './provider-credentials.service';
import type { ImageModelCatalogService } from './image-model-catalog.service';
import type { ModelRegistryService } from '../../llm/services/model-registry.service';
import type { PricingService } from '../../llm/services/pricing.service';
import {
  BYOK_IMAGE_MODELS,
  FALLBACK_PLATFORM_IMAGE_MODELS,
  findEditModel,
  findImageModel,
} from '../../llm/catalog/image-catalog';
import {
  ProviderKeyRequiredException,
  UnknownModelException,
} from '../errors/provider.exceptions';
import type {
  UserKeyImageRoute,
  UserKeyRoute,
} from '../../llm/types/llm.types';

const ALICE = 'user-alice';
const BOB = 'user-bob';
const ALICE_KEYS: Record<string, string> = {
  anthropic: 'sk-ant-api03-alice-only-key-000000000000',
  google: 'AIzaSyAliceOnlyGoogleKey0000000000000',
};

/** Only Alice has stored keys (Anthropic and Google). */
const makeRouter = (options: { enabled?: boolean } = {}) => {
  const credentials = {
    enabled: options.enabled ?? true,
    getApiKey: vi.fn((userId: string, provider: string) =>
      Promise.resolve(userId === ALICE ? (ALICE_KEYS[provider] ?? null) : null),
    ),
    list: vi.fn((userId: string) =>
      Promise.resolve(
        userId === ALICE
          ? [
              {
                provider: 'anthropic',
                keyHint: ALICE_KEYS.anthropic.slice(-4),
                updatedAt: new Date('2026-09-14T10:00:00Z'),
              },
            ]
          : [],
      ),
    ),
  };
  const registry = {
    config: {
      primary: {
        name: 'pollinations',
        baseUrl: 'https://example.test/v1',
        apiKey: 'platform-key',
        model: 'openai/gpt-5.4-mini',
      },
      fastModel: 'openai/gpt-5.4-nano',
    },
  };
  const allImageModels = [
    ...FALLBACK_PLATFORM_IMAGE_MODELS,
    ...BYOK_IMAGE_MODELS,
  ];
  const imageCatalog = {
    platform: () => FALLBACK_PLATFORM_IMAGE_MODELS,
    all: () => allImageModels,
    defaultModel: () => FALLBACK_PLATFORM_IMAGE_MODELS[0],
    defaultEditModel: () => findEditModel(FALLBACK_PLATFORM_IMAGE_MODELS),
    find: (choice: string) => findImageModel(allImageModels, choice),
  };
  const pricing = { supportsImageInput: () => true };
  const router = new ModelRouterService(
    credentials as unknown as ProviderCredentialsService,
    registry as unknown as ModelRegistryService,
    imageCatalog as unknown as ImageModelCatalogService,
    pricing as unknown as PricingService,
  );
  return { router, credentials };
};

describe('ModelRouterService.resolve', () => {
  it('uses the platform provider when no model is requested', async () => {
    const { router } = makeRouter();
    await expect(router.resolve(BOB, undefined)).resolves.toEqual({
      source: 'platform',
    });
    await expect(
      router.resolve(BOB, 'platform:openai/gpt-5.4-mini'),
    ).resolves.toEqual({ source: 'platform' });
  });

  it('lets users pick another listed platform model, but not an arbitrary one', async () => {
    const { router } = makeRouter();
    await expect(
      router.resolve(BOB, 'platform:openai/gpt-5.4-nano'),
    ).resolves.toEqual({
      source: 'platform',
      mainModelId: 'openai/gpt-5.4-nano',
    });
    // A raw id would otherwise reach the platform provider on the app's bill.
    await expect(
      router.resolve(BOB, 'platform:openai/o3-pro'),
    ).rejects.toBeInstanceOf(UnknownModelException);
  });

  it('rejects models that are not in the catalog', async () => {
    const { router } = makeRouter();
    await expect(
      router.resolve(ALICE, 'anthropic:claude-9000'),
    ).rejects.toBeInstanceOf(UnknownModelException);
    await expect(
      router.resolve(ALICE, 'claude-sonnet-5'),
    ).rejects.toBeInstanceOf(UnknownModelException);
  });

  it("never uses another user's key", async () => {
    const { router, credentials } = makeRouter();
    await expect(
      router.resolve(BOB, 'anthropic:claude-sonnet-5', { tools: true }),
    ).rejects.toBeInstanceOf(ProviderKeyRequiredException);
    expect(credentials.getApiKey).toHaveBeenCalledWith(BOB, 'anthropic');
  });

  it("routes a key-backed model to the requesting user's own key", async () => {
    const { router, credentials } = makeRouter();
    const route = (await router.resolve(
      ALICE,
      'anthropic:claude-sonnet-5',
    )) as UserKeyRoute;

    expect(credentials.getApiKey).toHaveBeenCalledWith(ALICE, 'anthropic');
    expect(route.source).toBe('user');
    expect(route.provider).toBe('anthropic');
    expect(route.main.modelId).toBe('claude-sonnet-5');
    expect(route.fast.modelId).toBe('claude-haiku-4-5');

    // A real Anthropic SDK model bound to Alice's key (no request is sent).
    const model = route.languageModel(route.main.modelId) as {
      modelId: string;
      provider: string;
    };
    expect(model.modelId).toBe('claude-sonnet-5');
    expect(model.provider).toContain('anthropic');
  });

  it('requires a key for a provider the user has not connected', async () => {
    const { router } = makeRouter();
    await expect(router.resolve(ALICE, 'openai:gpt-5.6-terra')).rejects.toThrow(
      /Add your OpenAI API key/,
    );
  });
});

describe('ModelRouterService.resolveImage', () => {
  it('uses the default included model when none is requested', async () => {
    const { router } = makeRouter();
    const route = await router.resolveImage(BOB, undefined);
    expect(route).toMatchObject({ source: 'platform' });
    expect(route.model.id).toBe('platform:flux');
  });

  it('accepts bare ids stored on older generations', async () => {
    const { router } = makeRouter();
    const route = await router.resolveImage(BOB, 'zimage');
    expect(route.model.id).toBe('platform:zimage');
  });

  it('rejects image models that are not offered', async () => {
    const { router } = makeRouter();
    await expect(router.resolveImage(BOB, 'seedream')).rejects.toBeInstanceOf(
      UnknownModelException,
    );
    await expect(
      router.resolveImage(BOB, 'google:imagen-4'),
    ).rejects.toBeInstanceOf(UnknownModelException);
  });

  it('requires your own Google key for Nano Banana', async () => {
    const { router, credentials } = makeRouter();
    await expect(
      router.resolveImage(BOB, 'google:gemini-3.1-flash-image'),
    ).rejects.toThrow(/Add your Google Gemini API key .* to use Nano Banana 2/);
    expect(credentials.getApiKey).toHaveBeenCalledWith(BOB, 'google');
  });

  it("builds a Gemini image model on the user's key", async () => {
    const { router } = makeRouter();
    const route = (await router.resolveImage(
      ALICE,
      'google:gemini-3-pro-image',
    )) as UserKeyImageRoute;

    expect(route).toMatchObject({ source: 'user', provider: 'google' });
    const model = route.imageModel(route.model.modelId) as {
      modelId: string;
      provider: string;
    };
    expect(model.modelId).toBe('gemini-3-pro-image');
    expect(model.provider).toContain('google');
  });
});

describe('ModelRouterService.listForUser', () => {
  it('shows connection status and the key hint, never the key', async () => {
    const { router } = makeRouter();
    const response = await router.listForUser(ALICE);
    const anthropic = response.providers.find((p) => p.id === 'anthropic');

    expect(response.defaultModel).toBe('platform:openai/gpt-5.4-mini');
    expect(response.providers[0]).toMatchObject({
      id: 'platform',
      connected: true,
      requiresKey: false,
    });
    expect(anthropic).toMatchObject({ connected: true, keyHint: '0000' });
    expect(response.providers.find((p) => p.id === 'openai')?.connected).toBe(
      false,
    );

    const json = JSON.stringify(response);
    expect(json).not.toContain(ALICE_KEYS.anthropic);
    expect(json).not.toContain('providerOptions');
    expect(json).not.toContain('aliases');
  });

  it('lists image models per provider with the default image model', async () => {
    const { router } = makeRouter();
    const response = await router.listForUser(BOB);
    const byId = (id: string) => response.providers.find((p) => p.id === id);

    expect(response.defaultImageModel).toBe('platform:flux');
    expect(byId('platform')?.imageModels.map((m) => m.id)).toContain(
      'platform:flux',
    );
    expect(byId('google')?.imageModels.map((m) => m.label)).toEqual([
      'Nano Banana Pro',
      'Nano Banana 2',
      'Nano Banana 2 Lite',
    ]);
    expect(byId('anthropic')?.imageModels).toEqual([]);
  });

  it('reports stored keys as unusable when bring-your-own-key is disabled', async () => {
    const { router } = makeRouter({ enabled: false });
    const response = await router.listForUser(ALICE);
    expect(response.byokEnabled).toBe(false);
    expect(
      response.providers.find((p) => p.id === 'anthropic')?.connected,
    ).toBe(false);
  });
});
