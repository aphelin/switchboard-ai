"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Sparkles, Image as ImageIcon, Clock, FileText, MessageSquare, Activity, Bot, KeyRound, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { SESSION_LABEL, WELCOME_PATH, WINDOWS } from "@/lib/site";
import { useSseConnected } from "@/hooks/use-sse";
import { useModels } from "@/hooks/use-models";
import { authClient, isGuestUser } from "@/lib/auth-client";
import { getMe } from "@/lib/api";
import { formatUsd, timeUntil } from "@/lib/format";
import type { MeResponse } from "@/lib/types";
import { Orb, Wordmark } from "@/components/tui/logo";
import { UserMenu } from "@/components/auth/user-menu";
import { ApiKeysDialog } from "@/components/auth/api-keys-dialog";

const PROMPT_SELECTOR = "[data-prompt]";
const SIDEBAR_KEY = "switchboard.sidebar";

const ICONS: Record<string, React.ElementType> = {
  "/": Sparkles,
  "/gallery": ImageIcon,
  "/history": Clock,
  "/documents": FileText,
  "/chat": MessageSquare,
  "/traces": Activity,
};

const LABELS: Record<string, string> = {
  "/": "Generate",
  "/gallery": "Gallery",
  "/history": "History",
  "/documents": "Documents",
  "/chat": "Chat",
  "/traces": "Traces",
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable || target.closest("[role=dialog],[role=menu],[role=listbox]") !== null;
}

/* The collapsed flag lives in localStorage and is read as an external store, so the server renders it open and the client corrects once. */
const sidebarListeners = new Set<() => void>();
function readSidebarCollapsed(): boolean {
  try { return window.localStorage.getItem(SIDEBAR_KEY) === "collapsed"; } catch { return false; }
}
function subscribeSidebar(listener: () => void) {
  sidebarListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => { sidebarListeners.delete(listener); window.removeEventListener("storage", listener); };
}
function writeSidebarCollapsed(next: boolean) {
  try { window.localStorage.setItem(SIDEBAR_KEY, next ? "collapsed" : "open"); } catch { /* storage unavailable: the rail stays as it is */ }
  sidebarListeners.forEach((listener) => listener());
}

/**
 * Whether the sidebar is folded to an icon rail, a toggle, and whether the fold should animate.
 * The first paint restores a remembered fold without motion; only a toggle in this session animates.
 */
function useSidebarCollapsed(): [boolean, () => void, boolean] {
  const collapsed = useSyncExternalStore(subscribeSidebar, readSidebarCollapsed, () => false);
  const [animate, setAnimate] = useState(false);
  const toggle = useCallback(() => { setAnimate(true); writeSidebarCollapsed(!readSidebarCollapsed()); }, []);
  return [collapsed, toggle, animate];
}

