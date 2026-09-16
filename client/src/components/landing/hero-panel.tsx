"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from "motion/react";
import { ImageIcon, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

const PROMPT = "A red lighthouse on a rocky shore at sunrise, warm light, long exposure";
const spring = { type: "spring", stiffness: 380, damping: 32, mass: 0.8 } as const;

/** The six stops a request passes, in order, with what this sample request reads at each. */
const STOPS = [
  { key: "prompt", title: "Prompt", readout: "image" },
  { key: "queue", title: "Queue", readout: "high · #1" },
  { key: "worker", title: "Worker", readout: "FLUX.1" },
  { key: "approval", title: "Approval", readout: "approved", ask: "Approve?" },
  { key: "trace", title: "Trace", readout: "$0.002 · 6.3 s" },
  { key: "result", title: "Result", readout: "1024 × 1024" },
] as const;

const JACK_ROW = 26;

function cordPath(width: number): string {
  const x = (i: number) => (width * (2 * i + 1)) / 12;
  const y = JACK_ROW / 2;
  let d = `M${x(0).toFixed(1)} ${y}`;
  for (let i = 1; i < STOPS.length; i++) d += ` Q${((x(i - 1) + x(i)) / 2).toFixed(1)} ${y + 9} ${x(i).toFixed(1)} ${y}`;
  return d;
}

/**
 * The patch bay: six jacks on one cord under the prompt. A signal runs the route, waits at
 * Approval until the human says yes, then carries on to the trace and the result. The whole
 * sequence is CSS (`.bay` in globals.css); under reduced motion it holds at Approval.
 */
function Bay() {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);

  useLayoutEffect(() => {
    const node = box.current;
    if (!node) return;
    const update = () => setWidth(node.clientWidth || 600);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const cord = cordPath(width);
  return (
    <div className="bay mt-7 border-t border-white/8 pt-6 sm:mt-9 sm:pt-7" role="group" aria-label="How a request moves">
      <div ref={box} className="relative">
        <svg className="bay-cord z-0" viewBox={`0 0 ${width} ${JACK_ROW}`} aria-hidden="true">
          <path d={cord} className="bay-wire" />
          <path d={cord} pathLength={1} className="bay-trail" />
          <path d={cord} pathLength={1} className="bay-signal bay-halo" />
          <path d={cord} pathLength={1} className="bay-signal" />
          {STOPS.map((_, i) => (
            <circle key={i} cx={(width * (2 * i + 1)) / 12} cy={JACK_ROW / 2} r={JACK_ROW / 2} fill="#1a1613" />
          ))}
        </svg>
        <ol className="relative z-10 grid grid-cols-6">
          {STOPS.map((stop, i) => (
            <li
              key={stop.key}
              className="bay-stop flex flex-col items-center gap-2.5 text-center"
              data-stop={i + 1}
              data-rest={i < 3 ? "lit" : i === 3 ? "ask" : undefined}
            >
              <span className="bay-jack" aria-hidden="true" />
              <span className="bay-label text-[11px] sm:text-[13px]">{stop.title}</span>
              {"ask" in stop ? (
                <span className="bay-readout relative">
                  {/* The two states swap by opacity; assistive tech gets one stable line instead. */}
                  <span className="bay-ask" aria-hidden="true">{stop.ask}</span>
                  <span className="bay-done absolute inset-0" aria-hidden="true">{stop.readout}</span>
                  <span className="sr-only">waits for approval</span>
                </span>
              ) : (
                <span className="bay-readout hidden sm:block">{stop.readout}</span>
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/**
 * The hero: a smoky glass prompt panel with the request's route patched underneath it.
 * The pointer tilts the panel a few degrees; still under reduced motion.
 */
export function HeroPanel({ className }: { className?: string }) {
  const reduced = useReducedMotion();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 60, damping: 18 });
  const sy = useSpring(my, { stiffness: 60, damping: 18 });
  const rotX = useTransform(sy, [-1, 1], [3, -3]);
  const rotY = useTransform(sx, [-1, 1], [-5, 5]);

  const onMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (reduced) return;
    const rect = event.currentTarget.getBoundingClientRect();
    mx.set(((event.clientX - rect.left) / rect.width) * 2 - 1);
    my.set(((event.clientY - rect.top) / rect.height) * 2 - 1);
  };
  const onLeave = () => { mx.set(0); my.set(0); };

  return (
    <div className={cn("relative mx-auto w-full max-w-[880px] [perspective:1400px]", className)} onPointerMove={onMove} onPointerLeave={onLeave}>
      <motion.div
        style={{ rotateX: rotX, rotateY: rotY }}
        initial={reduced ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring, delay: 0.3 }}
      >
        <div className="glass glass-dark relative rounded-[26px] border-t-white/35 border-x-white/14 border-b-white/6 p-6 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.28)] sm:p-9" data-testid="hero-panel">
          <span className="absolute top-3 right-4 text-xs font-bold text-dim sm:top-4 sm:right-5">Sample data</span>
          <p className="min-h-[2.9em] pr-16 text-[19px] leading-8 text-white/92 sm:pr-20 sm:text-[26px] sm:leading-[1.45]">
            {PROMPT}
            <span className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[0.18em] bg-white/90 animate-[pulse-soft_1.2s_ease-in-out_infinite]" aria-hidden="true" />
          </p>
          <div className="mt-7 flex items-center justify-between gap-4 sm:mt-9">
            <span className="glass-inner flex size-[52px] items-center justify-center rounded-[16px] text-white/85 sm:size-16 sm:rounded-[18px]" aria-hidden="true">
              <ImageIcon className="size-5 sm:size-6" />
            </span>
            <span className="flex flex-col items-center gap-2 text-white/80">
              <span className="wave text-white/85">
                {Array.from({ length: 12 }).map((_, i) => <i key={i} />)}
              </span>
              <span className="text-sm text-dim">In flight…</span>
            </span>
            <span className="btn btn-primary btn-icon pointer-events-none size-[52px] rounded-[16px] sm:size-16 sm:rounded-[18px]" aria-hidden="true">
              <ArrowUp className="size-5 sm:size-6" />
            </span>
          </div>
          <Bay />
        </div>
      </motion.div>
    </div>
  );
}
