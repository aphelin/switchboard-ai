"use client";

import { useEffect, useState } from "react";
import { getDemoStatus } from "@/lib/api";
import type { DemoStatus } from "@/lib/types";

// One request per page load, shared by every demo button on the landing.
let request: Promise<DemoStatus | null> | null = null;

/** Whether the one-click demo is open; null while loading or when the API can't be reached. */
export function useDemoStatus(): DemoStatus | null {
  const [status, setStatus] = useState<DemoStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    request ??= getDemoStatus().catch(() => {
      request = null;
      return null;
    });
    void request.then((result) => {
      if (!cancelled) setStatus(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}

/** "24 hours", or "a day" before the status has loaded. */
export function demoLifetime(status: DemoStatus | null): string {
  if (!status) return "a day";
  return status.guestTtlHours === 1 ? "an hour" : `${status.guestTtlHours} hours`;
}
