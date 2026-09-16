"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getProviders } from "@/lib/api";
import { onProviderDialogRequest } from "@/lib/model-events";
import type {
  CatalogImageModel,
  CatalogModel,
  ProviderId,
  ProviderStatus,
  ProvidersResponse,
} from "@/lib/types";
import { ProviderKeysDialog } from "@/components/models/provider-keys-dialog";

const STORAGE_KEY = "mat.selectedModel";
const IMAGE_STORAGE_KEY = "mat.selectedImageModel";

interface ResolveOptions {
  /** Only accept models that support tool calling (the chat agent needs it). */
  requireTools?: boolean;
}

interface ModelsContextValue {
  providers: ProviderStatus[];
  loading: boolean;
  byokEnabled: boolean;
  byokDisabledReason: ProvidersResponse["byokDisabledReason"];
  /** Server default catalog model id; null until providers have loaded. */
  defaultModel: string | null;
  refresh: () => Promise<void>;
  modelById: (id: string | null | undefined) => CatalogModel | undefined;
  /** Whether a model can be used right now (its provider is connected). */
  isModelUsable: (model: CatalogModel, options?: ResolveOptions) => boolean;
  /**
   * `id` when usable, otherwise the default model, otherwise the first usable
   * model; null when nothing is usable (or providers have not loaded).
   */
  resolveModel: (id: string | null | undefined, options?: ResolveOptions) => string | null;
  /** The user's model choice, already validated against the catalog. */
  selectedModel: string | null;
  setSelectedModel: (id: string) => void;
  /** Server default image catalog model id; null until providers have loaded. */
  defaultImageModel: string | null;
  /**
   * Image model by catalog id. A legacy bare id (e.g. `flux`, stored on older
   * generations) resolves to the platform model of the same name.
   */
  imageModelById: (id: string | null | undefined) => CatalogImageModel | undefined;
  /** Whether an image model can be used right now (its provider is connected). */
  isImageModelUsable: (model: CatalogImageModel) => boolean;
  /** The user's image model choice, already validated against the catalog. */
  selectedImageModel: string | null;
  setSelectedImageModel: (id: string) => void;
  openProviderDialog: (provider?: ProviderId) => void;
}

const ModelsContext = createContext<ModelsContextValue | null>(null);

function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, id: string): void {
  try {
    window.localStorage.setItem(key, id);
  } catch {
    // storage unavailable (private mode, quota): the choice lasts for this session
  }
}