/** Today's spend against the daily budget. Collapses to a small tile in the rail. */
function UsageMeter({ compact }: { compact?: boolean }) {
  const [me, setMe] = useState<MeResponse | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = () => getMe().then((data) => { if (!cancelled) setMe(data); }).catch(() => undefined);
    load();
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => { cancelled = true; window.removeEventListener("focus", onFocus); };
  }, []);
  const usage = me?.usage;
  const ratio = usage?.dailyBudgetUsd ? Math.min(1, usage.spentTodayUsd / usage.dailyBudgetUsd) : 0;
  const budget = usage ? (usage.dailyBudgetUsd !== null ? `of ${formatUsd(usage.dailyBudgetUsd)} ${me?.guest ? "demo" : "daily"} budget` : "no daily limit") : "loading budget";
  const expiry = me?.guest ? `Demo data deleted ${timeUntil(me.guest.expiresAt)}` : null;

  if (compact) {
    return (
      <div className="glass-inner flex flex-col items-center gap-2 px-2 py-3" data-testid="usage-meter" title={`Today ${usage ? formatUsd(usage.spentTodayUsd) : "—"} ${budget}${expiry ? `. ${expiry}` : ""}`}>
        <span className="num-tab text-xs">{usage ? formatUsd(usage.spentTodayUsd) : "—"}</span>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-[linear-gradient(90deg,#a9f3d3,#86ecbf)]" style={{ width: `${Math.max(6, ratio * 100)}%` }} />
        </div>
      </div>
    );
  }

  return (
    <div className="glass-inner p-4" data-testid="usage-meter">
      <p className="flex items-baseline justify-between text-sm">
        <span className="font-bold">Today</span>
        <span className="num-tab text-base">{usage ? formatUsd(usage.spentTodayUsd) : "—"}</span>
      </p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-[linear-gradient(90deg,#a9f3d3,#86ecbf)] transition-[width] duration-500" style={{ width: `${Math.max(4, ratio * 100)}%` }} />
      </div>
      <p className="mt-2 text-xs text-dim">
        {budget}
        {usage && usage.ownKeysSpentTodayUsd > 0 && ` · own keys ${formatUsd(usage.ownKeysSpentTodayUsd)}`}
      </p>
      {expiry && <p className="mt-1 text-xs text-dim" data-testid="guest-expiry">{expiry}</p>}
    </div>
  );
}

/** Icon plus a label that folds away with the rail; the hint keycap shows on hover. */
function RailItemBody({ icon: Icon, label, hint }: { icon: React.ElementType; label: string; hint?: string }) {
  return (
    <>
      <Icon aria-hidden="true" />
      <span className="rail-label">
        <span className="name">{label}</span>
        {hint && <span className="key" aria-hidden="true">{hint}</span>}
      </span>
    </>
  );
}

/** A section label in the rail: folds to nothing when the rail is collapsed. */
function RailSection({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="rail-fold">
      <p className={cn("px-3 pb-2 text-xs font-bold text-dim", className)}>{children}</p>
    </div>
  );
}

/**
 * The session shell: a floating sidebar on desktop that collapses to an icon
 * rail, a pill tab bar on phones, a top bar with the live indicator and the
 * account avatar. Digits 0 to 5 switch windows, `/` focuses the prompt, `[`
 * toggles the sidebar, `?` opens the welcome page.
 */
export function SessionFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const connected = useSseConnected();
  const { openProviderDialog } = useModels();
  const { data: session } = authClient.useSession();
  const guest = isGuestUser(session?.user);
  const signOutLabel = guest ? "End demo" : "Sign out";
  const [apiKeysOpen, setApiKeysOpen] = useState(false);
  const [collapsed, toggleCollapsed, animateRail] = useSidebarCollapsed();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      const window = WINDOWS.find((w) => w.key === event.key);
      if (window) { event.preventDefault(); router.push(window.href); return; }
      if (event.key === "/") {
        const prompt = document.querySelector<HTMLElement>(PROMPT_SELECTOR);
        if (prompt) { event.preventDefault(); prompt.focus(); }
        return;
      }
      if (event.key === "[") { event.preventDefault(); toggleCollapsed(); return; }
      if (event.key === "?") { event.preventDefault(); router.push(WELCOME_PATH); }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [router, toggleCollapsed]);

  const signOut = async () => {
    try { await authClient.signOut(); } finally { window.location.reload(); }
  };

  return (
    <div className="min-h-dvh" data-sidebar={collapsed ? "collapsed" : "open"} data-rail-animate={animateRail ? "" : undefined}>
      <aside className="glass rail fixed top-5 bottom-5 left-5 z-40 hidden flex-col lg:flex" aria-label="Session">
        <button
          type="button"
          className="rail-handle"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          title={`${collapsed ? "Expand" : "Collapse"} sidebar ([)`}
          data-collapsed={collapsed ? "" : undefined}
        >
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M9.75 4.5 6.25 8l3.5 3.5" />
          </svg>
        </button>
        <Link href="/" className="rail-item rail-brand" aria-label={`${SESSION_LABEL} home`}>
          <Orb size={34} />
          <span className="rail-label"><Wordmark /></span>
        </Link>

        <RailSection className="pt-5">Windows</RailSection>
        <nav aria-label="Windows" className="rail-nav flex flex-col gap-1">
          {WINDOWS.map((window) => {
            const active = pathname === window.href;
            return (
              <Link
                key={window.href}
                href={window.href}
                aria-current={active ? "page" : undefined}
                title={collapsed ? `${LABELS[window.href]} (${window.key})` : undefined}
                className="rail-item"
              >
                <RailItemBody icon={ICONS[window.href]} label={LABELS[window.href]} hint={window.key} />
              </Link>
            );
          })}
        </nav>

        <RailSection className="pt-6">Others</RailSection>
        <div className="rail-others flex flex-col gap-1">
          <button type="button" className="rail-item" onClick={() => openProviderDialog()} title={collapsed ? "AI providers" : undefined}>
            <RailItemBody icon={Bot} label="AI providers" />
          </button>
          {/* Guests can't create API keys: an MCP client would outlive a session that is deleted within a day. */}
          {!guest && (
            <button type="button" className="rail-item" onClick={() => setApiKeysOpen(true)} title={collapsed ? "API keys" : undefined}>
              <RailItemBody icon={KeyRound} label="API keys" />
            </button>
          )}
          <button type="button" className="rail-item" data-tone="danger" onClick={() => void signOut()} title={collapsed ? signOutLabel : undefined}>
            <RailItemBody icon={LogOut} label={signOutLabel} />
          </button>
        </div>

        <div className="mt-auto w-full">
          {/* Keyed on the fold so the other variant fades in instead of snapping. */}
          <div key={collapsed ? "compact" : "full"} className="rail-meter">
            <UsageMeter compact={collapsed} />
          </div>
        </div>
      </aside>

      <div className="rail-offset min-w-0">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-2 px-4 pt-4 pb-3 sm:gap-3 sm:px-5 lg:px-8 lg:pt-5">
          <Link href="/" className="flex min-w-0 items-center gap-2.5 text-base lg:invisible" aria-label={`${SESSION_LABEL} home`}>
            <Orb size={28} />
            {/* Phones under 400px keep the orb only, so the status chips and avatar fit beside it. */}
            <span className="hidden min-[400px]:contents"><Wordmark /></span>
          </Link>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <span className={cn("chip chip-sm pointer-events-none", connected ? "text-ok" : "text-dim")} data-testid="sse-status">
              <span className={cn("size-2 rounded-full", connected ? "bg-ok animate-pulse-soft" : "bg-dim")} aria-hidden="true" />
              {connected ? "Live" : "Reconnecting"}
            </span>
            {guest && (
              <span className="chip chip-sm pointer-events-none text-accent" data-testid="guest-badge" title="A private sandbox on the free models, deleted after a day">
                Demo<span className="hidden sm:inline">&nbsp;session</span>
              </span>
            )}
            <Link href={WELCOME_PATH} className="chip chip-sm hidden sm:inline-flex">
              Welcome
            </Link>
            <UserMenu />
          </div>
        </header>

        <main className="px-5 pb-32 lg:px-8 lg:pb-12">{children}</main>
      </div>

      <nav aria-label="Windows" className="glass glass-strong glass-blur fixed right-4 bottom-4 left-4 z-40 flex h-16 items-center justify-around rounded-full px-2 lg:hidden">
        {WINDOWS.map((window) => {
          const active = pathname === window.href;
          const Icon = ICONS[window.href];
          return (
            <Link
              key={window.href}
              href={window.href}
              aria-label={LABELS[window.href]}
              aria-current={active ? "page" : undefined}
              className={cn("flex h-12 items-center justify-center gap-2 rounded-full transition-[background-color,color,padding] duration-150", active ? "bg-white px-4 text-ground shadow-pill" : "w-12 text-ink-2")}
            >
              <Icon className="size-5" />
              {active && <span className="text-sm font-semibold">{LABELS[window.href]}</span>}
            </Link>
          );
        })}
      </nav>

      <ApiKeysDialog open={apiKeysOpen} onOpenChange={setApiKeysOpen} />
    </div>
  );
}
