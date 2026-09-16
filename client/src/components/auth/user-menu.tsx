"use client";

import { useState } from "react";
import { Bot, KeyRound, LogOut } from "lucide-react";
import { authClient, isGuestUser } from "@/lib/auth-client";
import { getMe } from "@/lib/api";
import { formatUsd, timeUntil } from "@/lib/format";
import { useModels } from "@/hooks/use-models";
import type { MeResponse } from "@/lib/types";
import { Spin } from "@/components/tui/spin";
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

/** The account avatar: an earth-toned circle with initials that opens usage, keys and sign out. */
export function UserMenu() {
  const { data: session } = authClient.useSession();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [apiKeysOpen, setApiKeysOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { openProviderDialog } = useModels();

  if (!session) return null;
  const { user } = session;
  const guest = isGuestUser(user);

  const refreshUsage = async () => {
    try { setMe(await getMe()); } catch { /* usage is informational */ }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try { await authClient.signOut(); } finally { window.location.reload(); }
  };

  const usage = me?.usage;

  return (
    <>
      <DropdownMenu onOpenChange={(open) => { if (open) void refreshUsage(); }}>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#e9cfae,#b5885f_55%,#5e4128)] text-sm font-bold text-white shadow-[0_8px_20px_-10px_rgba(181,136,95,0.7)] transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
              aria-label="Account menu"
              data-testid="user-menu-trigger"
            />
          }
        >
          {initialsOf(user.name, user.email)}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72" data-testid="user-menu">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="px-3 py-2">
              <span className="block truncate text-[15px] font-bold text-ink">{guest ? "Guest" : user.name}</span>
              <span className="block truncate text-sm" data-testid={guest ? "user-menu-guest" : undefined}>
                {guest ? (me?.guest ? `Demo session · deleted ${timeUntil(me.guest.expiresAt)}` : "Demo session") : user.email}
              </span>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <div className="px-3 pb-2 text-sm text-dim" data-testid="user-usage">
            {usage ? (
              <>
                <span className="block">
                  Today <span className="font-bold text-ink">{formatUsd(usage.spentTodayUsd)}</span>
                  {usage.dailyBudgetUsd !== null ? <> of <span className="font-semibold">{formatUsd(usage.dailyBudgetUsd)}</span> {guest ? "demo budget" : "budget"}</> : " (no limit)"}
                </span>
                {usage.ownKeysSpentTodayUsd > 0 && (
                  <span className="block" data-testid="user-usage-own-keys">
                    Own keys today <span className="font-bold text-ink">{formatUsd(usage.ownKeysSpentTodayUsd)}</span>
                  </span>
                )}
              </>
            ) : (
              <span className="inline-flex items-center gap-2"><Spin className="size-3.5" /> Loading usage</span>
            )}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => openProviderDialog()} data-testid="user-menu-ai-providers">
            <Bot />
            AI providers
          </DropdownMenuItem>
          {!guest && (
            <DropdownMenuItem onClick={() => setApiKeysOpen(true)} data-testid="user-menu-api-keys">
              <KeyRound />
              API keys
            </DropdownMenuItem>
          )}
          <DropdownMenuItem variant="destructive" disabled={signingOut} onClick={() => void handleSignOut()} data-testid="user-menu-sign-out">
            <LogOut />
            {guest ? "End demo" : "Sign out"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ApiKeysDialog open={apiKeysOpen} onOpenChange={setApiKeysOpen} />
    </>
  );
}
