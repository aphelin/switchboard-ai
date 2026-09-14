import { describe, expect, it, vi } from 'vitest';
import { ModelRouterService } from './model-router.service';
import type { ProviderCredentialsService } from './provider-credentials.service';
import type { ModelRegistryService } from '../../llm/services/model-registry.service';
import {
  ProviderKeyRequiredException,
  UnknownModelException,
} from '../errors/provider.exceptions';
import type { UserKeyRoute } from '../../llm/types/llm.types';

const ALICE = 'user-alice';
const BOB = 'user-bob';
const ALICE_ANTHROPIC_KEY = 'sk-ant-api03-alice-only-key-000000000000';

/** Only Alice has a stored Anthropic key. */
const makeRouter = (options: { enabled?: boolean } = {}) => {
  const credentials = {
    enabled: options.enabled ?? true,
    getApiKey: vi.fn((userId: string, provider: string) =>
      Promise.resolve(
        userId === ALICE && provider === 'anthropic'
          ? ALICE_ANTHROPIC_KEY
          : null,
      ),
    ),
    list: vi.fn((userId: string) =>
      Promise.resolve(
        userId === ALICE
          ? [
              {
                provider: 'anthropic',
                keyHint: ALICE_ANTHROPIC_KEY.slice(-4),
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
  const router = new ModelRouterService(
    credentials as unknown as ProviderCredentialsService,
    registry as unknown as ModelRegistryService,
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
    expect(json).not.toContain(ALICE_ANTHROPIC_KEY);
    expect(json).not.toContain('providerOptions');
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
