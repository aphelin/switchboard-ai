import { cn } from "@/lib/utils";
import { Spin } from "./spin";

export type MarkTone = "ok" | "err" | "warn" | "ask" | "info" | "dim" | "ink";

interface MarkProps extends React.ComponentProps<"span"> {
  tone?: MarkTone;
  shape?: "solid" | "hollow" | "none";
  /** Replace the dot with a spinner. */
  spinning?: boolean;
  /** Pulse the dot. */
  live?: boolean;
}

/** A status: a coloured dot (or spinner) and a word. */
export function Mark({ tone = "ink", shape = "solid", spinning, live, className, children, ...props }: MarkProps) {
  return (
    <span
      className={cn("status", `status-${tone}`, className)}
      data-shape={spinning ? "none" : shape}
      data-live={live ? "" : undefined}
      {...props}
    >
      {spinning && <Spin className="size-3.5" />}
      {children}
    </span>
  );
}
