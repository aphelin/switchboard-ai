"use client";

import type { UIMessage } from "ai";
import { Eye } from "lucide-react";
import { Markdown } from "./markdown";
import { ToolPartCard } from "./tool-parts";
import { Orb } from "@/components/tui/logo";
import { collectSources, isImagePart, isToolPart, textOfMessage } from "@/lib/chat-parts";
import { generationIdFromImageUrl } from "@/lib/images";
import { cn } from "@/lib/utils";
import type { SourcePassage } from "@/lib/types";

type ApprovalHandler = (approvalId: string, approved: boolean) => void;
type SourceHandler = (passage: SourcePassage) => void;
type GenerationHandler = (generationId: string) => void;

interface MessageBubbleProps {
  message: UIMessage;
  streaming: boolean;
  /** The chat is no longer running this message: tools still marked running were stopped. */
  stopped: boolean;
  onApproval: ApprovalHandler;
  onOpenSource?: SourceHandler;
  onOpenGeneration?: GenerationHandler;
}

/** The passages a reply cited, listed under it; each opens its document at that passage. */
export function SourcesFooter({ message, onOpenSource }: { message: UIMessage; onOpenSource?: SourceHandler }) {
  const groups = collectSources(message);
  if (groups.length === 0) return null;
  const multi = groups.length > 1;

  return (
    <div className="text-sm" data-testid="sources">
      <p className="mb-1 text-xs font-bold text-dim">Sources</p>
      <ul className="flex flex-col gap-0.5">
        {groups.flatMap((group, gi) =>
          group.passages.map((passage) => {
            const content = (
              <>
                <span className="tag tag-accent">{multi ? `S${gi + 1} ` : ""}[{passage.ref}]</span>
                <span className="min-w-0 truncate">{passage.document}<span className="text-dim"> · chunk {passage.chunkIndex}</span></span>
              </>
            );
            return (
              <li key={`${group.toolCallId}-${passage.ref}`}>
                {onOpenSource ? (
                  <button
                    type="button"
                    className="group -mx-2 flex w-[calc(100%+16px)] min-w-0 items-center gap-2 rounded-xl py-1 pr-2 pl-2 text-left transition-colors hover:bg-white/[0.06]"
                    onClick={() => onOpenSource(passage)}
                    title="Open this passage in its document"
                    data-testid="source-link"
                  >
                    {content}
                    {/* The eye sits in a small well so it reads as a control and keeps clear of the bubble's edge. */}
                    <span className="ml-auto grid size-6 shrink-0 place-items-center rounded-full bg-white/[0.08] text-dim opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true">
                      <Eye className="size-3.5" />
                    </span>
                  </button>
                ) : (
                  <div className="flex min-w-0 items-center gap-2 py-1">{content}</div>
                )}
              </li>
            );
          }),
        )}
      </ul>
    </div>
  );
}

/** A transcript line: the user in a dark pill on the right, the agent beside the mark on the left. */
export function TranscriptLine({ speaker, tone = "you", children, className, ...props }: React.ComponentProps<"div"> & { speaker: string; tone?: "you" | "agent" }) {
  if (tone === "you") {
    return (
      <div className={cn("flex justify-end", className)} {...props}>
        <span className="sr-only">{speaker}:</span>
        <div className="glass-dark max-w-[78%] rounded-[24px] rounded-br-lg px-4.5 py-3 text-[15px] leading-6">{children}</div>
      </div>
    );
  }
  return (
    <div className={cn("flex items-start gap-3", className)} {...props}>
      <Orb size={30} className="mt-1 hidden sm:inline-flex" />
      <span className="sr-only">{speaker}:</span>
      {/* Fits its content up to one measure; everything inside (text, tool cards, sources) shares that width. */}
      <div className="glass-inner w-fit max-w-[min(100%,46rem)] min-w-0 rounded-[24px] rounded-bl-lg px-4 py-3.5 sm:px-4.5">{children}</div>
    </div>
  );
}

const THINKING_CORD = "M5 7 Q16.5 13 28 7 T51 7";

/** The agent is working: a signal crossing a small patch cord. */
export function Thinking({ label = "Thinking" }: { label?: string }) {
  return (
    <span className="thinking" role="status" aria-label={label}>
      <svg viewBox="0 0 56 14" aria-hidden="true">
        <path d={THINKING_CORD} className="wire" />
        <path d={THINKING_CORD} pathLength={1} className="signal" />
        <circle cx="5" cy="7" r="3.2" className="jack" />
        <circle cx="51" cy="7" r="3.2" className="jack jack-end" />
      </svg>
      <span className="label" aria-hidden="true">{label}</span>
    </span>
  );
}

export function MessageBubble({ message, streaming, stopped, onApproval, onOpenSource, onOpenGeneration }: MessageBubbleProps) {
  if (message.role === "user") {
    const images = message.parts.filter(isImagePart);
    const text = textOfMessage(message);
    return (
      <TranscriptLine speaker="You" data-testid="user-message">
        {images.length > 0 && (
          <div className={cn("flex flex-wrap gap-2", text && "mb-2")} data-testid="message-images">
            {images.map((image, index) => {
              const generationId = generationIdFromImageUrl(image.url);
              return generationId && onOpenGeneration ? (
                <button key={`${image.url.slice(-24)}-${index}`} type="button" className="cursor-pointer p-0" onClick={() => onOpenGeneration(generationId)}>
                  <img src={image.url} alt={image.filename ?? "Attached image"} className="max-h-56 max-w-full rounded-2xl object-cover" />
                </button>
              ) : (
                <img key={`${image.url.slice(-24)}-${index}`} src={image.url} alt={image.filename ?? "Attached image"} className="max-h-56 max-w-full rounded-2xl object-cover" />
              );
            })}
          </div>
        )}
        {text && <p className="whitespace-pre-wrap">{text}</p>}
      </TranscriptLine>
    );
  }
  const hasContent = message.parts.some((part) => (part.type === "text" && part.text) || isToolPart(part));
  return (
    <TranscriptLine speaker="Agent" tone="agent" data-testid="assistant-message">
      <div className="flex flex-col gap-3">
        {message.parts.map((part, index) => {
          if (part.type === "text") return part.text ? <Markdown key={index} content={part.text} onOpenGeneration={onOpenGeneration} /> : null;
          if (isToolPart(part)) return <ToolPartCard key={part.toolCallId} part={part} onApproval={onApproval} onOpenSource={onOpenSource} onOpenGeneration={onOpenGeneration} stopped={stopped} />;
          return null;
        })}
        {streaming && !hasContent && <Thinking />}
        <SourcesFooter message={message} onOpenSource={onOpenSource} />
      </div>
    </TranscriptLine>
  );
}

export function MessageList({ messages, status, onApproval, onOpenSource, onOpenGeneration }: { messages: UIMessage[]; status: string; onApproval: ApprovalHandler; onOpenSource?: SourceHandler; onOpenGeneration?: GenerationHandler }) {
  const last = messages[messages.length - 1];
  const live = status === "submitted" || status === "streaming";
  const waiting = status === "submitted" && (!last || last.role === "user");
  return (
    <div className="flex flex-col gap-4">
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          streaming={live && message === last}
          stopped={!live || message !== last}
          onApproval={onApproval}
          onOpenSource={onOpenSource}
          onOpenGeneration={onOpenGeneration}
        />
      ))}
      {waiting && (
        <TranscriptLine speaker="Agent" tone="agent"><Thinking /></TranscriptLine>
      )}
    </div>
  );
}
