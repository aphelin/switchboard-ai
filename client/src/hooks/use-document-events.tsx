"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { getDocumentsSSEUrl } from "@/lib/api";
import type { DocumentSseEvent } from "@/lib/types";

const RECONNECT_DELAY_MS = 3000;

/**
 * Subscribes to document ingestion events (`/documents/sse`). Unlike the global
 * generations stream this is only opened by the pages that need it.
 */
export function useDocumentEvents(onEvent: (event: DocumentSseEvent) => void) {
  const [connected, setConnected] = useState(false);
  const handleEvent = useEffectEvent(onEvent);

  useEffect(() => {
    let source: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    function connect() {
      if (disposed) return;
      source = new EventSource(getDocumentsSSEUrl(), { withCredentials: true });
      source.onopen = () => setConnected(true);
      source.onmessage = (message) => {
        try {
          const data = JSON.parse(message.data);
          if (data.type !== "document-update") return;
          handleEvent(data as DocumentSseEvent);
        } catch {
          // ignore malformed events
        }
      };
      source.onerror = () => {
        setConnected(false);
        source?.close();
        source = null;
        timer = setTimeout(connect, RECONNECT_DELAY_MS);
      };
    }

    connect();

    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      source?.close();
    };
  }, []);

  return { connected };
}
