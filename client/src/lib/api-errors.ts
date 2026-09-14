import { toast } from "sonner";
import { providerOfModel, requestProviderDialog } from "./model-events";
import type { ProviderId } from "./types";

/** Error body returned by the NestJS exception filter. */
export interface ApiErrorBody {
  statusCode?: number;
  error?: string;
  message?: string | string[];
}

/** An API failure with its HTTP status and the server's error label. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** `error` label the server uses when a user's daily AI budget is spent. */
export const BUDGET_EXCEEDED = "Budget Exceeded";

export function isBudgetError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 429 && error.code === BUDGET_EXCEEDED;
}

/** `error` label when the chosen model's provider has no stored key for this user. */
export const PROVIDER_KEY_REQUIRED = "Provider Key Required";
/** `error` label when a provider rejects the key being saved. */
export const INVALID_PROVIDER_KEY = "Invalid Provider Key";
/** `error` label for an unknown or malformed catalog model id. */
export const UNKNOWN_MODEL = "Unknown Model";

export function isProviderKeyRequiredError(error: unknown): boolean {
  return error instanceof ApiError && error.code === PROVIDER_KEY_REQUIRED;
}

/**
 * Best guess at which provider a "key required" error is about: the model the
 * caller sent, otherwise a provider named in the server's message.
 */
export function providerForKeyError(
  error: unknown,
  model?: string | null,
): ProviderId | undefined {
  const fromModel = providerOfModel(model);
  if (fromModel && fromModel !== "platform") return fromModel;
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("openai")) return "openai";
  if (message.includes("anthropic")) return "anthropic";
  if (message.includes("google") || message.includes("gemini")) return "google";
  return undefined;
}

export function messageFromBody(body: ApiErrorBody | undefined): string | undefined {
  const raw = body?.message;
  return Array.isArray(raw) ? raw.join("; ") : raw;
}

/**
 * The AI SDK chat transport throws `Error(responseText)` for non-2xx responses,
 * so the JSON error body arrives as the message. Recover status and message.
 */
export function fromChatError(error: Error): ApiError {
  try {
    const body = JSON.parse(error.message) as ApiErrorBody;
    if (body && typeof body === "object" && ("statusCode" in body || "message" in body)) {
      return new ApiError(
        messageFromBody(body) || "The assistant failed to respond",
        body.statusCode,
        body.error,
      );
    }
  } catch {
    // not a JSON body: a network error or a message streamed by the server
  }
  return new ApiError(error.message || "The assistant failed to respond");
}

/**
 * Shows an error toast. Budget errors get a dedicated, explicit title; missing
 * provider keys get an "Add key" action that opens the AI providers dialog.
 * Pass the catalog `model` that was sent so the dialog can focus its provider.
 */
export function toastApiError(
  error: unknown,
  fallback: string,
  context?: { model?: string | null },
): void {
  const message = error instanceof Error && error.message ? error.message : fallback;
  if (isBudgetError(error)) {
    toast.error("Daily AI budget reached", { description: message });
    return;
  }
  if (isProviderKeyRequiredError(error)) {
    const provider = providerForKeyError(error, context?.model);
    toast.error("API key required", {
      description: message,
      action: { label: "Add key", onClick: () => requestProviderDialog(provider) },
    });
    return;
  }
  toast.error(message);
}
