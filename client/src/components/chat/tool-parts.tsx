"use client";

import { useState } from "react";
import { GeneratedImage } from "@/components/generated-image";
import {
  Search,
  Loader2,
  ImageIcon,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  Wrench,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { JobStatus } from "@/lib/constants";
import {
  TOOL_NAMES,
  toolNameOf,
  isToolRunning,
  type ToolPartLike,
} from "@/lib/chat-parts";
import type { GenerateImageToolOutput, SearchToolOutput } from "@/lib/types";

interface ToolPartCardProps {
  part: ToolPartLike;
  onApproval: (approvalId: string, approved: boolean) => void;
}

function ToolFrame({
  icon: Icon,
  title,
  status,
  children,
  collapsible = true,
  defaultOpen = false,
  tone = "default",
}: {
  icon: React.ElementType;
  title: React.ReactNode;
  status?: React.ReactNode;
  children?: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  tone?: "default" | "destructive";
}) {
  const [open, setOpen] = useState(defaultOpen);
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <div
      className={cn(
        "rounded-lg border bg-muted/30 text-xs",
        tone === "destructive" && "border-destructive/40",
      )}
      data-testid="tool-part"
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
        onClick={() => collapsible && setOpen((v) => !v)}
        disabled={!collapsible}
      >
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate font-medium">{title}</span>
        {status}
        {collapsible && children && (
          <Chevron className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
      </button>
      {children && (!collapsible || open) && (
        <div className="border-t px-3 py-2">{children}</div>
      )}
    </div>
  );
}

function SearchToolCard({ part }: { part: ToolPartLike }) {
  const input = part.input as { query?: string } | undefined;
  const output = part.output as SearchToolOutput | undefined;
  const running = isToolRunning(part);

  const status = running ? (
    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
  ) : part.state === "output-error" ? (
    <Badge variant="destructive">failed</Badge>
  ) : output ? (
    <span className="text-muted-foreground">
      {output.passages.length} passage{output.passages.length === 1 ? "" : "s"}
    </span>
  ) : null;

  return (
    <ToolFrame
      icon={Search}
      title={
        <>
          Searched documents
          {input?.query && (
            <span className="font-normal text-muted-foreground"> &middot; &ldquo;{input.query}&rdquo;</span>
          )}
        </>
      }
      status={status}
      tone={part.state === "output-error" ? "destructive" : "default"}
    >
      {part.state === "output-error" ? (
        <p className="text-destructive">{part.errorText}</p>
      ) : output ? (
        output.passages.length === 0 ? (
          <p className="text-muted-foreground">No matching passages.</p>
        ) : (
          <ul className="max-h-64 space-y-2 overflow-y-auto">
            {output.passages.map((passage) => (
              <li key={passage.chunkId} className="rounded-md bg-background p-2">
                <p className="mb-1 flex flex-wrap items-center gap-1.5 font-medium">
                  <span className="rounded bg-primary/10 px-1 font-mono text-primary">[{passage.ref}]</span>
                  <span className="truncate">{passage.document}</span>
                  <span className="text-muted-foreground">chunk {passage.chunkIndex}</span>
                  {passage.untrusted && (
                    <Badge variant="destructive" className="gap-1">
                      <ShieldAlert className="h-3 w-3" />
                      untrusted
                    </Badge>
                  )}
                </p>
                <p className="line-clamp-4 whitespace-pre-wrap text-muted-foreground">
                  {passage.content}
                </p>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </ToolFrame>
  );
}

function ImageToolCard({ part, onApproval }: ToolPartCardProps) {
  const input = part.input as
    | { prompt?: string; model?: string; width?: number; height?: number; seed?: number }
    | undefined;
  const output = part.output as GenerateImageToolOutput | undefined;
  const params = [
    input?.model && `model ${input.model}`,
    input?.width && input?.height && `${input.width}×${input.height}`,
    input?.seed !== undefined && `seed ${input.seed}`,
  ].filter(Boolean);

  let status: React.ReactNode = null;
  let body: React.ReactNode = null;
  let tone: "default" | "destructive" = "default";

  switch (part.state) {
    case "input-streaming":
    case "input-available":
      status = <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />;
      body = <p className="text-muted-foreground">Preparing the image request…</p>;
      break;
    case "approval-requested":
      status = <Badge>needs approval</Badge>;
      body = (
        <div className="space-y-2" data-testid="image-approval">
          <p className="whitespace-pre-wrap">{input?.prompt}</p>
          {params.length > 0 && (
            <p className="text-muted-foreground">{params.join(" · ")}</p>
          )}
          <p className="text-muted-foreground">
            The assistant wants to generate this image. Generating costs credits, so it waits for you.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="gap-1"
              onClick={() => part.approval && onApproval(part.approval.id, true)}
              data-testid="approve-image"
            >
              <Check className="h-3.5 w-3.5" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() => part.approval && onApproval(part.approval.id, false)}
              data-testid="deny-image"
            >
              <X className="h-3.5 w-3.5" />
              Deny
            </Button>
          </div>
        </div>
      );
      break;
    case "approval-responded":
      if (part.approval?.approved) {
        status = <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />;
        body = (
          <p className="text-muted-foreground">
            Approved. Generating the image (this can take up to a minute)…
          </p>
        );
      } else {
        status = <Badge variant="secondary">denied</Badge>;
        body = <p className="text-muted-foreground">You denied this image generation.</p>;
      }
      break;
    case "output-denied":
      status = <Badge variant="secondary">denied</Badge>;
      body = <p className="text-muted-foreground">You denied this image generation.</p>;
      break;
    case "output-error":
      tone = "destructive";
      status = <Badge variant="destructive">failed</Badge>;
      body = <p className="text-destructive">{part.errorText}</p>;
      break;
    case "output-available": {
      const done = output?.status === JobStatus.COMPLETED && output.imageUrl;
      status = done ? (
        <Badge variant="outline">done</Badge>
      ) : (
        <Badge variant={output?.status === JobStatus.FAILED ? "destructive" : "secondary"}>
          {output?.status?.toLowerCase() ?? "unknown"}
        </Badge>
      );
      body = (
        <div className="space-y-2">
          {input?.prompt && <p className="whitespace-pre-wrap text-muted-foreground">{input.prompt}</p>}
          {done && output?.imageUrl ? (
            <GeneratedImage
              src={output.imageUrl}
              alt={input?.prompt ?? "Generated image"}
              width={768}
              height={768}
              sizes="(max-width: 768px) 100vw, 512px"
              className="h-auto w-full max-w-md rounded-lg"
              data-testid="tool-image"
            />
          ) : (
            <p className={output?.error ? "text-destructive" : "text-muted-foreground"}>
              {output?.error ?? output?.note ?? "The image is not available."}
            </p>
          )}
          {output?.generationId && (
            <p className="text-muted-foreground">
              generation <span className="font-mono">{output.generationId.slice(0, 8)}</span>
            </p>
          )}
        </div>
      );
      break;
    }
  }

  return (
    <ToolFrame
      icon={ImageIcon}
      title="Generate image"
      status={status}
      collapsible={false}
      tone={tone}
    >
      {body}
    </ToolFrame>
  );
}

function GenericToolCard({ part }: { part: ToolPartLike }) {
  const name = toolNameOf(part);
  const running = isToolRunning(part);
  const label = name.replace(/_/g, " ");

  const status = running ? (
    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
  ) : part.state === "output-error" ? (
    <Badge variant="destructive">failed</Badge>
  ) : part.state === "output-available" ? (
    <Badge variant="outline">done</Badge>
  ) : null;

  const payload =
    part.state === "output-error"
      ? part.errorText
      : part.state === "output-available"
        ? JSON.stringify(part.output, null, 2)
        : JSON.stringify(part.input ?? {}, null, 2);

  return (
    <ToolFrame
      icon={part.state === "output-error" ? AlertCircle : Wrench}
      title={label}
      status={status}
      tone={part.state === "output-error" ? "destructive" : "default"}
    >
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-muted-foreground">
        {payload && payload.length > 2000 ? `${payload.slice(0, 2000)}…` : payload}
      </pre>
    </ToolFrame>
  );
}

export function ToolPartCard({ part, onApproval }: ToolPartCardProps) {
  switch (toolNameOf(part)) {
    case TOOL_NAMES.SEARCH_DOCUMENTS:
      return <SearchToolCard part={part} />;
    case TOOL_NAMES.GENERATE_IMAGE:
      return <ImageToolCard part={part} onApproval={onApproval} />;
    default:
      return <GenericToolCard part={part} />;
  }
}
