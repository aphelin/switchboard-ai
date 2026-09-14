"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Check, Copy, KeyRound, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { authClient, API_ORIGIN } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ApiKeyRow {
  id: string;
  name: string | null;
  start: string | null;
  createdAt: Date | string;
  lastRequest: Date | string | null;
  expiresAt: Date | string | null;
}

interface ApiKeysDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatDate(value: Date | string | null): string {
  if (!value) return "never";
  return new Date(value).toLocaleString();
}

export function mcpCommand(key: string): string {
  return `claude mcp add --transport http mini-ai-toolkit ${API_ORIGIN}/api/mcp --header "x-api-key: ${key}"`;
}

/**
 * Personal API keys for MCP clients (Claude Code, Claude Desktop, MCP Inspector).
 * Keys are stored hashed by the server, so the full key is shown only once.
 */
export function ApiKeysDialog({ open, onOpenChange }: ApiKeysDialogProps) {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadKeys = async () => {
    setLoading(true);
    try {
      const { data, error } = await authClient.apiKey.list();
      if (error) throw new Error(error.message || "Failed to load API keys");
      setKeys((data?.apiKeys ?? []) as ApiKeyRow[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load API keys");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    void loadKeys();
  }, [open]);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      // Never keep a plaintext key around after the dialog closes.
      setNewKey(null);
      setConfirmingId(null);
      setName("");
    }
    onOpenChange(next);
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      const { data, error } = await authClient.apiKey.create({ name: trimmed });
      if (error || !data) throw new Error(error?.message || "Failed to create the API key");
      setNewKey(data.key);
      setName("");
      await loadKeys();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create the API key");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (keyId: string) => {
    setDeletingId(keyId);
    try {
      const { error } = await authClient.apiKey.delete({ keyId });
      if (error) throw new Error(error.message || "Failed to delete the API key");
      setKeys((current) => current.filter((key) => key.id !== keyId));
      toast.success("API key deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete the API key");
    } finally {
      setDeletingId(null);
      setConfirmingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="api-keys-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            API keys
          </DialogTitle>
          <DialogDescription>
            Use a key to connect MCP clients such as Claude Code to your toolkit. Keys act as
            you: they can read your documents and spend your AI budget.
          </DialogDescription>
        </DialogHeader>

        {newKey ? (
          <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3" data-testid="api-key-created">
            <p className="text-xs font-medium">
              Copy your key now. It will not be shown again.
            </p>
            <CopyField value={newKey} testId="api-key-value" />
            <p className="text-xs text-muted-foreground">Connect Claude Code:</p>
            <CopyField value={mcpCommand(newKey)} testId="api-key-command" multiline />
            <Button variant="outline" size="sm" onClick={() => setNewKey(null)}>
              Done
            </Button>
          </div>
        ) : (
          <form className="flex gap-2" onSubmit={handleCreate}>
            <Input
              placeholder="Key name, e.g. Claude Code laptop"
              value={name}
              maxLength={64}
              onChange={(e) => setName(e.target.value)}
              data-testid="api-key-name"
            />
            <Button type="submit" disabled={creating || !name.trim()} data-testid="api-key-create">
              {creating && <Loader2 className="h-4 w-4 animate-spin" />}
              Create
            </Button>
          </form>
        )}

        <div className="max-h-72 space-y-2 overflow-y-auto" data-testid="api-key-list">
          {loading && keys.length === 0 ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading keys…
            </p>
          ) : keys.length === 0 ? (
            <p className="text-xs text-muted-foreground">No API keys yet.</p>
          ) : (
            keys.map((key) => (
              <div
                key={key.id}
                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{key.name || "Unnamed key"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    <span className="font-mono">{key.start ? `${key.start}…` : "••••"}</span>
                    {" · created "}
                    {formatDate(key.createdAt)}
                    {" · last used "}
                    {formatDate(key.lastRequest)}
                  </p>
                </div>
                {confirmingId === key.id ? (
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="destructive"
                      size="xs"
                      disabled={deletingId === key.id}
                      onClick={() => void handleDelete(key.id)}
                    >
                      {deletingId === key.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Delete"}
                    </Button>
                    <Button variant="ghost" size="xs" onClick={() => setConfirmingId(null)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label={`Delete ${key.name ?? "key"}`}
                    onClick={() => setConfirmingId(key.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CopyField({
  value,
  testId,
  multiline = false,
}: {
  value: string;
  testId: string;
  multiline?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy failed. Select the text and copy it manually.");
    }
  };

  return (
    <div className="flex items-start gap-2">
      {multiline ? (
        <textarea
          readOnly
          value={value}
          rows={3}
          className="min-w-0 flex-1 resize-none rounded-md border bg-background px-2 py-1.5 font-mono text-[11px] break-all"
          onFocus={(e) => e.currentTarget.select()}
          data-testid={testId}
        />
      ) : (
        <Input
          readOnly
          value={value}
          className="min-w-0 flex-1 font-mono text-xs"
          onFocus={(e) => e.currentTarget.select()}
          data-testid={testId}
        />
      )}
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="Copy"
        onClick={() => void copy()}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}
