"use client";

import { useState } from "react";
import { GeneratedImage } from "@/components/generated-image";
import { Search, ImageIcon, Check, X, ChevronDown, ShieldAlert, Wrench, AlertCircle, CircleStop, Eye, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Spin } from "@/components/tui/spin";
import { cn } from "@/lib/utils";
import { JobStatus } from "@/lib/constants";
import { TOOL_NAMES, toolNameOf, isToolRunning, type ToolPartLike } from "@/lib/chat-parts";
import type { GenerateImageToolOutput, SearchToolOutput, SourcePassage } from "@/lib/types";

interface ToolPartCardProps {
  part: ToolPartLike;
  onApproval: (approvalId: string, approved: boolean) => void;
  /** Opens a retrieved passage inside its document. */
  onOpenSource?: (passage: SourcePassage) => void;
  onOpenGeneration?: (generationId: string) => void;
  /** The response ended (the user pressed stop) while this tool was still running. */
  stopped?: boolean;
}

type Tone = "default" | "destructive" | "ask";

/** A tool call as a card inside the reply, as wide as the reply, with its status on the header line. */
export function ToolFrame({ icon: Icon, title, status, children, collapsible = true, defaultOpen = false, tone = "default" }: {
  icon: React.ElementType; title: React.ReactNode; status?: React.ReactNode; children?: React.ReactNode; collapsible?: boolean; defaultOpen?: boolean; tone?: Tone;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const expandable = collapsible && Boolean(children);
  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-[18px] border border-white/10 bg-white/[0.04] text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
        tone === "destructive" && "border-err/40",
        tone === "ask" && "border-ask/50 bg-ask/[0.04] shadow-[0_18px_44px_-24px_rgba(201,184,255,0.5),inset_0_1px_0_rgba(255,255,255,0.06)]",
      )}
      data-testid="tool-part"
    >
      <button
        type="button"
        className={cn("flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors", expandable ? "hover:bg-white/[0.05]" : "cursor-default")}
        onClick={() => expandable && setOpen((v) => !v)}
        disabled={!expandable}
        aria-expanded={expandable ? open : undefined}
      >
        <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full", tone === "ask" ? "bg-ask/15 text-ask" : tone === "destructive" ? "bg-err/12 text-err" : "bg-white/10 text-ink-2")}>
          <Icon className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1 truncate font-semibold">{title}</span>
        {status}
        {expandable && <ChevronDown className={cn("size-4 shrink-0 text-dim transition-transform duration-200", !open && "-rotate-90")} />}
      </button>
      {children && (!collapsible || open) && <div className="border-t border-white/[0.08] px-3.5 py-3">{children}</div>}
    </div>
  );
}

function StoppedBadge() {
  return <Badge variant="secondary"><CircleStop />Stopped</Badge>;
}

