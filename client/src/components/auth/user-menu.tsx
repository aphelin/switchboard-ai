"use client";

import { useState } from "react";
import { KeyRound, LogOut, Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { getMe } from "@/lib/api";
import type { MeResponse } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ApiKeysDialog } from "./api-keys-dialog";

function initialsOf(name: string | undefined, email: string | undefined): string {
  const source = name?.trim() || email || "?";
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : source.slice(0, 2);
  return letters.toUpperCase();
}

function formatUsd(value: number): string {
  return `$${value < 0.01 && value > 0 ? value.toFixed(4) : value.toFixed(2)}`;
}

export function UserMenu() {
  const { data: session } = authClient.useSession();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [apiKeysOpen, setApiKeysOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  if (!session) return null;
  const { user } = session;

  const refreshUsage = async () => {
    try {
      setMe(await getMe());
    } catch {
      // usage is informational; the menu still works without it
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await authClient.signOut();
    } finally {
      // Full reload so no state from this user survives in memory.
      window.location.reload();
    }
  };

  const usage = me?.usage;

  return (
    <>
      <DropdownMenu
        onOpenChange={(open) => {
          if (open) void refreshUsage();
        }}
      >
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full"
              aria-label="Account menu"
              data-testid="user-menu-trigger"
            />
          }
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {initialsOf(user.name, user.email)}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64" data-testid="user-menu">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="space-y-0.5 px-2 py-1.5">
              <span className="block truncate text-sm font-medium text-foreground">
                {user.name}
              </span>
              <span className="block truncate text-xs font-normal">{user.email}</span>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <div className="px-2 pb-1.5 text-xs text-muted-foreground" data-testid="user-usage">
            {usage ? (
              <>
                Today: <span className="font-mono text-foreground">{formatUsd(usage.spentTodayUsd)}</span>
                {usage.dailyBudgetUsd !== null ? (
                  <>
                    {" "}of <span className="font-mono">{formatUsd(usage.dailyBudgetUsd)}</span>
                  </>
                ) : (
                  " (no limit)"
                )}
              </>
            ) : (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading usage…
              </span>
            )}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setApiKeysOpen(true)} data-testid="user-menu-api-keys">
            <KeyRound />
            API keys
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            disabled={signingOut}
            onClick={() => void handleSignOut()}
            data-testid="user-menu-sign-out"
          >
            <LogOut />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ApiKeysDialog open={apiKeysOpen} onOpenChange={setApiKeysOpen} />
    </>
  );
}
