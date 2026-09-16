"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ArrowUp } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { REPO_URL } from "@/lib/site";
import { cn } from "@/lib/utils";
import { Orb, Wordmark } from "@/components/tui/logo";
import { Reveal } from "@/components/motion/reveal";
import { AuthPane } from "@/components/auth/auth-pane";
import { DemoButton } from "@/components/auth/demo-button";
import { demoLifetime, useDemoStatus } from "@/hooks/use-demo-status";
import { Hero } from "./hero";
import { Theatre } from "./theatre";
import { Stack } from "./stack";

/** Hidden while the visitor scrolls down past the top, back the moment they scroll up. */
function useHeaderHidden(): boolean {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    let queued = false;
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (y > 120 && y > last + 4) setHidden(true);
        else if (y <= 120 || y < last - 4) setHidden(false);
        last = y;
        queued = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return hidden;
}

/** The welcome page: hero, the windows on one stage, the spec sheet, the session pane, a wordmark footer. */
export function Landing() {
  const { data: session } = authClient.useSession();
  const signedIn = Boolean(session);
  const demo = useDemoStatus();
  const showDemo = !signedIn && demo?.enabled !== false;
  const headerHidden = useHeaderHidden();

  useEffect(() => {
    const ground = document.querySelector<HTMLElement>(".ember");
    ground?.setAttribute("data-intensity", "hero");
    return () => ground?.setAttribute("data-intensity", "app");
  }, []);

  return (
    <div className="relative min-h-dvh">
      {/* Three floating pills from md up, sliding away while the visitor reads down and returning on the first scroll up; on phones the header simply scrolls away. */}
      <header
        className={cn(
          "z-40 px-5 py-4 transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] md:sticky md:top-0 lg:px-10",
          headerHidden && "md:-translate-y-[120%]",
        )}
        data-hidden={headerHidden ? "" : undefined}
      >
        <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-3">
          <Link href={signedIn ? "/" : "#top"} className="glass glass-strong glass-blur flex items-center gap-2.5 rounded-full py-1 pr-4 pl-1 text-lg">
            <Orb size={30} />
            <Wordmark />
          </Link>
          <nav className="glass glass-strong glass-blur hidden items-center gap-1 rounded-full p-1 md:flex" aria-label="Page">
            <a href="#how" className="chip chip-sm border-transparent bg-transparent">How it works</a>
            <a href="#stack" className="chip chip-sm border-transparent bg-transparent">Under the hood</a>
            <a href="#open-session" className="chip chip-sm border-transparent bg-transparent">{signedIn ? "Session" : "Sign in"}</a>
            <a href={REPO_URL} target="_blank" rel="noreferrer noopener" className="chip chip-sm border-transparent bg-transparent">Repository</a>
          </nav>
          {signedIn ? (
            <Link href="/" className="btn btn-primary btn-sm">Back to session <ArrowRight /></Link>
          ) : (
            <DemoButton size="sm" label="Try the demo" fallback={<a href="#open-session" className="btn btn-primary btn-sm">Open session <ArrowRight /></a>} />
          )}
        </div>
      </header>

      <Hero signedIn={signedIn} />
      <Theatre />
      <Stack />

      <section id="open-session" className="scroll-mt-24 px-5 pt-28 pb-8 lg:px-10 lg:pt-40" aria-labelledby="session-heading">
        <div className="mx-auto w-full max-w-[1440px]">
          {/* Spans the same 1440px frame as the hero: copy on the left gutter, the pane flush with the right one. */}
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,600px)] lg:gap-20">
            <Reveal inView>
              <h2 id="session-heading" className="text-[clamp(36px,5vw,64px)] leading-[1.02] font-bold tracking-[-0.03em]">Run it yourself.</h2>
              {showDemo ? (
                <>
                  <p className="mt-5 max-w-[40ch] text-lg leading-8 text-ink-2">
                    The demo opens a private copy of a real session with its documents, generations, chats and traces. It is deleted after {demoLifetime(demo)}.
                  </p>
                  <DemoButton className="mt-7" />
                </>
              ) : (
                <p className="mt-5 max-w-[40ch] text-lg leading-8 text-ink-2">
                  Generate something, upload a document, ask the agent, read the ledger. The free models are included; premium ones run on your own key.
                </p>
              )}
            </Reveal>
            <Reveal inView delay={0.08}>
              {signedIn ? (
                <section className="glass glass-strong p-7">
                  <div className="flex items-center gap-3">
                    <Orb size={36} />
                    <div>
                      <h3 className="text-xl font-bold tracking-tight">Session open</h3>
                      <p className="text-sm text-ink-2">Signed in as <span className="font-semibold text-white">{session?.user.name ?? session?.user.email}</span></p>
                    </div>
                  </div>
                  <Link href="/" className="btn btn-primary btn-lg mt-5 w-full">Back to session <ArrowRight /></Link>
                </section>
              ) : (
                <AuthPane />
              )}
            </Reveal>
          </div>
        </div>
      </section>

      <footer className="overflow-hidden px-5 pt-28 pb-8 lg:px-10 lg:pt-40">
        <div className="mx-auto w-full max-w-[1440px]">
          <div className="flex flex-wrap items-center justify-between gap-6 border-t border-line pt-8">
            <p className="flex items-center gap-3 text-xl">
              <Orb size={32} />
              <Wordmark />
            </p>
            <p className="flex flex-wrap items-center gap-2">
              <a href="#how" className="btn btn-glass btn-sm">How it works</a>
              <a href="#stack" className="btn btn-glass btn-sm">Under the hood</a>
              <a href={REPO_URL} target="_blank" rel="noreferrer noopener" className="btn btn-glass btn-sm">Repository</a>
              <a href="#top" className="btn btn-glass btn-sm"><ArrowUp /> Top</a>
              {signedIn ? <Link href="/" className="btn btn-primary btn-sm">Back to session</Link> : <DemoButton size="sm" label="Try the demo" fallback={<a href="#open-session" className="btn btn-primary btn-sm">Open session</a>} />}
            </p>
          </div>
        </div>
        <p className="-mb-[0.18em] mt-10 text-[clamp(64px,15vw,260px)] leading-[0.85] font-bold tracking-[-0.05em] whitespace-nowrap text-white/[0.09] select-none" aria-hidden="true">
          Switchboard
        </p>
      </footer>
    </div>
  );
}
