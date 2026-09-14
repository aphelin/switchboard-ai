import type { ProviderId } from "./types";

type Listener = (provider?: ProviderId) => void;

const listeners = new Set<Listener>();

/**
 * Tiny event bus for "open the AI providers dialog". Non-React code (toast
 * actions, error helpers) requests it here; the ModelsProvider listens.
 */
export function requestProviderDialog(provider?: ProviderId): void {
  listeners.forEach((listener) => listener(provider));
}

export function onProviderDialogRequest(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const PROVIDER_IDS: readonly ProviderId[] = ["platform", "openai", "anthropic", "google"];

/** Provider of a catalog model id (`<provider>:<modelId>`), if recognisable. */
export function providerOfModel(modelId: string | null | undefined): ProviderId | undefined {
  const prefix = modelId?.split(":", 1)[0];
  return PROVIDER_IDS.find((id) => id === prefix);
}