export function ModelsProvider({ children }: { children: ReactNode }) {
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [byokEnabled, setByokEnabled] = useState(false);
  const [byokDisabledReason, setByokDisabledReason] = useState<ProvidersResponse["byokDisabledReason"]>(null);
  const [defaultModel, setDefaultModel] = useState<string | null>(null);
  const [defaultImageModel, setDefaultImageModel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [choice, setChoice] = useState<string | null>(null);
  const [imageChoice, setImageChoice] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogProvider, setDialogProvider] = useState<ProviderId | undefined>();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getProviders();
      // Tolerate a server that does not list image models yet.
      setProviders(
        data.providers.map((provider) => ({
          ...provider,
          imageModels: provider.imageModels ?? [],
        })),
      );
      setByokEnabled(data.byokEnabled);
      setByokDisabledReason(data.byokDisabledReason ?? null);
      setDefaultModel(data.defaultModel);
      setDefaultImageModel(data.defaultImageModel ?? null);
    } catch {
      // keep the previous catalog; pickers fall back to the server default
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await refresh();
      setChoice((current) => current ?? readStored(STORAGE_KEY));
      setImageChoice((current) => current ?? readStored(IMAGE_STORAGE_KEY));
    })();
  }, [refresh]);

  const openProviderDialog = useCallback((provider?: ProviderId) => {
    setDialogProvider(provider);
    setDialogOpen(true);
  }, []);

  useEffect(() => onProviderDialogRequest(openProviderDialog), [openProviderDialog]);

  const modelsById = useMemo(() => {
    const map = new Map<string, CatalogModel>();
    for (const provider of providers) {
      for (const model of provider.models) map.set(model.id, model);
    }
    return map;
  }, [providers]);

  const imageModelsById = useMemo(() => {
    const map = new Map<string, CatalogImageModel>();
    for (const provider of providers) {
      for (const model of provider.imageModels) map.set(model.id, model);
    }
    return map;
  }, [providers]);

  const modelById = useCallback(
    (id: string | null | undefined) => (id ? modelsById.get(id) : undefined),
    [modelsById],
  );

  const imageModelById = useCallback(
    (id: string | null | undefined) => {
      if (!id) return undefined;
      return (
        imageModelsById.get(id) ?? (id.includes(":") ? undefined : imageModelsById.get(`platform:${id}`))
      );
    },
    [imageModelsById],
  );

  const isProviderUsable = useCallback(
    (providerId: ProviderId) => {
      const provider = providers.find((p) => p.id === providerId);
      if (!provider?.connected) return false;
      // Stored keys cannot be decrypted when the server has BYOK switched off.
      return !provider.requiresKey || byokEnabled;
    },
    [providers, byokEnabled],
  );

  const isModelUsable = useCallback(
    (model: CatalogModel, options?: ResolveOptions) =>
      isProviderUsable(model.provider) && (!options?.requireTools || model.capabilities.tools),
    [isProviderUsable],
  );

  const isImageModelUsable = useCallback(
    (model: CatalogImageModel) => isProviderUsable(model.provider),
    [isProviderUsable],
  );

  const resolveModel = useCallback(
    (id: string | null | undefined, options?: ResolveOptions) => {
      const candidate = modelById(id);
      if (candidate && isModelUsable(candidate, options)) return candidate.id;
      const fallback = modelById(defaultModel);
      if (fallback && isModelUsable(fallback, options)) return fallback.id;
      for (const model of modelsById.values()) {
        if (isModelUsable(model, options)) return model.id;
      }
      return null;
    },
    [modelById, isModelUsable, defaultModel, modelsById],
  );

  const resolveImageModel = useCallback(
    (id: string | null | undefined) => {
      const candidate = imageModelById(id);
      if (candidate && isImageModelUsable(candidate)) return candidate.id;
      const fallback = imageModelById(defaultImageModel);
      if (fallback && isImageModelUsable(fallback)) return fallback.id;
      for (const model of imageModelsById.values()) {
        if (isImageModelUsable(model)) return model.id;
      }
      return null;
    },
    [imageModelById, isImageModelUsable, defaultImageModel, imageModelsById],
  );

  const setSelectedModel = useCallback((id: string) => {
    setChoice(id);
    writeStored(STORAGE_KEY, id);
  }, []);

  const setSelectedImageModel = useCallback((id: string) => {
    setImageChoice(id);
    writeStored(IMAGE_STORAGE_KEY, id);
  }, []);

  // Derived rather than overwritten: if a key is removed and later re-added,
  // the user's stored choice comes back.
  const selectedModel = resolveModel(choice);
  const selectedImageModel = resolveImageModel(imageChoice);

  const value: ModelsContextValue = {
    providers,
    loading,
    byokEnabled,
    byokDisabledReason,
    defaultModel,
    refresh,
    modelById,
    isModelUsable,
    resolveModel,
    selectedModel,
    setSelectedModel,
    defaultImageModel,
    imageModelById,
    isImageModelUsable,
    selectedImageModel,
    setSelectedImageModel,
    openProviderDialog,
  };

  return (
    <ModelsContext.Provider value={value}>
      {children}
      <ProviderKeysDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        focusProvider={dialogProvider}
        providers={providers}
        byokEnabled={byokEnabled}
        byokDisabledReason={byokDisabledReason}
        loading={loading}
        onChanged={refresh}
      />
    </ModelsContext.Provider>
  );
}

export function useModels(): ModelsContextValue {
  const ctx = useContext(ModelsContext);
  if (!ctx) throw new Error("useModels must be used within ModelsProvider");
  return ctx;
}
