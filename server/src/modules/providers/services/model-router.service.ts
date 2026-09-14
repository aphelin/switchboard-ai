import { Injectable } from '@nestjs/common';
import { ModelRegistryService } from '../../llm/services/model-registry.service';
import { ProviderCredentialsService } from './provider-credentials.service';
import {
  BYOK_PROVIDER_INFO,
  BYOK_PROVIDERS,
  byokModelsFor,
  catalogModelId,
  findByokModel,
  isByokProvider,
  platformModels,
  type CatalogModel,
} from '../../llm/catalog/model-catalog';
import { PLATFORM_ROUTE, type ModelRoute } from '../../llm/types/llm.types';
import { createUserKeyRoute } from '../utils/user-key-route';
import {
  ProviderKeyRequiredException,
  UnknownModelException,
  UnsupportedModelException,
} from '../errors/provider.exceptions';
import type {
  CatalogModelDto,
  ModelRequirements,
  ProvidersResponse,
} from '../types/providers.types';

/** An explicit allowlist, so fields added to the catalog later are not sent to browsers by accident. */
const toModelDto = (model: CatalogModel): CatalogModelDto => ({
  id: model.id,
  provider: model.provider,
  modelId: model.modelId,
  label: model.label,
  description: model.description,
  tier: model.tier,
  capabilities: model.capabilities,
  pricing: model.pricing ?? null,
});

/**
 * Decides where each request's model calls run. The included (platform) models
 * use the app's provider key and the daily budget; catalog models from OpenAI,
 * Anthropic and Google run on the requesting user's own key.
 */
@Injectable()
export class ModelRouterService {
  constructor(
    private readonly credentials: ProviderCredentialsService,
    private readonly registry: ModelRegistryService,
  ) {}

  get defaultModelId(): string {
    return catalogModelId('platform', this.registry.config.primary.model);
  }

  /** The catalog for the model picker, with which providers this user has connected. */
  async listForUser(userId: string): Promise<ProvidersResponse> {
    const stored = new Map(
      (await this.credentials.list(userId)).map((key) => [key.provider, key]),
    );
    const { config } = this.registry;

    return {
      byokEnabled: this.credentials.enabled,
      defaultModel: this.defaultModelId,
      providers: [
        {
          id: 'platform',
          label: `Included (${config.primary.name})`,
          requiresKey: false,
          connected: true,
          keyHint: null,
          keyUrl: null,
          keyPlaceholder: null,
          updatedAt: null,
          models: platformModels(config).map(toModelDto),
        },
        ...BYOK_PROVIDERS.map((provider) => {
          const info = BYOK_PROVIDER_INFO[provider];
          const key = stored.get(provider);
          return {
            id: provider,
            label: info.label,
            requiresKey: true,
            connected: !!key && this.credentials.enabled,
            keyHint: key?.keyHint ?? null,
            keyUrl: info.keyUrl,
            keyPlaceholder: info.keyPlaceholder,
            updatedAt: key?.updatedAt ?? null,
            models: byokModelsFor(provider).map(toModelDto),
          };
        }),
      ],
    };
  }

  /**
   * Turns the model a request asked for into a route. The browser's choice is
   * never trusted: unknown ids, models without a capability the feature needs
   * and providers the user has no key for are rejected here, before any work is
   * queued or any budget is checked. Keys are looked up for `userId` only.
   */
  async resolve(
    userId: string,
    modelChoice: string | undefined,
    requirements: ModelRequirements = {},
  ): Promise<ModelRoute> {
    if (!modelChoice) return PLATFORM_ROUTE;

    const platformModel = platformModels(this.registry.config).find(
      (model) => model.id === modelChoice,
    );
    const model = platformModel ?? findByokModel(modelChoice);
    if (!model) throw new UnknownModelException(modelChoice);
    if (requirements.tools && !model.capabilities.tools) {
      throw new UnsupportedModelException(model.label, 'tool calling');
    }

    if (platformModel) {
      return platformModel.modelId === this.registry.config.primary.model
        ? PLATFORM_ROUTE
        : { source: 'platform', mainModelId: platformModel.modelId };
    }

    if (!isByokProvider(model.provider)) {
      throw new UnknownModelException(modelChoice);
    }
    const apiKey = await this.credentials.getApiKey(userId, model.provider);
    if (!apiKey) {
      throw new ProviderKeyRequiredException(
        BYOK_PROVIDER_INFO[model.provider].label,
        model.label,
      );
    }
    return createUserKeyRoute(model.provider, apiKey, model);
  }
}
