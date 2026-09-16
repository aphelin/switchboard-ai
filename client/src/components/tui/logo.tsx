import { cn } from "@/lib/utils";

interface OrbProps extends React.ComponentProps<"span"> {
  size?: number;
  /** Send a signal along the cord. */
  breathe?: boolean;
  float?: boolean;
}

/* One patch cord bent into an S, plugged into two jacks: a call routed across the board. */
const CORD = "M22.5 8H14a4 4 0 0 0 0 8h4a4 4 0 0 1 0 8H9.5";

/** The mark: a glass tile holding an S-shaped patch cord between two jacks. (Named Orb for older imports.) */
export function Orb({ size = 28, breathe, float: _float, className, style, ...props }: OrbProps) {
  void _float;
  return (
    <span
      aria-hidden="true"
      className={cn("mark-tile shrink-0", className)}
      data-live={breathe ? "" : undefined}
      style={{ width: size, height: size, ...style }}
      {...props}
    >
      <svg viewBox="0 0 32 32" fill="none" className="mark-glyph">
        <path d={CORD} className="mark-cord" />
        <path d={CORD} pathLength={1} className="mark-signal" />
        <circle cx="22.5" cy="8" r="2.6" className="mark-jack" />
        <circle cx="9.5" cy="24" r="2.6" className="mark-jack" />
      </svg>
    </span>
  );
}

export function LogoMark({ size = 16, className }: { size?: number; className?: string }) {
  return <Orb size={size} className={className} />;
}

/** The wordmark: "Switchboard" with a small AI tag. */
export function Wordmark({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-bold tracking-tight whitespace-nowrap", className)} {...props}>
      <span>Switchboard</span>
      <span className="tag tag-accent" style={{ height: "1.4em", fontSize: "0.5em", padding: "0 0.6em" }}>
        AI
      </span>
    </span>
  );
}
