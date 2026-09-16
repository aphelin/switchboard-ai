import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface GhostRowsProps {
  rows?: number;
  /** Empty-state text; when set, a quiet note replaces the rows. */
  label?: ReactNode;
  className?: string;
}

/** Shimmering placeholder rows while loading; with a label, a quiet empty note instead. */
export function GhostRows({ rows = 3, label, className }: GhostRowsProps) {
  return (
    label ? (
      <p className={cn("glass-inner flex min-h-24 items-center justify-center rounded-[14px] px-5 py-6 text-center text-sm font-medium text-dim", className)} data-slot="empty-note">
        {label}
      </p>
    ) : (
      <div className={cn("flex flex-col gap-2.5", className)} aria-hidden="true" data-slot="ghost-rows">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="shimmer h-11" style={{ opacity: 1 - i * 0.18 }} />
        ))}
      </div>
    )
  );
}
