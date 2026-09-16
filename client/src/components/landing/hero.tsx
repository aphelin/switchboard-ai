"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { DemoButton } from "@/components/auth/demo-button";
import { demoLifetime, useDemoStatus } from "@/hooks/use-demo-status";
import { HeroPanel } from "./hero-panel";

const spring = { type: "spring", stiffness: 380, damping: 32, mass: 0.8 } as const;

/** Each word slides up from behind a clip, in reading order. Still under reduced motion. */
export function WordReveal({ text, accentLast, delay = 0, className }: { text: string; accentLast?: boolean; delay?: number; className?: string }) {
  const reduced = useReducedMotion();
  const words = text.split(" ");
  return (
    <span className={cn("inline", className)} aria-label={text}>
      {words.map((word, i) => (
        <span key={`${word}-${i}`} className="inline-block overflow-hidden pb-[0.08em] align-bottom" aria-hidden="true">
          <motion.span
            className={cn("inline-block will-change-transform", accentLast && i === words.length - 1 && "text-accent")}
            initial={reduced ? false : { y: "110%" }}
            animate={{ y: 0 }}
            transition={{ ...spring, delay: delay + i * 0.045 }}
          >
            {word}
          </motion.span>
          {i < words.length - 1 && <span className="inline-block">&nbsp;</span>}
        </span>
      ))}
    </span>
  );
}

/** The first viewport: headline and actions left, the switchboard panel right. */
export function Hero({ signedIn }: { signedIn: boolean }) {
  const reduced = useReducedMotion();
  const demo = useDemoStatus();
  const showDemo = !signedIn && demo?.enabled !== false;
  return (
    <section id="top" className="relative px-5 pt-8 pb-16 sm:pt-12 lg:flex lg:min-h-[calc(100dvh-80px)] lg:items-center lg:px-10 lg:pt-6 lg:pb-16" style={{ overflowX: "clip" }}>
      <div className="mx-auto grid w-full max-w-[1440px] items-center gap-14 lg:grid-cols-[minmax(0,11fr)_minmax(0,10fr)] lg:gap-10">
        <div className="relative z-10 max-w-[720px]">
          <h1 className="text-[clamp(48px,7.6vw,118px)] leading-[0.94] font-bold tracking-[-0.035em] text-white">
            <WordReveal text="Every AI call," delay={0.05} />
            <br />
            <WordReveal text="visible." accentLast delay={0.2} />
          </h1>
          <motion.p
            className="mt-7 max-w-[34ch] text-lg leading-8 text-ink-2 sm:text-xl sm:leading-9"
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.35 }}
          >
            Each generation, search and agent step runs through the queue, gets a price and leaves a trace. The agent asks before it spends.
          </motion.p>
          <motion.div
            className="mt-9 flex flex-wrap items-center gap-3"
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.45 }}
          >
            {signedIn ? (
              <Link href="/" className="btn btn-primary btn-lg">Back to session <ArrowRight /></Link>
            ) : (
              <DemoButton fallback={<a href="#open-session" className="btn btn-primary btn-lg">Open session <ArrowRight /></a>} />
            )}
            <a href="#how" className="btn btn-glass btn-lg">See how it works</a>
          </motion.div>
          <motion.p
            className="mt-6 text-sm font-medium text-dim"
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.6 }}
          >
            {showDemo ? <>The demo opens a guest session and is deleted after {demoLifetime(demo)}.</> : <>Included models run on the platform. Premium models run on your own key.</>}
          </motion.p>
        </div>

        <HeroPanel className="max-w-none" />
      </div>
    </section>
  );
}
