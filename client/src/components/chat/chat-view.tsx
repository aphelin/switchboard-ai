"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { generateId, type UIMessage } from "ai";
import { Activity, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConversationList } from "./conversation-list";
import { ChatThread } from "./chat-thread";
import { DocumentScopeSelector } from "./document-scope-selector";
import { ModelPicker } from "@/components/models/model-picker";
import { useModels } from "@/hooks/use-models";
import {
  deleteConversation,
  getConversation,
  getConversations,
  getDocuments,
} from "@/lib/api";
import { DocumentStatus } from "@/lib/constants";
import type { ConversationSummary, DocumentSummary } from "@/lib/types";
import { toast } from "sonner";

const CONVERSATION_LIMIT = 50;
/** Titles are generated asynchronously after the first reply; refresh again later to pick them up. */
const TITLE_REFRESH_DELAY_MS = 8000;

interface ActiveConversation {
  id: string;
  title: string | null;
  initialMessages: UIMessage[];
}

export function ChatView() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [active, setActive] = useState<ActiveConversation | null>(null);
  const [opening, setOpening] = useState(false);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { selectedModel, setSelectedModel, resolveModel } = useModels();
  // The agent calls tools, so fall back to a tool-capable model if needed.
  const chatModel = resolveModel(selectedModel, { requireTools: true });

  const refreshConversations = useCallback(async () => {
    try {
      const result = await getConversations({ limit: CONVERSATION_LIMIT });
      setConversations(result.data);
      setActive((current) => {
        if (!current) return current;
        const match = result.data.find((c) => c.id === current.id);
        return match && match.title !== current.title
          ? { ...current, title: match.title }
          : current;
      });
    } catch {
      // keep the previous list
    } finally {
      setListLoading(false);
    }
  }, []);

  const startNew = useCallback(() => {
    setActive({ id: generateId(), title: null, initialMessages: [] });
  }, []);

  useEffect(() => {
    startNew();
    refreshConversations();
    getDocuments({ status: DocumentStatus.READY, limit: 100 })
      .then((result) => setDocuments(result.data))
      .catch(() => undefined);
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [startNew, refreshConversations]);

  const openConversation = useCallback(async (id: string) => {
    setOpening(true);
    try {
      const detail = await getConversation(id);
      setActive({
        id: detail.id,
        title: detail.title,
        initialMessages: detail.messages.map(
          (message) =>
            ({
              id: message.id,
              role: message.role,
              parts: message.parts,
              metadata: message.metadata,
            }) as UIMessage,
        ),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to open conversation");
    } finally {
      setOpening(false);
    }
  }, []);

  const removeConversation = useCallback(
    async (id: string) => {
      try {
        await deleteConversation(id);
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (active?.id === id) startNew();
        toast.success("Conversation deleted");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Delete failed");
      }
    },
    [active?.id, startNew],
  );

  const handleResponseFinished = useCallback(() => {
    refreshConversations();
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(refreshConversations, TITLE_REFRESH_DELAY_MS);
  }, [refreshConversations]);

  return (
    <div className="grid h-[calc(100vh-11rem)] min-h-[520px] gap-4 lg:grid-cols-[260px_1fr]">
      <Card className="hidden min-h-0 min-w-0 gap-0 py-0 lg:flex">
        <ConversationList
          conversations={conversations}
          activeId={active?.id ?? null}
          loading={listLoading}
          onSelect={openConversation}
          onNew={startNew}
          onDelete={removeConversation}
        />
      </Card>

      <Card className="min-h-0 min-w-0 gap-0 py-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium" data-testid="conversation-title">
              {active?.title ?? "New conversation"}
            </p>
            {active && (
              <p className="truncate font-mono text-[11px] text-muted-foreground">{active.id}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ModelPicker
              value={chatModel}
              onChange={setSelectedModel}
              requireTools
              size="sm"
            />
            <DocumentScopeSelector
              documents={documents}
              selected={selectedDocumentIds}
              onChange={setSelectedDocumentIds}
            />
            {active && (
              <Link href={`/traces?traceId=${encodeURIComponent(active.id)}`}>
                <Button variant="ghost" size="sm" className="gap-1.5">
                  <Activity className="h-3.5 w-3.5" />
                  View traces
                </Button>
              </Link>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1">
          {!active || opening ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <ChatThread
              key={active.id}
              conversationId={active.id}
              initialMessages={active.initialMessages}
              documentIds={selectedDocumentIds}
              model={chatModel}
              onResponseFinished={handleResponseFinished}
            />
          )}
        </div>
      </Card>
    </div>
  );
}
