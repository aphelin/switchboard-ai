import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type PaneTone = "default" | "active" | "ask" | "err" | "ink";

interface PaneProps extends Omit<React.ComponentProps<"section">, "title"> {
  title?: ReactNode;
  /** Right-hand text on the header row: a count, a status, a hint. */
  legend?: ReactNode;
  tone?: PaneTone;
  /** No body padding: the content draws its own rows. */
  flush?: boolean;
  dashed?: boolean;
  tight?: boolean;
  titleAs?: "h1" | "h2" | "h3" | "div";
}

/** A frosted-glass card with an optional header row. */
export function Pane({
  title,
  legend,
  tone = "default",
  flush,
  dashed,
  tight,
  titleAs: TitleTag = "h2",
  className,
  children,
  ...props
}: PaneProps) {
  const hasHeader = title != null || legend != null;
  return (
    <section
      data-slot="pane"
      data-tone={tone}
      className={cn(
        "glass flex flex-col",
        tone === "active" && "ring-1 ring-accent/30 shadow-[0_24px_60px_-24px_rgba(134,236,191,0.35)]",
        tone === "ask" && "ring-1 ring-ask/40",
        tone === "err" && "ring-1 ring-err/40",
        tone === "ink" && "glass-dark",
        dashed && "border-dashed border-white/20 bg-white/4",
        className,
      )}
      {...props}
    >
      {/* The legend wraps under the title on narrow cards instead of squeezing it to an ellipsis. */}
      {hasHeader && (
        <div className={cn("flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-6 pt-5", tight && "px-5 pt-4")}>
          {title != null && (
            <TitleTag className={cn("min-w-0 max-w-full truncate text-lg font-bold tracking-tight", tone === "ink" && "text-white")}>
              {title}
            </TitleTag>
          )}
          {legend != null && (
            <div className={cn("shrink-0 text-sm font-medium", tone === "ink" ? "text-ground/60" : "text-dim")}>{legend}</div>
          )}
        </div>
      )}
      <div className={cn(flush ? "min-h-0 flex-1" : tight ? "px-5 pt-3 pb-4" : "px-6 pt-4 pb-6", !hasHeader && !flush && (tight ? "pt-4" : "pt-6"))}>
        {children}
      </div>
    </section>
  );
}

/** A small muted label with a hairline, for sub-sections inside a card. */
export function PaneRule({ label, className }: { label: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 text-xs font-bold text-dim", className)} role="separator">
      <span className="shrink-0">{label}</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
