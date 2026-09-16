"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import { Reveal } from "@/components/motion/reveal";
import { ChatSample, McpSample, QueueSample, RetrievalSample, TracesSample } from "./sample-panes";

interface Beat {
  id: string;
  title: string;
  text: string;
  tags: string[];
  pane: ReactNode;
}

const BEATS: Beat[] = [
  {
    id: "queue",
    title: "A queue with priorities.",
    text: "Every prompt becomes a job with a priority. Status streams back the moment it changes.",
    tags: ["BullMQ", "Server-Sent Events", "circuit breaker"],
    pane: <QueueSample />,
  },
  {
    id: "retrieval",
    title: "Retrieval you can inspect.",
    text: "Each passage shows its vector rank, its keyword rank and the fused score that placed it.",
    tags: ["pgvector", "Reciprocal Rank Fusion", "injection flags"],
    pane: <RetrievalSample />,
  },
  {
    id: "agent",
    title: "An agent that asks before it spends.",
    text: "Tool calls stream into the transcript with citations. Anything that costs money waits for your yes.",
    tags: ["tool calls", "citations", "approval gate"],
    pane: <ChatSample />,
  },
  {
    id: "ledger",
    title: "Every call in the ledger.",
    text: "Each row records tokens, cost, latency, the model that answered, who paid and whether it succeeded.",
    tags: ["per-call traces", "daily budget", "your own key"],
    pane: <TracesSample />,
  },
  {
    id: "mcp",
    title: "The same tools, from your editor.",
    text: "One command connects Claude Code to your session over MCP, with the same scoping and budget.",
    tags: ["MCP", "Streamable HTTP", "personal API key"],
    pane: <McpSample />,
  },
];

const STAGE_QUERY = "(min-width: 1024px)";

/**
 * True from `lg` up, false below, null before hydration. The server renders both the stage and
 * the inline panes (CSS shows the right one, so the page is whole without JavaScript); after
 * hydration only the matching branch stays mounted.
 */
function useStage(): boolean | null {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(STAGE_QUERY);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia(STAGE_QUERY).matches,
    () => null,
  );
}

interface Fit {
  scale: number;
  /** Per pane: the translate that centres it on the stage. */
  offsets: number[];
  measured: boolean;
}

/**
 * The windows, one at a time. From `lg` a sticky stage on the right shows a single real pane
 * while the captions scroll past on the left; the caption crossing the middle of the viewport
 * picks the pane. Below `lg` each caption is followed by its pane.
 */
