import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeadingProps {
  title: ReactNode;
  sub?: ReactNode;
  /** Chips, pickers or actions on the right. */
  aside?: ReactNode;
  className?: string;
}

/** The window heading: a large friendly title with an optional right-hand slot. */
export function PageHeading({ title, sub, aside, className }: PageHeadingProps) {
  return (
    <div className={cn("mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3", className)}>
      <div className="min-w-0">
        <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">{title}</h1>
        {sub && <p className="mt-1 max-w-[60ch] text-[15px] text-ink-2">{sub}</p>}
      </div>
      {aside && <div className="flex flex-wrap items-center gap-2">{aside}</div>}
    </div>
  );
}
