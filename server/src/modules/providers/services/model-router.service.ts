import { Injectable } from '@nestjs/common';
import { ModelRegistryService } from '../../llm/services/model-registry.service';
import { PricingService } from '../../llm/services/pricing.service';
import { ProviderCredentialsService } from './provider-credentials.service';
import { ImageModelCatalogService } from './image-model-catalog.service';
import type { ImageCatalogModel } from '../../llm/catalog/image-catalog';
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
import {
  PLATFORM_ROUTE,
  type ImageRoute,
  type ModelRoute,
} from '../../llm/types/llm.types';
import {
  createUserKeyImageRoute,
  createUserKeyRoute,
} from '../utils/user-key-route';
import {
  ProviderKeyRequiredException,
  UnknownModelException,
  UnsupportedModelException,
} from '../errors/provider.exceptions';
import type {
  CatalogImageModelDto,
  CatalogModelDto,
  ImageModelRequirements,
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

const toImageModelDto = (model: ImageCatalogModel): CatalogImageModelDto => ({
  id: model.id,
  provider: model.provider,
  modelId: model.modelId,
  label: model.label,
  description: model.description,
  pricePerImageUsd: model.pricePerImageUsd,
  capabilities: model.capabilities,
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
    private readonly imageCatalog: ImageModelCatalogService,
    private readonly pricing: PricingService,
  ) {}

  get defaultModelId(): string {
    return catalogModelId('platform', this.registry.config.primary.model);
  }

  /** The included text models, with vision read from the provider's live list. */
  private platformModels(): CatalogModel[] {
    return platformModels(this.registry.config, (modelId) =>
      this.pricing.supportsImageInput(modelId),
    );
  }

  /** The catalog for the model picker, with which providers this user has connected. */
  async listForUser(userId: string): Promise<ProvidersResponse> {
    const stored = new Map(
      (await this.credentials.list(userId)).map((key) => [key.provider, key]),
    );
    const { config } = this.registry;

    const imageModels = this.imageCatalog.all();

    return {
      byokEnabled: this.credentials.enabled,
      byokDisabledReason: this.credentials.enabled ? null : 'server',
      defaultModel: this.defaultModelId,
      defaultImageModel: this.imageCatalog.defaultModel().id,
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
          models: this.platformModels().map(toModelDto),
          imageModels: this.imageCatalog.platform().map(toImageModelDto),
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
            imageModels: imageModels
              .filter((model) => model.provider === provider)
              .map(toImageModelDto),
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

    const platformModel = this.platformModels().find(
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

  /**
   * Same rules for image models: only catalog models (Pollinations' live list
   * or Gemini on the user's key), and key-backed models need the user's own key.
   * Bare ids stored on older generations ("flux") resolve to included models.
   */
  async resolveImage(
    userId: string,
    modelChoice: string | undefined,
    requirements: ImageModelRequirements = {},
  ): Promise<ImageRoute> {
    const model = modelChoice
      ? this.imageCatalog.find(modelChoice)
      : requirements.edit
        ? this.imageCatalog.defaultEditModel()
        : this.imageCatalog.defaultModel();
    if (!model) throw new UnknownModelException(modelChoice ?? '');
    if (requirements.edit && !model.capabilities.edit) {
      throw new UnsupportedModelException(model.label, 'image editing');
    }

    if (model.provider === 'platform') return { source: 'platform', model };
    if (!isByokProvider(model.provider)) {
      throw new UnknownModelException(model.id);
    }

    const apiKey = await this.credentials.getApiKey(userId, model.provider);
    if (!apiKey) {
      throw new ProviderKeyRequiredException(
        BYOK_PROVIDER_INFO[model.provider].label,
        model.label,
      );
    }
    return createUserKeyImageRoute(model.provider, apiKey, model);
  }
}
