import type {
  CatalogModel,
  ModelPricingPerMillion,
  ModelProvider,
} from '../../llm/catalog/model-catalog';
import type { ImageCatalogModel } from '../../llm/catalog/image-catalog';

export interface StoredProviderKey {
  provider: string;
  keyHint: string;
  updatedAt: Date;
}

export interface SavedProviderKey extends StoredProviderKey {
  /** Set when the key works but the provider is rate limiting it. */
  warning: string | null;
}

/** What the model picker needs; provider-specific request options stay on the server. */
export type CatalogModelDto = Omit<
  CatalogModel,
  'providerOptions' | 'pricing'
> & {
  pricing: ModelPricingPerMillion | null;
};

export type CatalogImageModelDto = Omit<ImageCatalogModel, 'aliases'>;

export interface ProviderStatus {
  id: ModelProvider;
  label: string;
  requiresKey: boolean;
  /** Platform: always true. Others: the user has a stored, usable key. */
  connected: boolean;
  keyHint: string | null;
  keyUrl: string | null;
  keyPlaceholder: string | null;
  updatedAt: Date | null;
  models: CatalogModelDto[];
  imageModels: CatalogImageModelDto[];
}

export interface ProvidersResponse {
  /** False when users cannot add keys: see byokDisabledReason. */
  byokEnabled: boolean;
  /** "server": no encryption key is configured; "guest": demo sessions never store keys. */
  byokDisabledReason: 'server' | 'guest' | null;
  defaultModel: string;
  defaultImageModel: string;
  providers: ProviderStatus[];
}

export interface ModelRequirements {
  /** The feature runs an agent loop (chat, RAG answers). */
  tools?: boolean;
}

export interface ImageModelRequirements {
  /** The request edits an existing image, so the model must take one in. */
  edit?: boolean;
}
