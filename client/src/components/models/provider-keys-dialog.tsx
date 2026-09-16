"use client";

import { useState, type FormEvent } from "react";
import { Bot, ExternalLink, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteProviderKey, saveProviderKey } from "@/lib/api";
import { ApiError, toastApiError } from "@/lib/api-errors";
import type { ProviderId, ProviderStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Spin } from "@/components/tui/spin";
import { GhostRows } from "@/components/tui/ghost";
import { Mark } from "@/components/tui/mark";
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
  byokDisabledReason?: "server" | "guest" | null;
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
  byokDisabledReason,
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
        className="sm:max-w-xl"
        data-testid="provider-keys-dialog"
        initialFocus={() =>
          focusProvider
            ? document.querySelector<HTMLInputElement>(inputSelector(focusProvider)) ?? true
            : true
        }
      >
        <DialogHeader>
          <DialogTitle>
            <Bot />
            AI providers
          </DialogTitle>
          <DialogDescription>
            The server encrypts your key and never shows it again. That provider bills the requests
            made on your key, and they do not count against your daily budget.
          </DialogDescription>
        </DialogHeader>

        {!byokEnabled && !loading && providers.length > 0 && (
          <p className="flex items-start gap-2 rounded-2xl bg-warn/12 px-4 py-2.5 text-sm text-warn" data-testid="byok-disabled">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            {byokDisabledReason === "guest" ? (
              <span data-testid="byok-disabled-guest">
                Demo sessions run on the included models and can&apos;t store keys. Create an account
                to use your own OpenAI, Anthropic or Google key.
              </span>
            ) : (
              <span>
                The server administrator hasn&apos;t enabled your own provider keys (no encryption key
                is configured). The included models still work.
              </span>
            )}
          </p>
        )}

        <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto pr-1" data-testid="provider-key-list">
          {keyProviders.length === 0 ? (
            loading ? (
              <GhostRows rows={3} />
            ) : (
              <div className="flex items-center justify-between gap-2 text-sm text-dim">
                <span>Couldn&apos;t load AI providers.</span>
                <button type="button" className="btn btn-glass btn-xs" onClick={() => void onChanged()}>
                  Retry
                </button>
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
                    "glass-inner flex flex-col gap-3 px-4 py-3.5",
                    focusProvider === provider.id && "ring-2 ring-accent/40",
                  )}
                  data-testid={`provider-row-${provider.id}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <label htmlFor={inputId} className="block text-[15px] font-bold">
                        {provider.label}
                      </label>
                      <p className="truncate text-sm text-dim" data-testid={`provider-status-${provider.id}`}>
                        {provider.connected ? (
                          <>
                            <Mark tone="ok" className="text-sm">Connected</Mark>
                            {provider.keyHint && (
                              <>
                                {" · "}
                                <span className="data">…{provider.keyHint}</span>
                              </>
                            )}
                            {updated && ` · updated ${updated}`}
                          </>
                        ) : (
                          <Mark tone="dim" shape="hollow" className="text-sm">Not connected</Mark>
                        )}
                      </p>
                      {provider.id === "google" && provider.imageModels.length > 0 && (
                        <p className="text-xs text-dim" data-testid={`provider-image-hint-${provider.id}`}>
                          Also enables the Nano Banana image models
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {provider.keyUrl && (
                        <a
                          href={provider.keyUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="chip chip-sm"
                        >
                          Get a key
                          <ExternalLink className="size-3.5" />
                        </a>
                      )}
                      {provider.connected &&
                        (confirming === provider.id ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-danger btn-xs"
                              disabled={removing}
                              onClick={() => void handleRemove(provider)}
                              data-testid={`provider-remove-confirm-${provider.id}`}
                            >
                              {removing ? <Spin /> : "Remove"}
                            </button>
                            <button type="button" className="btn btn-ghost btn-xs" onClick={() => setConfirming(null)}>
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs hover:text-err"
                            disabled={busy !== null}
                            onClick={() => setConfirming(provider.id)}
                            data-testid={`provider-remove-${provider.id}`}
                          >
                            <Trash2 />
                            Remove
                          </button>
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
                      className="field-sm field-data h-10 min-w-0 flex-1"
                      data-provider-key-input={provider.id}
                      data-1p-ignore
                      data-lpignore="true"
                      data-testid={`provider-key-input-${provider.id}`}
                    />
                    <button
                      type="submit"
                      className="btn btn-accent btn-sm"
                      disabled={!byokEnabled || !draft.trim() || busy !== null}
                      data-testid={`provider-key-save-${provider.id}`}
                    >
                      {saving ? (
                        <>
                          <Spin />
                          Verifying
                        </>
                      ) : (
                        "Save & verify"
                      )}
                    </button>
                  </form>

                  {error && (
                    <p
                      id={`${inputId}-error`}
                      role="alert"
                      className="text-sm text-err"
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