function SearchToolCard({ part, onOpenSource, stopped }: Omit<ToolPartCardProps, "onApproval">) {
  const input = part.input as { query?: string } | undefined;
  const output = part.output as SearchToolOutput | undefined;
  const halted = stopped && isToolRunning(part);
  const status = halted ? <StoppedBadge /> : isToolRunning(part) ? <Spin className="text-dim" /> : part.state === "output-error" ? <Badge variant="destructive">Failed</Badge> : output ? <span className="text-dim">{output.passages.length} passage{output.passages.length === 1 ? "" : "s"}</span> : null;

  return (
    <ToolFrame icon={Search} title={<>Searched documents{input?.query && <span className="font-normal text-dim"> · “{input.query}”</span>}</>} status={status} tone={part.state === "output-error" ? "destructive" : "default"}>
      {part.state === "output-error" ? (
        <p className="text-err">{part.errorText}</p>
      ) : output ? (
        output.passages.length === 0 ? <p className="text-dim">No matching passages.</p> : (
          <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto">
            {output.passages.map((passage) => (
              <li key={passage.chunkId}>
                <button
                  type="button"
                  className="group/passage block w-full rounded-xl bg-white/[0.05] px-3 py-2 text-left transition-colors enabled:hover:bg-white/[0.09] disabled:cursor-default"
                  onClick={() => onOpenSource?.(passage)}
                  disabled={!onOpenSource}
                  title={onOpenSource ? "Open this passage in its document" : undefined}
                  data-testid="passage-link"
                >
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="tag tag-accent">[{passage.ref}]</span>
                    <span className="min-w-0 truncate font-semibold">{passage.document}</span>
                    <span className="text-dim">chunk {passage.chunkIndex}</span>
                    {passage.untrusted && <Badge variant="destructive"><ShieldAlert />Untrusted</Badge>}
                    {onOpenSource && <span className="ml-auto flex items-center gap-1 text-xs font-semibold text-dim transition-colors group-hover/passage:text-ink"><Eye className="size-3.5" />View</span>}
                  </span>
                  <span className="mt-1 line-clamp-4 block whitespace-pre-wrap text-ink-2">{passage.content}</span>
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </ToolFrame>
  );
}

function ImageToolCard({ part, onApproval, onOpenGeneration, stopped, edit = false }: ToolPartCardProps & { edit?: boolean }) {
  const input = part.input as { prompt?: string; model?: string; width?: number; height?: number; seed?: number; generationId?: string; attachmentId?: string } | undefined;
  const output = part.output as GenerateImageToolOutput | undefined;
  const params = [
    edit && input?.generationId && `from image ${input.generationId.slice(0, 8)}`,
    edit && input?.attachmentId && "from attached image",
    input?.model && `model ${input.model}`,
    input?.width && input?.height && `${input.width}×${input.height}`,
    input?.seed !== undefined && `seed ${input.seed}`,
  ].filter(Boolean);
  const verb = edit ? "edit" : "generate";

  let status: React.ReactNode = null;
  let body: React.ReactNode = null;
  let tone: Tone = "default";

  switch (stopped && isToolRunning(part) ? "stopped" : part.state) {
    case "stopped":
      status = <StoppedBadge />;
      body = <p className="text-dim">The response stopped before the image finished, so the job was cancelled.</p>;
      break;
    case "input-streaming":
    case "input-available":
      status = <Spin className="text-dim" />;
      body = <p className="text-dim">Preparing the image request…</p>;
      break;
    case "approval-requested":
      tone = "ask";
      status = <Badge variant="ask">Needs approval</Badge>;
      body = (
        <div className="flex flex-col gap-2" data-testid="image-approval">
          <p className="whitespace-pre-wrap text-[15px] font-medium">{input?.prompt}</p>
          {params.length > 0 && <p className="text-dim">{params.join(" · ")}</p>}
          <p className="text-dim">The agent wants to {verb} this image. It costs credits, so it waits for you.</p>
          <div className="flex gap-2 pt-1">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => part.approval && onApproval(part.approval.id, true)} data-testid="approve-image"><Check /> Approve</button>
            <button type="button" className="btn btn-glass btn-sm" onClick={() => part.approval && onApproval(part.approval.id, false)} data-testid="deny-image"><X /> Deny</button>
          </div>
        </div>
      );
      break;
    case "approval-responded":
      if (part.approval?.approved) { status = <Spin className="text-dim" />; body = <p className="text-dim">Approved. {edit ? "Editing" : "Generating"} the image (this can take up to a minute)…</p>; }
      else { status = <Badge variant="secondary">Denied</Badge>; body = <p className="text-dim">You denied this image {edit ? "edit" : "generation"}.</p>; }
      break;
    case "output-denied":
      status = <Badge variant="secondary">Denied</Badge>;
      body = <p className="text-dim">You denied this image {edit ? "edit" : "generation"}.</p>;
      break;
    case "output-error":
      tone = "destructive";
      status = <Badge variant="destructive">Failed</Badge>;
      body = <p className="text-err">{part.errorText}</p>;
      break;
    case "output-available": {
      const done = output?.status === JobStatus.COMPLETED && output.imageUrl;
      status = done ? <Badge variant="success">Done</Badge> : <Badge variant={output?.status === JobStatus.FAILED ? "destructive" : "secondary"}>{output?.status?.toLowerCase() ?? "unknown"}</Badge>;
      body = (
        <div className="flex flex-col gap-2">
          {input?.prompt && <p className="whitespace-pre-wrap text-ink-2">{input.prompt}</p>}
          {done && output?.imageUrl ? (
            onOpenGeneration && output.generationId ? (
              <button type="button" className="block max-w-md cursor-pointer overflow-hidden rounded-2xl p-0 text-left" onClick={() => onOpenGeneration(output.generationId)} data-testid="tool-image">
                <GeneratedImage src={output.imageUrl} alt={input?.prompt ?? "Generated image"} width={768} height={768} sizes="(max-width: 768px) 100vw, 512px" className="h-auto w-full" />
              </button>
            ) : (
              <GeneratedImage src={output.imageUrl} alt={input?.prompt ?? "Generated image"} width={768} height={768} sizes="(max-width: 768px) 100vw, 512px" className="h-auto w-full max-w-md rounded-2xl" data-testid="tool-image" />
            )
          ) : (
            <p className={output?.error ? "text-err" : "text-dim"}>{output?.error ?? output?.note ?? "The image is not available."}</p>
          )}
          {output?.generationId && <p className="text-dim">generation <span className="data">{output.generationId.slice(0, 8)}</span></p>}
        </div>
      );
      break;
    }
  }

  return <ToolFrame icon={edit ? Wand2 : ImageIcon} title={edit ? "Edit image" : "Generate image"} status={status} collapsible={false} tone={tone}>{body}</ToolFrame>;
}

function GenericToolCard({ part, stopped }: { part: ToolPartLike; stopped?: boolean }) {
  const name = toolNameOf(part);
  const label = name.replace(/_/g, " ");
  const halted = stopped && isToolRunning(part);
  const status = halted ? <StoppedBadge /> : isToolRunning(part) ? <Spin className="text-dim" /> : part.state === "output-error" ? <Badge variant="destructive">Failed</Badge> : part.state === "output-available" ? <Badge variant="success">Done</Badge> : null;
  const payload = part.state === "output-error" ? part.errorText : part.state === "output-available" ? JSON.stringify(part.output, null, 2) : JSON.stringify(part.input ?? {}, null, 2);
  return (
    <ToolFrame icon={part.state === "output-error" ? AlertCircle : Wrench} title={label} status={status} tone={part.state === "output-error" ? "destructive" : "default"}>
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap font-data text-xs leading-5 text-ink-2">{payload && payload.length > 2000 ? `${payload.slice(0, 2000)}…` : payload}</pre>
    </ToolFrame>
  );
}

export function ToolPartCard({ part, onApproval, onOpenSource, onOpenGeneration, stopped }: ToolPartCardProps) {
  switch (toolNameOf(part)) {
    case TOOL_NAMES.SEARCH_DOCUMENTS: return <SearchToolCard part={part} onOpenSource={onOpenSource} stopped={stopped} />;
    case TOOL_NAMES.GENERATE_IMAGE: return <ImageToolCard part={part} onApproval={onApproval} onOpenGeneration={onOpenGeneration} stopped={stopped} />;
    case TOOL_NAMES.EDIT_IMAGE: return <ImageToolCard part={part} onApproval={onApproval} onOpenGeneration={onOpenGeneration} stopped={stopped} edit />;
    default: return <GenericToolCard part={part} stopped={stopped} />;
  }
}
