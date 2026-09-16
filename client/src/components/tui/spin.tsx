"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** A small spinner. */
export function Spin({ className, label = "working" }: { className?: string; label?: string }) {
  return <Loader2 role="img" aria-label={label} className={cn("size-4 shrink-0 animate-spin", className)} />;
}
