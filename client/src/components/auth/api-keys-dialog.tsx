"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Check, Copy, KeyRound, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { authClient, API_ORIGIN } from "@/lib/auth-client";
import { MCP_SERVER_NAME } from "@/lib/site";
import { formatStamp } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Spin } from "@/components/tui/spin";
import { GhostRows } from "@/components/tui/ghost";
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
  return formatStamp(new Date(value).toISOString());
}

export function mcpCommand(key: string): string {
  return `claude mcp add --transport http ${MCP_SERVER_NAME} ${API_ORIGIN}/api/mcp --header "x-api-key: ${key}"`;
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
      <DialogContent className="sm:max-w-xl" data-testid="api-keys-dialog">
        <DialogHeader>
          <DialogTitle>
            <KeyRound />
            API keys
          </DialogTitle>
          <DialogDescription>
            A key connects MCP clients such as Claude Code to your toolkit. A key acts as you, so it
            can read your documents and spend your AI budget.
          </DialogDescription>
        </DialogHeader>

        {newKey ? (
          <div className="flex flex-col gap-3 rounded-[22px] bg-accent/8 p-4 ring-1 ring-accent/30" data-testid="api-key-created">
            <p className="font-bold text-accent-2">Copy the key now. It is not shown again.</p>
            <CopyField value={newKey} testId="api-key-value" />
            <p className="text-sm text-dim">Connect Claude Code:</p>
            <CopyField value={mcpCommand(newKey)} testId="api-key-command" multiline />
            <div>
              <button type="button" className="btn btn-glass btn-sm" onClick={() => setNewKey(null)}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <form className="flex gap-2" onSubmit={handleCreate}>
            <Input
              placeholder="Key name, e.g. Claude Code laptop"
              aria-label="Key name"
              value={name}
              maxLength={64}
              onChange={(e) => setName(e.target.value)}
              data-testid="api-key-name"
            />
            <button type="submit" className="btn btn-primary" disabled={creating || !name.trim()} data-testid="api-key-create">
              {creating ? <Spin /> : null}
              Create
            </button>
          </form>
        )}

        <div className="max-h-80 overflow-y-auto" data-testid="api-key-list">
          {loading && keys.length === 0 ? (
            <GhostRows rows={2} />
          ) : keys.length === 0 ? (
            <GhostRows rows={2} label="No API keys yet" />
          ) : (
            <ul className="flex flex-col gap-1">
              {keys.map((key) => (
                <li key={key.id} className="flex items-center justify-between gap-4 rounded-2xl px-3 py-2.5 hover:bg-white/6">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{key.name || "Unnamed key"}</p>
                    <p className="truncate text-xs text-dim">
                      {key.start ? `${key.start}…` : "••••"} · created {formatDate(key.createdAt)} · last used{" "}
                      {formatDate(key.lastRequest)}
                    </p>
                  </div>
                  {confirmingId === key.id ? (
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        className="btn btn-danger btn-xs"
                        disabled={deletingId === key.id}
                        onClick={() => void handleDelete(key.id)}
                      >
                        {deletingId === key.id ? <Spin /> : "Delete"}
                      </button>
                      <button type="button" className="btn btn-ghost btn-xs" onClick={() => setConfirmingId(null)}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon btn-sm shrink-0 hover:text-err"
                      aria-label={`Delete ${key.name ?? "key"}`}
                      onClick={() => setConfirmingId(key.id)}
                    >
                      <Trash2 />
                    </button>
                  )}
                </li>
              ))}
            </ul>
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
          className="field field-area field-data min-h-0 flex-1 resize-none rounded-[20px] break-all text-xs"
          onFocus={(e) => e.currentTarget.select()}
          data-testid={testId}
        />
      ) : (
        <Input
          readOnly
          value={value}
          className="field-data flex-1"
          onFocus={(e) => e.currentTarget.select()}
          data-testid={testId}
        />
      )}
      <button type="button" className="btn btn-glass btn-icon" aria-label="Copy" onClick={() => void copy()}>
        {copied ? <Check /> : <Copy />}
      </button>
    </div>
  );
}