export function Theatre() {
  const reduced = useReducedMotion();
  const stage = useStage();
  const showStage = stage !== false;
  const showInline = stage !== true;
  const [active, setActive] = useState(0);
  const captions = useRef<Array<HTMLDivElement | null>>([]);
  const stageBox = useRef<HTMLDivElement>(null);
  const panes = useRef<Array<HTMLDivElement | null>>([]);
  const [fit, setFit] = useState<Fit>({ scale: 1, offsets: [], measured: false });

  useEffect(() => {
    if (!stage) return;
    const nodes = captions.current.filter((node): node is HTMLDivElement => node !== null);
    if (nodes.length === 0) return;
    // The caption crossing the middle tenth of the viewport owns the stage. When none does (the
    // visitor is above the first or below the last), the nearest end owns it, so a jump back to
    // the top never leaves the last pane on stage.
    const observer = new IntersectionObserver(
      (entries) => {
        const crossing = entries.find((entry) => entry.isIntersecting);
        if (crossing) {
          setActive(Number((crossing.target as HTMLElement).dataset.beat));
          return;
        }
        const middle = window.innerHeight / 2;
        if (nodes[0].getBoundingClientRect().top > middle) setActive(0);
        else if (nodes[nodes.length - 1].getBoundingClientRect().bottom < middle) setActive(nodes.length - 1);
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [stage]);

  useEffect(() => {
    if (!stage) return;
    const box = stageBox.current;
    if (!box) return;
    // One scale for every pane, taken from the tallest at rest, so the stage keeps one width while
    // it swaps between them (short laptop viewports scale all of them down together). It is only
    // measured when the stage itself resizes: opening a tool call or expanding a passage on stage
    // grows that pane into the slack below it and never rescales the stage.
    const measure = () => {
      const height = box.clientHeight;
      const natural = panes.current.map((node) => node?.offsetHeight ?? 0);
      const scale = Math.min(1, height / Math.max(1, ...natural));
      setFit({ scale, offsets: natural.map((h) => Math.max(0, (height - h * scale) / 2)), measured: true });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    void document.fonts.ready.then(measure);
    return () => observer.disconnect();
  }, [stage]);

  const jump = (index: number) => {
    captions.current[index]?.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <section id="how" className="scroll-mt-24 px-5 pt-28 lg:px-10 lg:pt-40" aria-labelledby="how-heading">
      <div className="mx-auto w-full max-w-[1440px]">
        <Reveal inView className="max-w-[640px]">
          <h2 id="how-heading" className="text-[clamp(36px,5vw,64px)] leading-[1.02] font-bold tracking-[-0.03em]">What runs here.</h2>
          <p className="mt-4 max-w-[44ch] text-lg leading-8 text-ink-2">These are the session&apos;s own components, filled with labelled sample data.</p>
        </Reveal>

        <div className="mt-16 lg:mt-8 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-x-20 lg:[--stage-h:min(800px,calc(100dvh-6rem))]">
          {/* The 48px end padding lines the first and last captions up with the stage before and after it sticks. */}
          <div className="flex flex-col gap-20 lg:gap-0 lg:py-12">
            {BEATS.map((beat, i) => (
              <div
                key={beat.id}
                ref={(node) => {
                  captions.current[i] = node;
                }}
                data-beat={i}
                className="lg:flex lg:min-h-[78vh] lg:items-center"
              >
                <Reveal inView className="w-full">
                  <h3 className="max-w-[16ch] text-[clamp(30px,3.3vw,46px)] leading-[1.04] font-bold tracking-[-0.03em]">{beat.title}</h3>
                  <p className="mt-4 max-w-[34ch] text-lg leading-8 text-ink-2">{beat.text}</p>
                  <ul className="mt-5 flex flex-wrap gap-2" aria-label="Mechanisms">
                    {beat.tags.map((tag) => (
                      <li key={tag} className="tag h-7 px-2.5">{tag}</li>
                    ))}
                  </ul>
                  {showInline && <div className="mt-8 lg:hidden">{beat.pane}</div>}
                </Reveal>
              </div>
            ))}
          </div>

          {showStage && (
            <div className="hidden lg:block lg:sticky lg:h-[var(--stage-h)]" style={{ top: "calc((100dvh - var(--stage-h)) / 2)" }}>
              <div ref={stageBox} className="relative h-full" data-testid="stage" data-scale={fit.scale.toFixed(3)}>
                {BEATS.map((beat, i) => (
                  <div
                    key={beat.id}
                    className="stage-pane"
                    data-active={i === active ? "" : undefined}
                    data-before={i < active ? "" : undefined}
                    aria-hidden={i !== active}
                    inert={i !== active}
                  >
                    <div
                      ref={(node) => {
                        panes.current[i] = node;
                      }}
                      style={{
                        transform: `translateY(${fit.offsets[i] ?? 0}px) scale(${fit.scale})`,
                        transformOrigin: "top center",
                        // Inherit the pane's visibility once measured; forcing "visible" here would show panes that are off stage.
                        visibility: fit.measured ? undefined : "hidden",
                      }}
                    >
                      {beat.pane}
                    </div>
                  </div>
                ))}
              </div>
              <div className="stage-rail" style={{ "--rail-p": active / (BEATS.length - 1), "--rail-n": BEATS.length } as CSSProperties}>
                <ol aria-label="Windows on stage">
                  {BEATS.map((beat, i) => (
                    <li key={beat.id}>
                      <button
                        type="button"
                        onClick={() => jump(i)}
                        aria-label={beat.title}
                        aria-current={i === active ? "true" : undefined}
                        data-passed={i < active ? "" : undefined}
                        className="stage-jack"
                      >
                        <span className="tick" aria-hidden="true" />
                        <span className="label" aria-hidden="true">{beat.title}</span>
                      </button>
                    </li>
                  ))}
                </ol>
                <span className="stage-fader" aria-hidden="true" />
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
