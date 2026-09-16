"use client";

import { ImageIcon, Type, Ban, RotateCcw } from "lucide-react";
import { GeneratedImage } from "@/components/generated-image";
import { StatusBadge } from "./status-badge";
import { PriorityBadge } from "./priority-badge";
import { GenerationType, JobStatus } from "@/lib/constants";
import { formatClock } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Generation } from "@/lib/types";

interface GenerationRowProps {
  generation: Generation;
  modelLabel?: string;
  onOpen?: (generation: Generation) => void;
  onCancel?: (generation: Generation) => void;
  onRetry?: (generation: Generation) => void;
  busy?: boolean;
  /** Animate the row sliding in (new jobs). */
  printIn?: boolean;
  className?: string;
}

function isActive(status: JobStatus): boolean {
  return status === JobStatus.PENDING || status === JobStatus.GENERATING;
}
function isRetryable(status: JobStatus): boolean {
  return status === JobStatus.FAILED || status === JobStatus.CANCELLED;
}

/** One job as one row: a cover thumbnail, the prompt, its status and actions. */
export function GenerationRow({ generation, modelLabel, onOpen, onCancel, onRetry, busy, printIn, className }: GenerationRowProps) {
  const isImage = generation.type === GenerationType.IMAGE;
  const done = generation.status === JobStatus.COMPLETED;
  const clickable = Boolean(onOpen);

  return (
    <div
      className={cn(
        "group flex items-center gap-3.5 rounded-[20px] px-3 py-2.5 transition-colors",
        clickable && "cursor-pointer hover:bg-white/8 focus-visible:bg-white/8 focus-visible:outline-2 focus-visible:outline-accent",
        printIn && "animate-[reveal-row_420ms_cubic-bezier(0.2,0.8,0.2,1)_both]",
        className,
      )}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? () => onOpen?.(generation) : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen?.(generation); } } : undefined}
      data-testid="generation-row"
      data-status={generation.status}
    >
      <div className={cn("cover relative size-12 shrink-0 rounded-2xl", isActive(generation.status) && "cover-live")} data-cover={isImage ? "generate" : "chat"}>
        {isImage && done && generation.imageUrl ? (
          <GeneratedImage src={generation.imageUrl} alt="" fill sizes="48px" className="object-cover" />
        ) : (
          <span className="flex h-full items-center justify-center text-white/70">
            {isImage ? <ImageIcon className="size-5" /> : <Type className="size-5" />}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold" title={generation.prompt}>{generation.prompt}</p>
        <p className="flex min-w-0 items-center gap-2 text-xs text-dim">
          {modelLabel && <span className="truncate">{modelLabel}</span>}
          <time dateTime={generation.createdAt} className="shrink-0 whitespace-nowrap" suppressHydrationWarning>{formatClock(generation.createdAt)}</time>
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <PriorityBadge priority={generation.priority} className="hidden sm:inline-flex" />
        <StatusBadge status={generation.status} className="text-[13px]" />
        {onCancel && isActive(generation.status) && (
          <button type="button" className="btn btn-ghost btn-icon btn-xs" disabled={busy} title="Cancel" aria-label="Cancel job"
            onClick={(e) => { e.stopPropagation(); onCancel(generation); }}>
            <Ban />
          </button>
        )}
        {onRetry && isRetryable(generation.status) && (
          <button type="button" className="btn btn-ghost btn-icon btn-xs" disabled={busy} title="Retry" aria-label="Retry job"
            onClick={(e) => { e.stopPropagation(); onRetry(generation); }}>
            <RotateCcw />
          </button>
        )}
      </div>
    </div>
  );
}
