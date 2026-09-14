import type {
  CatalogModel,
  ModelPricingPerMillion,
  ModelProvider,
} from '../../llm/catalog/model-catalog';

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
}

export interface ProvidersResponse {
  /** False when the server has no encryption key, so users cannot add keys. */
  byokEnabled: boolean;
  defaultModel: string;
  providers: ProviderStatus[];
}

export interface ModelRequirements {
  /** The feature runs an agent loop (chat, RAG answers). */
  tools?: boolean;
}
