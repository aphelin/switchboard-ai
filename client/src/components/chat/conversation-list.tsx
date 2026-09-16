"use client";

import { Plus, Trash2 } from "lucide-react";
import { GhostRows } from "@/components/tui/ghost";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ConversationSummary } from "@/lib/types";

interface ConversationListProps {
  conversations: ConversationSummary[];
  activeId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

/** Past conversations as rounded rows; the active one is a dark pill. */
export function ConversationList({ conversations, activeId, loading, onSelect, onNew, onDelete }: ConversationListProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-4 pt-3 pb-2">
        <button type="button" className="btn btn-primary w-full" onClick={onNew} data-testid="new-conversation">
          <Plus /> New chat
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {loading ? (
          <div className="px-1 pt-1"><GhostRows rows={4} /></div>
        ) : conversations.length === 0 ? (
          <div className="px-1 pt-1"><GhostRows rows={3} label="No conversations yet" /></div>
        ) : (
          <ul className="flex flex-col gap-1" data-testid="conversation-list">
            {conversations.map((conversation) => {
              const active = conversation.id === activeId;
              return (
                <li key={conversation.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => onSelect(conversation.id)}
                    aria-current={active ? "true" : undefined}
                    className={cn("flex w-full flex-col rounded-2xl px-3.5 py-2.5 pr-11 text-left transition-colors hover:bg-white/8", active && "bg-white text-ground shadow-pill hover:bg-white")}
                  >
                    <span className="truncate font-semibold">{conversation.title ?? "Untitled"}</span>
                    <span className={cn("truncate text-xs", active ? "text-ground/60" : "text-dim")}>
                      {conversation.messageCount} message{conversation.messageCount === 1 ? "" : "s"} · {relativeTime(conversation.updatedAt)}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={cn("btn btn-ghost btn-icon btn-xs absolute top-1/2 right-2 -translate-y-1/2 opacity-0 group-hover:opacity-100 focus-visible:opacity-100", active && "text-ground hover:bg-ground/10 hover:text-ground")}
                    title="Delete conversation"
                    aria-label={`Delete ${conversation.title ?? "conversation"}`}
                    onClick={() => onDelete(conversation.id)}
                  >
                    <Trash2 />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
