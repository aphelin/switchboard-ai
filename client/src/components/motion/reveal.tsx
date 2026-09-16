"use client";

import { motion, useReducedMotion, type HTMLMotionProps } from "motion/react";
import { cn } from "@/lib/utils";

const spring = { type: "spring", stiffness: 420, damping: 34, mass: 0.8 } as const;

interface RevealProps extends HTMLMotionProps<"div"> {
  /** Seconds before the entrance starts. */
  delay?: number;
  /** Pixels the element rises from. */
  y?: number;
  /** Enter when scrolled into view instead of on mount. */
  inView?: boolean;
}

/** Fades and rises an element into place once, with a spring. Still under reduced motion. */
export function Reveal({ delay = 0, y = 14, inView, className, children, ...props }: RevealProps) {
  const reduced = useReducedMotion();
  const hidden = { opacity: 0, y };
  const shown = { opacity: 1, y: 0 };
  return (
    <motion.div
      className={cn(className)}
      initial={reduced ? false : hidden}
      animate={inView ? undefined : shown}
      whileInView={inView ? shown : undefined}
      viewport={inView ? { once: true, margin: "-80px" } : undefined}
      transition={{ ...spring, delay }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.03 } },
};
const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: spring },
};

/** Staggers the entrance of its `StaggerItem` children. */
export function Stagger({ className, children, inView, ...props }: HTMLMotionProps<"div"> & { inView?: boolean }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={cn(className)}
      variants={container}
      initial={reduced ? false : "hidden"}
      animate={inView ? undefined : "show"}
      whileInView={inView ? "show" : undefined}
      viewport={inView ? { once: true, margin: "-80px" } : undefined}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ className, children, ...props }: HTMLMotionProps<"div">) {
  return (
    <motion.div className={cn(className)} variants={item} {...props}>
      {children}
    </motion.div>
  );
}
