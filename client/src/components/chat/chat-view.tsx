"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { generateId, type UIMessage } from "ai";
import { Activity } from "lucide-react";
import { Pane } from "@/components/tui/pane";
import { Orb } from "@/components/tui/logo";
import { Stagger, StaggerItem } from "@/components/motion/reveal";
import { ConversationList } from "./conversation-list";
import { ChatThread } from "./chat-thread";
import { DocumentScopeSelector, type DocumentScope } from "./document-scope-selector";
import { ModelPicker } from "@/components/models/model-picker";
import { useModels } from "@/hooks/use-models";
import { deleteConversation, getConversation, getConversations, getDocuments } from "@/lib/api";
import { DocumentStatus } from "@/lib/constants";
import type { ConversationSummary, DocumentSummary } from "@/lib/types";
import { toast } from "sonner";

const CONVERSATION_LIMIT = 50;
const TITLE_REFRESH_DELAY_MS = 8000;

interface ActiveConversation {
  id: string;
  title: string | null;
  initialMessages: UIMessage[];
}

/** Window 4: conversations on the left, the agent transcript on the right. */
export function ChatView() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [documentScope, setDocumentScope] = useState<DocumentScope>("all");
  const [active, setActive] = useState<ActiveConversation | null>(null);
  const [opening, setOpening] = useState(false);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { selectedModel, setSelectedModel, resolveModel } = useModels();
  const chatModel = resolveModel(selectedModel, { requireTools: true });

  const refreshConversations = useCallback(async () => {
    try {
      const result = await getConversations({ limit: CONVERSATION_LIMIT });
      setConversations(result.data);
      setActive((current) => {
        if (!current) return current;
        const match = result.data.find((c) => c.id === current.id);
        return match && match.title !== current.title ? { ...current, title: match.title } : current;
      });
    } catch { /* keep the previous list */ }
    finally { setListLoading(false); }
  }, []);

  const startNew = useCallback(() => { setActive({ id: generateId(), title: null, initialMessages: [] }); }, []);

  useEffect(() => {
    startNew();
    refreshConversations();
    getDocuments({ status: DocumentStatus.READY, limit: 100 }).then((result) => setDocuments(result.data)).catch(() => undefined);
    return () => { if (refreshTimer.current) clearTimeout(refreshTimer.current); };
  }, [startNew, refreshConversations]);

  const openConversation = useCallback(async (id: string) => {
    setOpening(true);
    try {
      const detail = await getConversation(id);
      setActive({ id: detail.id, title: detail.title, initialMessages: detail.messages.map((message) => ({ id: message.id, role: message.role, parts: message.parts, metadata: message.metadata }) as UIMessage) });
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to open conversation"); }
    finally { setOpening(false); }
  }, []);

  const removeConversation = useCallback(async (id: string) => {
    try {
      await deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (active?.id === id) startNew();
      toast.success("Conversation deleted");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Delete failed"); }
  }, [active?.id, startNew]);

  const handleResponseFinished = useCallback(() => {
    refreshConversations();
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(refreshConversations, TITLE_REFRESH_DELAY_MS);
  }, [refreshConversations]);

  return (
    <Stagger className="grid h-[calc(100dvh-170px)] min-h-[560px] gap-6 lg:h-[calc(100dvh-124px)] lg:grid-cols-[300px_minmax(0,1fr)]">
      <StaggerItem className="hidden min-h-0 min-w-0 lg:block">
        <Pane title="Conversations" legend={listLoading ? "Loading" : `${conversations.length}`} flush className="h-full">
          <ConversationList conversations={conversations} activeId={active?.id ?? null} loading={listLoading} onSelect={openConversation} onNew={startNew} onDelete={removeConversation} />
        </Pane>
      </StaggerItem>

      <StaggerItem className="min-h-0 min-w-0">
        <section className="glass flex h-full min-h-0 flex-col" data-slot="conversation">
          <div className="flex flex-col gap-2 border-b border-line px-5 py-3 lg:flex-row lg:items-center">
            <div className="flex min-w-0 items-center gap-2 lg:flex-1">
              <Orb size={26} breathe={opening} />
              <h1 className="min-w-0 flex-1 truncate text-lg font-bold tracking-tight" data-testid="conversation-title">
                {active?.title ?? "New conversation"}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ModelPicker value={chatModel} onChange={setSelectedModel} requireTools size="sm" />
              <DocumentScopeSelector documents={documents} scope={documentScope} selected={selectedDocumentIds} onChange={(scope, ids) => { setDocumentScope(scope); setSelectedDocumentIds(ids); }} />
              {active && (
                <Link href={`/traces?traceId=${encodeURIComponent(active.id)}`} className="chip chip-sm" title="Every model call in this conversation">
                  <Activity /> Traces
                </Link>
              )}
            </div>
          </div>
          <div className="min-h-0 flex-1">
            {!active || opening ? (
              <div className="flex h-full items-center justify-center gap-2 text-dim">Opening…</div>
            ) : (
              <ChatThread key={active.id} conversationId={active.id} initialMessages={active.initialMessages} documentIds={documentScope === "selected" ? selectedDocumentIds : []} documentScope={documentScope} model={chatModel} onResponseFinished={handleResponseFinished} />
            )}
          </div>
        </section>
      </StaggerItem>
    </Stagger>
  );
}
