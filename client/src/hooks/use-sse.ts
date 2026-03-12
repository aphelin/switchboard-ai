"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { getSSEUrl } from "@/lib/api";
import type { SseEvent } from "@/lib/types";

export function useSSE(
  onEvent: (event: SseEvent) => void,
  onReconnect?: () => void,
) {
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const onReconnectRef = useRef(onReconnect);
  onReconnectRef.current = onReconnect;
  const hasConnectedRef = useRef(false);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(getSSEUrl());
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setConnected(true);
      if (hasConnectedRef.current) {
        onReconnectRef.current?.();
      }
      hasConnectedRef.current = true;
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "ping") return;
        onEventRef.current(data as SseEvent);
      } catch {
        // ignore malformed events
      }
    };

    eventSource.onerror = () => {
      setConnected(false);
      eventSource.close();
      setTimeout(() => connect(), 3000);
    };
  }, []);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const start = () => {
      connect();
      cleanup = () => eventSourceRef.current?.close();
    };

    if (typeof document !== "undefined" && document.readyState !== "complete") {
      window.addEventListener("load", start, { once: true });
      return () => {
        window.removeEventListener("load", start);
        cleanup?.();
      };
    }

    start();
    return () => cleanup?.();
  }, [connect]);

  return { connected };
}
