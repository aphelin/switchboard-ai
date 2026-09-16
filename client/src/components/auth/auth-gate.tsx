"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { onUnauthorized } from "@/lib/auth-events";
import { WELCOME_PATH } from "@/lib/site";
import { SseProvider } from "@/hooks/use-sse";
import { ModelsProvider } from "@/hooks/use-models";
import { SessionFrame } from "@/components/layout/session-frame";
import { Landing } from "@/components/landing/landing";
import { Orb } from "@/components/tui/logo";

/**
 * Renders the app only for signed-in users. Without a session every route shows
 * the landing page with its inline sign-in card, and nothing behind it mounts.
 * `/welcome` always renders the landing, signed in or not.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data: session, isPending, refetch } = authClient.useSession();

  useEffect(() => onUnauthorized(() => void refetch()), [refetch]);

  if (pathname === WELCOME_PATH) return <>{children}</>;

  if (isPending && !session) {
    return (
      <div className="flex min-h-dvh items-center justify-center" data-testid="auth-loading">
        <Orb size={56} breathe />
      </div>
    );
  }

  if (!session) {
    return (
      <div data-testid="auth-signed-out">
        <Landing />
      </div>
    );
  }

  return (
    <SseProvider>
      <ModelsProvider>
        <SessionFrame>{children}</SessionFrame>
      </ModelsProvider>
    </SseProvider>
  );
}
