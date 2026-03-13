"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useCallback,
  useState,
  type ReactNode,
} from "react";
import { getSSEUrl } from "@/lib/api";
import type { SseEvent } from "@/lib/types";

type SseCallback = (event: SseEvent) => void;

interface SseContextValue {
  connected: boolean;
  subscribe: (cb: SseCallback) => () => void;
}

const SseContext = createContext<SseContextValue | null>(null);

export function SseProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const subscribersRef = useRef(new Set<SseCallback>());
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanup = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    cleanup();

    const eventSource = new EventSource(getSSEUrl());
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => setConnected(true);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "ping") return;
        subscribersRef.current.forEach((cb) => cb(data as SseEvent));
      } catch {
        // ignore malformed events
      }
    };

    eventSource.onerror = () => {
      if (eventSourceRef.current !== eventSource) return;
      setConnected(false);
      eventSource.close();
      eventSourceRef.current = null;
      reconnectTimerRef.current = setTimeout(() => connect(), 3000);
    };
  }, [cleanup]);

  useEffect(() => {
    connect();
    return cleanup;
  }, [connect, cleanup]);

  const subscribe = useCallback((cb: SseCallback) => {
    subscribersRef.current.add(cb);
    return () => {
      subscribersRef.current.delete(cb);
    };
  }, []);

  return (
    <SseContext.Provider value={{ connected, subscribe }}>
      {children}
    </SseContext.Provider>
  );
}

export function useSSE(
  onEvent: (event: SseEvent) => void,
  onReconnect?: () => void,
) {
  const ctx = useContext(SseContext);
  if (!ctx) throw new Error("useSSE must be used within SseProvider");

  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const onReconnectRef = useRef(onReconnect);
  onReconnectRef.current = onReconnect;
  const wasConnectedRef = useRef(false);

  useEffect(() => {
    const unsubscribe = ctx.subscribe((event) => {
      onEventRef.current(event);
    });
    return unsubscribe;
  }, [ctx]);

  useEffect(() => {
    if (ctx.connected && wasConnectedRef.current) {
      onReconnectRef.current?.();
    }
    wasConnectedRef.current = true;
  }, [ctx.connected]);

  return { connected: ctx.connected };
}
