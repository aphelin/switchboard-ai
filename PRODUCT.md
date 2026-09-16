# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: technical interviewers, hiring managers and recruiters evaluating the author's portfolio for Senior AI / Node.js engineering roles. They open a link on a laptop between meetings or watch a screen-share during an interview, and have two to five minutes to decide whether the author has built real AI infrastructure (RAG, agents, MCP, evals, observability, multi-tenancy).

Secondary: the author, who uses the app daily to develop, demo and rehearse the architecture walkthrough, and connects MCP clients (Claude Code, Claude Desktop) to it.

Confirmed 2026-09-14: the redesign is aimed at interviewers and recruiters first; the AI machinery must be visible, not hidden.

## Product Purpose

A per-user AI workbench: image and text generation through an async job queue, a RAG knowledge base over the user's own documents, a streaming tool-using chat agent that asks before spending money, an MCP server exposing the same capabilities to external agents, and full LLM observability (tokens, cost, latency per call). Success for a visitor: within a couple of minutes they can see a generation queue, a document being chunked and retrieved, the agent citing passages and requesting approval, and the trace ledger showing what each call cost.

## Positioning

Every model call is visible, priced and gated. Nothing runs without a trace row; the agent cannot generate an image without human approval; retrieval shows the vector rank, keyword rank and fused score for every passage; premium models run only on the user's own encrypted key and are billed to them, not the platform budget. A neighbouring "AI playground" hides all of this; here it is the product.

## Operating Context

- Signed-in single-page-app shell with routes: Generate (prompt form + active job tracker), Gallery (completed images), History (all generations with filters and retry/cancel), Documents (upload or paste, chunk list, retrieval tester with hybrid / vector / keyword modes), Chat (conversation list, agent thread with tool cards, document scope, model picker, link to traces), Traces (totals, per-model and per-call-type tables, call list filterable by trace id).
- Account menu: today's spend against the daily budget, own-key spend, AI providers dialog (bring-your-own-key for OpenAI, Anthropic, Google), API keys dialog (MCP keys shown once, with a ready `claude mcp add` command).
- Sign-in / create-account modal gates everything; nothing behind it mounts until a session exists.
- One-click demo (added 2026-09-15): "Try the live demo" opens a guest session (Better Auth anonymous user) holding a private copy of a real template account (documents, generations, chats, traces). Guests use the included models only, can't store provider or API keys, get a small daily budget, see a "Demo session" badge and their deletion time, and are deleted after 24 hours.
- Live updates: Server-Sent Events push generation and document status changes; toasts announce completion and failure.
- Jobs carry a priority (high / normal / low) and a status (pending, generating, completed, failed, cancelled). Documents move pending → indexing → ready / failed.
- Runs locally: API on port 4000, client on port 3001 (port 3000 is taken by another project on the author's machine). Postgres with pgvector and Redis in Docker.
- MCP clients connect with a personal API key over Streamable HTTP.

## Capabilities and Constraints

- Stack: Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, shadcn/ui on Base UI, lucide icons, sonner toasts, AI SDK UI (`useChat`). Keep these; the redesign replaces presentation, not the data layer or hooks.
- All existing behaviour, routes, API calls, keyboard interactions and `data-testid` attributes must survive the redesign (they anchor tests and evals).
- Included models are free platform models (Pollinations); premium models need the user's key. Prices are shown per model in the picker and per call in traces.
- A public landing page is to be added (confirmed 2026-09-14) that explains and demonstrates the toolkit before sign-in.
- One committed visual theme (confirmed 2026-09-14): the OS light/dark toggle is dropped in favour of a single fully designed look.
- Product name: Switchboard AI. The client, Better Auth app name, MCP server (`switchboard-ai`) and system prompt use it. The GitHub repository is `aphelin/switchboard-ai` and the Postgres database is `switchboard_ai`.
- No in-harness image generation. The cinematic ground image is produced by the user with Nano Banana from the prompt the design supplies; a CSS stand-in ships until then.

## Brand Commitments

- Name: Switchboard AI; wordmark is "Switchboard" in Urbanist with a small mint "AI" tag.
- Logo: a dark rounded tile with a mint light inside (CSS in `client/src/components/tui/logo.tsx`, SVG in `client/src/app/icon.svg`); the tile pulses while anything is running.
- Aesthetic (user-pinned 2026-09-14 with a third reference image after two rejected worlds, palette re-pinned the same evening): "canopy glass". Dark brown-black ground lit by one cool forest-to-mint light, mostly opaque dark panels with crisp 1px light edges, white primary actions, one mint accent for the action that spends money, earth/tan for warmth, huge white Urbanist display type, tabular Urbanist figures for readouts. The terminal-multiplexer look was rejected as "good but basic and hard to grasp"; the pastel aurora glass as "somewhat better but too playful"; the orange ember palette was replaced on request ("green forest-ish colours, like mint and brown"). The user asked for "better glassmorphism, more defined and more professional", snappy motion, AAA contrast, and a landing page in the awwwards/dribbble register.
- Assets: one cinematic background from Nano Banana, 2400×1400, saved as `client/public/art/ground.jpg`, is picked up automatically by the ground layer; the CSS light stands in until then (prompt in `docs/art-assets.md`, now forest/mint).
- Voice: plain, precise, engineering-literate; explains mechanisms (RRF, pgvector, breaker) without hype.

## Evidence on Hand

- Real, working features only: the app runs locally against real providers; the eval harness lives in `server/evals` and runs in CI; architecture notes with interview Q&A in `docs/architecture.md`; the full AI-assisted development history in `AI-history/`.
- No testimonials, customers, pricing plans, benchmarks or uptime claims exist. The landing page must not invent any; it demonstrates the real product surfaces instead.
- Model prices shown in the UI come from the live catalog.

## Product Principles

1. Show the machinery: queue, ranks, costs, approvals and traces are content, not chrome.
2. Nothing runs unseen or unpaid-for: every screen makes who pays and what it cost legible.
3. Operate first: an evaluator must be able to run a generation, ask the agent and read a trace without instructions.
4. Real over invented: demonstrate with the actual product; label anything synthetic.
5. Free by default, premium on your own key.

## Accessibility & Inclusion

Keyboard operability for every control (existing cards are focusable buttons; keep that), visible focus rings, readable contrast on data-dense tables. No further product-specific standard was established.
