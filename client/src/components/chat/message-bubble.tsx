"use client";

import { Sparkles, BookOpen } from "lucide-react";
import type { UIMessage } from "ai";
import { Markdown } from "./markdown";
import { ToolPartCard } from "./tool-parts";
import { collectSources, isToolPart, textOfMessage } from "@/lib/chat-parts";
import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  message: UIMessage;
  streaming: boolean;
  onApproval: (approvalId: string, approved: boolean) => void;
}

function SourcesFooter({ message }: { message: UIMessage }) {
  const groups = collectSources(message);
  if (groups.length === 0) return null;
  const multi = groups.length > 1;

  return (
    <div className="mt-1 rounded-lg border border-dashed px-3 py-2 text-xs" data-testid="sources">
      <p className="mb-1 flex items-center gap-1.5 font-medium text-muted-foreground">
        <BookOpen className="h-3.5 w-3.5" />
        Sources
      </p>
      <ul className="space-y-0.5">
        {groups.flatMap((group, gi) =>
          group.passages.map((passage) => (
            <li key={`${group.toolCallId}-${passage.ref}`} className="flex gap-1.5">
              <span className="shrink-0 font-mono text-primary">
                {multi ? `S${gi + 1} ` : ""}[{passage.ref}]
              </span>
              <span className="truncate">
                {passage.document}
                <span className="text-muted-foreground"> &middot; chunk {passage.chunkIndex}</span>
              </span>
            </li>
          )),
        )}
      </ul>
    </div>
  );
}

export function MessageBubble({ message, streaming, onApproval }: MessageBubbleProps) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end" data-testid="user-message">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground">
          {textOfMessage(message)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2.5" data-testid="assistant-message">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Sparkles className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        {message.parts.map((part, index) => {
          if (part.type === "text") {
            return part.text ? <Markdown key={index} content={part.text} /> : null;
          }
          if (isToolPart(part)) {
            return <ToolPartCard key={part.toolCallId} part={part} onApproval={onApproval} />;
          }
          return null;
        })}
        {streaming && message.parts.length === 0 && (
          <p className="text-sm text-muted-foreground">Thinking…</p>
        )}
        <SourcesFooter message={message} />
      </div>
    </div>
  );
}

export function MessageList({
  messages,
  status,
  onApproval,
}: {
  messages: UIMessage[];
  status: string;
  onApproval: (approvalId: string, approved: boolean) => void;
}) {
  const last = messages[messages.length - 1];
  const waiting = status === "submitted" && (!last || last.role === "user");

  return (
    <div className={cn("space-y-4")}>
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          streaming={status === "streaming" && message === last}
          onApproval={onApproval}
        />
      ))}
      {waiting && (
        <div className="flex gap-2.5">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <p className="text-sm text-muted-foreground">Thinking…</p>
        </div>
      )}
    </div>
  );
}
