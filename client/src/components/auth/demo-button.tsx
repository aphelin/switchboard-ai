"use client";

import { useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { WELCOME_PATH } from "@/lib/site";
import { useDemoStatus } from "@/hooks/use-demo-status";
import { Spin } from "@/components/tui/spin";
import { cn } from "@/lib/utils";

interface DemoButtonProps {
  size?: "sm" | "lg";
  label?: string;
  /** Rendered instead when the server has the demo turned off. */
  fallback?: ReactNode;
  className?: string;
}

/**
 * Opens a guest session in one click. The server gives the guest a private copy
 * of a real session (documents, generations, chats, traces) before it answers,
 * so the app opens with data in place.
 */
export function DemoButton({ size = "lg", label = "Try the live demo", fallback = null, className }: DemoButtonProps) {
  const status = useDemoStatus();
  const router = useRouter();
  const pathname = usePathname();
  const [starting, setStarting] = useState(false);

  if (status && !status.enabled) return <>{fallback}</>;

  const start = async () => {
    setStarting(true);
    try {
      const { error } = await authClient.signIn.anonymous();
      if (error) {
        toast.error("Couldn't start the demo", { description: error.message || error.statusText || "Try again in a moment." });
        return;
      }
      // Every other route turns into the app as soon as the session exists; the welcome page always shows the landing.
      if (pathname === WELCOME_PATH) router.push("/");
    } catch {
      toast.error("Couldn't reach the server", { description: "Try again in a moment." });
    } finally {
      setStarting(false);
    }
  };

  return (
    <button
      type="button"
      className={cn("btn btn-primary", size === "lg" ? "btn-lg" : "btn-sm", className)}
      onClick={() => void start()}
      disabled={starting}
      aria-busy={starting}
      data-testid="demo-start"
    >
      {starting ? <Spin /> : null}
      {starting ? "Preparing your demo…" : label}
      {!starting && <ArrowRight />}
    </button>
  );
}
