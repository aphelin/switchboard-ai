"use client";

import {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
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

const RECONNECT_DELAY_MS = 3000;

export function SseProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const subscribersRef = useRef(new Set<SseCallback>());

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    function connect() {
      if (disposed) return;
      eventSource = new EventSource(getSSEUrl());

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
        setConnected(false);
        eventSource?.close();
        eventSource = null;
        reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
      };
    }

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      eventSource?.close();
    };
  }, []);

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

  const handleEvent = useEffectEvent(onEvent);
  const handleReconnect = useEffectEvent(() => onReconnect?.());
  const wasConnectedRef = useRef(false);

  useEffect(() => {
    const unsubscribe = ctx.subscribe((event) => {
      handleEvent(event);
    });
    return unsubscribe;
  }, [ctx]);

  useEffect(() => {
    if (ctx.connected && wasConnectedRef.current) {
      handleReconnect();
    }
    wasConnectedRef.current = true;
  }, [ctx.connected]);

  return { connected: ctx.connected };
}
