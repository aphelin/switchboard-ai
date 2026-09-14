import { toast } from "sonner";

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

/** Shows an error toast; budget errors get a dedicated, explicit title. */
export function toastApiError(error: unknown, fallback: string): void {
  const message = error instanceof Error && error.message ? error.message : fallback;
  if (isBudgetError(error)) {
    toast.error("Daily AI budget reached", { description: message });
    return;
  }
  toast.error(message);
}
