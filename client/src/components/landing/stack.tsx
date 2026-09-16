"use client";

import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";

type Tag = string | { text: string; tone?: "ask"; code?: boolean };

interface Group {
  /** A provider name leading the group (own-key models). */
  provider?: string;
  tags: Tag[];
}

interface Row {
  label: string;
  /** A short count under the term, only where the number means something. */
  count?: string;
  text?: string;
  groups: Group[];
}

const code = (text: string): Tag => ({ text, code: true });

/**
 * What runs behind each window. Facts only: model names come from the catalog in
 * `server/src/modules/llm/catalog`, the rest from `docs/architecture.md`.
 */
const ROWS: Row[] = [
  {
    label: "Included models",
    count: "5 models",
    text: "Pollinations models run on the platform key and count against a daily budget. Images cost at most one cent.",
    groups: [{ tags: ["GPT-5.4 mini · chat, agent, text", "GPT-5.4 nano · titles, prompt enhancement", "FLUX.1 Schnell", "Z-Image Turbo", "FLUX.2 Klein 4B"] }],
  },
  {
    label: "Your own key",
    count: "3 providers",
    text: "Premium models run on your key, stored encrypted with AES-256-GCM, and their cost goes to you rather than the platform.",
    groups: [
      { provider: "OpenAI", tags: ["GPT-5.6 Sol", "GPT-5.6 Terra", "GPT-5.6 Luna"] },
      { provider: "Anthropic", tags: ["Claude Opus 5", "Claude Sonnet 5", "Claude Haiku 4.5"] },
      { provider: "Google", tags: ["Gemini 3.1 Pro (preview)", "Gemini 3.8 Flash", "Gemini 3.1 Flash-Lite", "Nano Banana Pro · 2 · 2 Lite"] },
    ],
  },
  {
    label: "Retrieval",
    text: "The indexer cuts documents into 800-character chunks with 120 overlap, embeds them in-process, searches two ways and fuses by rank.",
    groups: [{ tags: [code("bge-small-en-v1.5"), "384 dims · Transformers.js on CPU", "pgvector · HNSW, cosine", "Postgres full-text · GIN", "Reciprocal Rank Fusion · k = 60", "6 of 20 candidates", "prompt-injection scanner", ".txt · .md · .pdf"] }],
  },
  {
    label: "Agent",
    count: "6 tools",
    text: "The agent runs on Vercel AI SDK streamText with six typed tools, a six-step cap and a versioned system prompt. Two tools wait for a human, and messages can carry images.",
    groups: [{ tags: [code("search_documents"), code("list_documents"), code("list_generations"), code("get_generation"), code("generate_image"), code("edit_image"), { text: "need approval", tone: "ask" }, "citations [n]", "image input"] }],
  },
  {
    label: "Queue",
    text: "Each generation is a BullMQ job with a priority, three attempts and a circuit breaker per provider. Status streams back live.",
    groups: [{ tags: ["BullMQ on Redis", "high · normal · low", "opossum breaker", "fallback provider", "Server-Sent Events"] }],
  },
  {
    label: "Ledger",
    text: "Every model call writes one row with its tokens, cost, latency, the model that answered and whose key paid. Prices come from the live catalog.",
    groups: [{ tags: ["per-call traces", "cost per feature", "daily budget per user", "own-key spend", "structured output with repair"] }],
  },
  {
    label: "MCP",
    count: "10 tools",
    text: "The MCP server exposes the same services over Streamable HTTP, behind a personal API key.",
    groups: [{ tags: [code("generate_image"), code("edit_image"), code("generate_text"), code("search_documents"), code("ask_documents"), code("list_documents"), code("add_document"), code("delete_document"), code("list_generations"), code("get_generation")] }],
  },
  {
    label: "Evals",
    text: "The corpus is fictional, so answers cannot come from memory. Every push runs retrieval hit@k and MRR. An LLM judge scores faithfulness when a provider key is set. Thresholds fail CI.",
    groups: [{ tags: ["hit@k", "MRR", "LLM-as-judge", "never prints PWNED", "GitHub Actions"] }],
  },
  {
    label: "Stack",
    groups: [{ tags: ["Next.js 16", "React 19", "Tailwind v4", "NestJS 11", "Prisma", "Postgres + pgvector", "Redis", "Better Auth", "Vercel AI SDK", "Docker"] }],
  },
];

function TagChip({ tag }: { tag: Tag }) {
  const t = typeof tag === "string" ? { text: tag } : tag;
  return (
    <li className="spec-tag" data-code={t.code ? "" : undefined} data-tone={t.tone}>
      {t.text}
    </li>
  );
}

/** Under the hood: a spec sheet of what answers, what pays and what runs in between, patched down one cord. */
export function Stack() {
  return (
    <section id="stack" className="scroll-mt-24 px-5 pt-28 lg:px-10 lg:pt-40" aria-labelledby="stack-heading">
      <div className="mx-auto w-full max-w-[1440px]">
        <Reveal inView className="max-w-[640px]">
          <h2 id="stack-heading" className="text-[clamp(36px,5vw,64px)] leading-[1.02] font-bold tracking-[-0.03em]">Under the hood.</h2>
          <p className="mt-4 max-w-[44ch] text-lg leading-8 text-ink-2">This sheet lists which models answer, whose key pays and what runs between the prompt and the ledger.</p>
        </Reveal>
        <Reveal inView delay={0.06}>
          <dl className="spec glass glass-strong mt-12 overflow-hidden rounded-[28px] lg:mt-16" data-testid="stack-sheet">
            {ROWS.map((row, i) => (
              <div
                key={row.label}
                className={cn(
                  "spec-row grid gap-x-10 gap-y-3 py-6 pr-5 pl-14 sm:pr-8 sm:pl-[72px] lg:grid-cols-[220px_minmax(0,1fr)] lg:py-7",
                  i > 0 && "border-t border-white/[0.07]",
                )}
              >
                <dt>
                  <span className="spec-jack top-[26px] lg:top-[30px]" aria-hidden="true" />
                  <span className="block text-lg leading-7 font-bold tracking-tight">{row.label}</span>
                  {row.count && <span className="block text-sm font-semibold text-dim">{row.count}</span>}
                </dt>
                <dd className="min-w-0">
                  {row.text && <p className="max-w-[64ch] text-[15px] leading-6 text-ink-2">{row.text}</p>}
                  <div className={cn("flex flex-col gap-2.5", row.text && "mt-4")}>
                    {row.groups.map((group, gi) => (
                      <ul key={group.provider ?? gi} className="spec-group" aria-label={group.provider ? `${group.provider} models` : `${row.label} details`}>
                        {group.provider && <li className="spec-provider">{group.provider}</li>}
                        {group.tags.map((tag, ti) => <TagChip key={`${row.label}-${gi}-${ti}`} tag={tag} />)}
                      </ul>
                    ))}
                  </div>
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  );
}
