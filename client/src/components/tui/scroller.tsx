"use client";

import { useRef } from "react";
import { useDragScroll } from "@/hooks/use-drag-scroll";
import { cn } from "@/lib/utils";

/**
 * A scroll box that also pans with the mouse: press on the content and drag, instead of
 * finding the scrollbar. The cursor shows a hand only while there is something to scroll.
 */
export function Scroller({ className, children, ...props }: React.ComponentProps<"div">) {
  const ref = useRef<HTMLDivElement>(null);
  useDragScroll(ref);
  return (
    <div ref={ref} className={cn("drag-scroll", className)} {...props}>
      {children}
    </div>
  );
}
