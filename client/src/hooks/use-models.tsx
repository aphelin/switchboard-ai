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
import type { CatalogModel, ProviderId, ProviderStatus } from "@/lib/types";
import { ProviderKeysDialog } from "@/components/models/provider-keys-dialog";

const STORAGE_KEY = "mat.selectedModel";

interface ResolveOptions {
  /** Only accept models that support tool calling (the chat agent needs it). */
  requireTools?: boolean;
}

interface ModelsContextValue {
  providers: ProviderStatus[];
  loading: boolean;
  byokEnabled: boolean;
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
  openProviderDialog: (provider?: ProviderId) => void;
}

const ModelsContext = createContext<ModelsContextValue | null>(null);

function readStoredModel(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredModel(id: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // storage unavailable (private mode, quota): the choice lasts for this session
  }
}

export function ModelsProvider({ children }: { children: ReactNode }) {
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [byokEnabled, setByokEnabled] = useState(false);
  const [defaultModel, setDefaultModel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [choice, setChoice] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogProvider, setDialogProvider] = useState<ProviderId | undefined>();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getProviders();
      setProviders(data.providers);
      setByokEnabled(data.byokEnabled);
      setDefaultModel(data.defaultModel);
    } catch {
      // keep the previous catalog; pickers fall back to the server default
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await refresh();
      setChoice((current) => current ?? readStoredModel());
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

  const modelById = useCallback(
    (id: string | null | undefined) => (id ? modelsById.get(id) : undefined),
    [modelsById],
  );

  const isModelUsable = useCallback(
    (model: CatalogModel, options?: ResolveOptions) => {
      const provider = providers.find((p) => p.id === model.provider);
      if (!provider?.connected) return false;
      // Stored keys cannot be decrypted when the server has BYOK switched off.
      if (provider.requiresKey && !byokEnabled) return false;
      return !options?.requireTools || model.capabilities.tools;
    },
    [providers, byokEnabled],
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

  const setSelectedModel = useCallback((id: string) => {
    setChoice(id);
    writeStoredModel(id);
  }, []);

  // Derived rather than overwritten: if a key is removed and later re-added,
  // the user's stored choice comes back.
  const selectedModel = resolveModel(choice);

  const value: ModelsContextValue = {
    providers,
    loading,
    byokEnabled,
    defaultModel,
    refresh,
    modelById,
    isModelUsable,
    resolveModel,
    selectedModel,
    setSelectedModel,
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
