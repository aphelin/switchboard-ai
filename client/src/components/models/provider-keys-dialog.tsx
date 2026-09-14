"use client";

import { useState, type FormEvent } from "react";
import { Bot, ExternalLink, Loader2, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteProviderKey, saveProviderKey } from "@/lib/api";
import { ApiError, toastApiError } from "@/lib/api-errors";
import type { ProviderId, ProviderStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ProviderKeysDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Provider to highlight and focus when the dialog opens. */
  focusProvider?: ProviderId;
  providers: ProviderStatus[];
  byokEnabled: boolean;
  loading: boolean;
  onChanged: () => Promise<void>;
}

type Busy = { provider: ProviderId; action: "save" | "remove" } | null;

function formatDate(value: string | null): string | null {
  return value ? new Date(value).toLocaleDateString() : null;
}

function inputSelector(provider: ProviderId): string {
  return `[data-provider-key-input="${provider}"]`;
}

/**
 * Bring-your-own-key management for OpenAI, Anthropic and Google Gemini.
 * Keys are verified and encrypted by the server and never returned; only the
 * last 4 characters come back.
 */
export function ProviderKeysDialog({
  open,
  onOpenChange,
  focusProvider,
  providers,
  byokEnabled,
  loading,
  onChanged,
}: ProviderKeysDialogProps) {
  // Plaintext drafts live only until they are saved or the dialog closes.
  const [drafts, setDrafts] = useState<Partial<Record<ProviderId, string>>>({});
  const [errors, setErrors] = useState<Partial<Record<ProviderId, string>>>({});
  const [busy, setBusy] = useState<Busy>(null);
  const [confirming, setConfirming] = useState<ProviderId | null>(null);

  const keyProviders = providers.filter((provider) => provider.requiresKey);

  const setDraft = (provider: ProviderId, value: string) => {
    setDrafts((current) => ({ ...current, [provider]: value }));
  };

  const setError = (provider: ProviderId, message: string | undefined) => {
    setErrors((current) => ({ ...current, [provider]: message }));
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setDrafts({});
      setErrors({});
      setConfirming(null);
    }
    onOpenChange(next);
  };

  const handleSave = async (provider: ProviderStatus, event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const apiKey = drafts[provider.id]?.trim();
    if (!apiKey || busy) return;
    setBusy({ provider: provider.id, action: "save" });
    setError(provider.id, undefined);
    try {
      const result = await saveProviderKey(provider.id, apiKey);
      setDraft(provider.id, "");
      toast.success(`${provider.label} key saved`, {
        description: `Verified and stored (…${result.keyHint}).`,
      });
      if (result.warning) toast.warning(result.warning);
      await onChanged();
    } catch (err) {
      if (err instanceof ApiError && (err.status === 400 || err.status === 502)) {
        // Rejected key, validation failure, or the provider could not be reached.
        setError(provider.id, err.message);
      } else {
        toastApiError(err, `Failed to save the ${provider.label} key`);
        // 503: BYOK was switched off server-side; reload so the dialog says so.
        if (err instanceof ApiError && err.status === 503) void onChanged();
      }
    } finally {
      setBusy(null);
    }
  };

  const handleRemove = async (provider: ProviderStatus) => {
    setBusy({ provider: provider.id, action: "remove" });
    try {
      await deleteProviderKey(provider.id);
      toast.success(`${provider.label} key removed`);
      await onChanged();
    } catch (err) {
      toastApiError(err, `Failed to remove the ${provider.label} key`);
    } finally {
      setBusy(null);
      setConfirming(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-lg"
        data-testid="provider-keys-dialog"
        initialFocus={() =>
          focusProvider
            ? document.querySelector<HTMLInputElement>(inputSelector(focusProvider)) ?? true
            : true
        }
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            AI providers
          </DialogTitle>
          <DialogDescription>
            Your key is encrypted on the server and never shown again. Requests on your key are
            billed by that provider and don&apos;t use your daily budget.
          </DialogDescription>
        </DialogHeader>

        {!byokEnabled && !loading && providers.length > 0 && (
          <div
            className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs"
            data-testid="byok-disabled"
          >
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <p>
              The server administrator hasn&apos;t enabled your own provider keys (no encryption key
              is configured). The included models still work.
            </p>
          </div>
        )}

        <div className="max-h-[60vh] space-y-2 overflow-y-auto" data-testid="provider-key-list">
          {keyProviders.length === 0 ? (
            loading ? (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading providers…
              </p>
            ) : (
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>Couldn&apos;t load AI providers.</span>
                <Button variant="outline" size="xs" onClick={() => void onChanged()}>
                  Retry
                </Button>
              </div>
            )
          ) : (
            keyProviders.map((provider) => {
              const saving = busy?.provider === provider.id && busy.action === "save";
              const removing = busy?.provider === provider.id && busy.action === "remove";
              const draft = drafts[provider.id] ?? "";
              const error = errors[provider.id];
              const updated = formatDate(provider.updatedAt);
              const inputId = `provider-key-${provider.id}`;

              return (
                <div
                  key={provider.id}
                  className={cn(
                    "space-y-2 rounded-lg border px-3 py-2.5",
                    focusProvider === provider.id && "border-primary/50 bg-primary/5",
                  )}
                  data-testid={`provider-row-${provider.id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <label htmlFor={inputId} className="block text-sm font-medium">
                        {provider.label}
                      </label>
                      <p
                        className="truncate text-xs text-muted-foreground"
                        data-testid={`provider-status-${provider.id}`}
                      >
                        {provider.connected ? (
                          <>
                            <span className="text-emerald-600 dark:text-emerald-400">Connected</span>
                            {provider.keyHint && (
                              <>
                                {" · "}
                                <span className="font-mono">…{provider.keyHint}</span>
                              </>
                            )}
                            {updated && ` · updated ${updated}`}
                          </>
                        ) : (
                          "Not connected"
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {provider.keyUrl && (
                        <a
                          href={provider.keyUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-primary underline-offset-2 hover:underline"
                        >
                          Get a key
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      {provider.connected &&
                        (confirming === provider.id ? (
                          <>
                            <Button
                              variant="destructive"
                              size="xs"
                              disabled={removing}
                              onClick={() => void handleRemove(provider)}
                              data-testid={`provider-remove-confirm-${provider.id}`}
                            >
                              {removing ? <Loader2 className="h-3 w-3 animate-spin" /> : "Remove"}
                            </Button>
                            <Button variant="ghost" size="xs" onClick={() => setConfirming(null)}>
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="ghost"
                            size="xs"
                            className="gap-1 text-muted-foreground hover:text-destructive"
                            disabled={busy !== null}
                            onClick={() => setConfirming(provider.id)}
                            data-testid={`provider-remove-${provider.id}`}
                          >
                            <Trash2 className="h-3 w-3" />
                            Remove
                          </Button>
                        ))}
                    </div>
                  </div>

                  <form className="flex gap-2" onSubmit={(e) => void handleSave(provider, e)}>
                    <Input
                      id={inputId}
                      type="password"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder={
                        provider.connected
                          ? `Replace key${provider.keyPlaceholder ? ` (${provider.keyPlaceholder})` : ""}`
                          : provider.keyPlaceholder ?? "Paste your API key"
                      }
                      value={draft}
                      disabled={!byokEnabled || saving}
                      aria-invalid={error ? true : undefined}
                      aria-describedby={error ? `${inputId}-error` : undefined}
                      onChange={(e) => {
                        setDraft(provider.id, e.target.value);
                        if (error) setError(provider.id, undefined);
                      }}
                      className="min-w-0 flex-1 font-mono text-xs"
                      data-provider-key-input={provider.id}
                      data-1p-ignore
                      data-lpignore="true"
                      data-testid={`provider-key-input-${provider.id}`}
                    />
                    <Button
                      type="submit"
                      size="sm"
                      className="h-8"
                      disabled={!byokEnabled || !draft.trim() || busy !== null}
                      data-testid={`provider-key-save-${provider.id}`}
                    >
                      {saving ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Verifying…
                        </>
                      ) : (
                        "Save & verify"
                      )}
                    </Button>
                  </form>

                  {error && (
                    <p
                      id={`${inputId}-error`}
                      role="alert"
                      className="text-xs text-destructive"
                      data-testid={`provider-key-error-${provider.id}`}
                    >
                      {error}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
