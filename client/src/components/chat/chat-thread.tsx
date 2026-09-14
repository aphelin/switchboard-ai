"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type UIMessage,
} from "ai";
import { Send, Square, MessageSquare, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageList } from "./message-bubble";
import { getChatUrl } from "@/lib/api";
import { toast } from "sonner";

interface ChatThreadProps {
  conversationId: string;
  initialMessages: UIMessage[];
  /** Documents the assistant may search (empty = all). */
  documentIds: string[];
  onResponseFinished?: () => void;
}

const SUGGESTIONS = [
  "What is the Enterprise support SLA?",
  "Summarise the remote work policy in three bullets.",
  "Which documents do you have access to?",
  "Generate an image of a red lighthouse at sunrise.",
];

export function ChatThread({
  conversationId,
  initialMessages,
  documentIds,
  onResponseFinished,
}: ChatThreadProps) {
  const transport = useMemo(
    () => new DefaultChatTransport({ api: getChatUrl() }),
    [],
  );
  // The document scope can change mid-conversation, so it is sent per request.
  const requestOptions = { body: { documentIds } };

  const {
    messages,
    sendMessage,
    status,
    error,
    stop,
    regenerate,
    clearError,
    addToolApprovalResponse,
  } = useChat({
    id: conversationId,
    messages: initialMessages,
    transport,
    // After the user approves/denies a tool call, resume the run automatically.
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    onFinish: () => onResponseFinished?.(),
    onError: (err) => toast.error(err.message),
  });

  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status]);

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    sendMessage({ text: trimmed }, requestOptions);
    setInput("");
  };

  const handleApproval = (approvalId: string, approved: boolean) => {
    addToolApprovalResponse({ id: approvalId, approved, options: requestOptions });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4" data-testid="chat-messages">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <MessageSquare className="h-10 w-10 text-muted-foreground/50" />
            <div>
              <p className="font-medium">Ask about your documents</p>
              <p className="text-sm text-muted-foreground">
                The assistant searches the knowledge base, cites what it used, and can
                generate images with your approval.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <Button
                  key={suggestion}
                  variant="outline"
                  size="sm"
                  onClick={() => submit(suggestion)}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <MessageList messages={messages} status={status} onApproval={handleApproval} />
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <div className="mx-4 mb-2 flex items-center justify-between gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <span className="truncate">{error.message}</span>
          <div className="flex shrink-0 gap-1">
            <Button variant="ghost" size="xs" className="gap-1" onClick={() => regenerate(requestOptions)}>
              <RotateCcw className="h-3 w-3" />
              Retry
            </Button>
            <Button variant="ghost" size="xs" onClick={clearError}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      <form
        className="flex items-end gap-2 border-t p-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(input);
            }
          }}
          placeholder="Ask a question, or ask for an image… (Enter to send, Shift+Enter for a new line)"
          rows={2}
          className="min-h-[44px] max-h-40 resize-none"
          data-testid="chat-input"
        />
        {busy ? (
          <Button type="button" variant="outline" onClick={stop} className="gap-1.5" data-testid="chat-stop">
            <Square className="h-3.5 w-3.5" />
            Stop
          </Button>
        ) : (
          <Button type="submit" disabled={!input.trim()} className="gap-1.5" data-testid="chat-send">
            <Send className="h-3.5 w-3.5" />
            Send
          </Button>
        )}
      </form>
    </div>
  );
}
