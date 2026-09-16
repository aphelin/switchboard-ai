# Switchboard AI

A fullstack AI application: image and text generation with async job processing, a **RAG knowledge base** over your own documents (pgvector, hybrid search), a **streaming tool-using chat agent** with human approval for side effects, an **MCP server** that exposes the same capabilities to external agents, **LLM observability** (tokens, cost, latency per call) and an **evaluation harness** that runs in CI. Everything is **per user**: email + password accounts, API keys for MCP clients, and a daily AI spending limit.

Design notes and interview-oriented explanations live in [`docs/architecture.md`](./docs/architecture.md); the plan and cost notes in [`docs/ai-engineering-roadmap.md`](./docs/ai-engineering-roadmap.md).

![Switchboard AI landing page](./docs/screenshots/landing.jpg)

| Chat agent with citations | Hybrid retrieval with fused ranks |
| --- | --- |
| ![Chat answer citing document passages](./docs/screenshots/chat.jpg) | ![Documents page with a hybrid search result](./docs/screenshots/documents.jpg) |
| **Traces: tokens, cost and latency per call** | **Generate: prompts become queued jobs** |
| ![Traces page grouped by model and call type](./docs/screenshots/traces.jpg) | ![Generate page with the job queue](./docs/screenshots/home.jpg) |

---

> **AI Development Session Logs**
> The full AI-assisted development chat history for this project is available in the [`AI-history/`](./AI-history) directory. Each file is a readable transcript of a Cursor AI session, covering architecture decisions, implementation details, and debugging.

---

## Tech Stack

| Layer         | Technology                                                                 |
| ------------- | -------------------------------------------------------------------------- |
| Frontend      | Next.js 16 (App Router), TypeScript, TailwindCSS v4, shadcn/ui, AI SDK UI (`useChat`) |
| Backend       | NestJS 11, TypeScript                                                      |
| Database      | PostgreSQL 16 + **pgvector**, Prisma ORM 7                                 |
| Queue         | BullMQ + Redis 7                                                           |
| LLM layer     | Vercel AI SDK v7: included models on any **OpenAI-compatible** provider (Pollinations by default), plus **OpenAI, Anthropic and Google on the user's own API key** through their native AI SDK providers |
| Embeddings    | Transformers.js running `bge-small-en-v1.5` **in-process** (no API key), or any hosted embedding API |
| Text splitting| LangChain `RecursiveCharacterTextSplitter`                                 |
| Agents / MCP  | AI SDK tool calling with approval; `@modelcontextprotocol/server` (Streamable HTTP) |
| Auth          | Better Auth in the API: email + password, database sessions (httpOnly cookie), API keys |
| Image API     | Pollinations.ai                                                            |
| Testing       | Vitest unit tests, eval harness with LLM-as-judge, GitHub Actions CI       |
| Infra         | Docker + Docker Compose                                                    |

## Architecture Overview

```
┌────────────┐   HTTP · SSE · UI-message stream    ┌───────────────────────────────────────────┐
│  Next.js   │◂──────────────────────────────────▸│  NestJS API (port 4000)                   │
│  client    │                                     │                                           │
│ (port 3000)│                                     │  generation ─┐                            │
└────────────┘                                     │  documents  ─┼─▸ BullMQ ─▸ Redis          │
                                                   │  chat agent ─┘                            │
┌────────────┐   Streamable HTTP (JSON-RPC)         │  mcp                                      │
│ MCP client │◂──────────────────────────────────▸│  llm ─▸ platform or user-key provider      │
│ (Claude …) │                                     │  observability ─▸ Postgres (LlmCall)      │
└────────────┘                                     │  documents ─▸ Postgres + pgvector         │
                                                   │  circuit breakers ─▸ Pollinations / LLM   │
                                                   └───────────────────────────────────────────┘
```

**Generation flow:** submit prompt → `Generation` row (PENDING) → BullMQ job → worker calls the provider through a circuit breaker → image bytes stored locally and served by the API (`/api/generations/:id/image`) → DB updated → SSE event → UI updates.

**RAG flow:** upload document → `Document` row → ingestion job: chunk (LangChain splitter) → embed (local model) → pgvector → READY. Search = vector similarity + Postgres full-text, fused with Reciprocal Rank Fusion; every passage is scanned for prompt-injection patterns.

**Agent flow:** `POST /api/chat` → AI SDK `streamText` loop (max 6 steps) with tools `search_documents`, `list_documents`, `list_generations`, `get_generation`, `generate_image` and `edit_image` (both require user approval) → UI message stream to the browser → messages persisted, conversation titled by the fast model. Messages can carry up to three images (shrunk in the browser, stored by the API and inlined for the model; vision-capable models only), and `POST /api/chat/transcribe` turns a microphone recording into text through Pollinations speech-to-text, priced per second in the ledger.

**Image editing:** a finished image can be edited with a prompt (`parameters.sourceGenerationId` on `POST /api/generations`, from the gallery viewer, the agent tool or MCP). The worker reads the source bytes from storage. Included models go to Pollinations `/v1/images/edits` (FLUX.2 Klein, $0.005 flat). A Google key uses Gemini Nano Banana through `generateImage` with the source attached. The result is a new generation that links back to its source.

Every model call goes through `LlmService` (provider registry, breaker, optional fallback provider, Zod-validated structured output with one repair attempt) and is recorded as an `LlmCall` (tokens, estimated cost, latency, and whether it ran on the app's key or the user's own).

**Model flow:** the browser sends a catalog model id (`anthropic:claude-sonnet-5`) → `ModelRouterService` checks it against the catalog and the user's stored keys → the call runs on the included provider (daily budget applies) or on the provider with the user's decrypted key (no budget, no fallback).

## Tech Choices Rationale

- **Vercel AI SDK as the LLM layer:** thin and typed, native streaming, tool calling and tool approval, provider-agnostic. LangChain is used only where it earns its place (text splitting).
- **Two kinds of providers:** the included provider is any OpenAI-compatible endpoint (switching from Pollinations to Groq/Gemini/OpenAI/Ollama is configuration, with an optional fallback). OpenAI, Anthropic and Google run on users' own keys through their native AI SDK packages, so tool calling, structured output and prompt caching use each API directly instead of a compatibility shim.
- **Bring your own key:** the app works with no key at all (Pollinations, daily budget), and anyone who wants Claude, GPT or Gemini pays for it on their own account. Keys are verified, encrypted with AES-256-GCM and never returned.
- **pgvector instead of a separate vector database:** one datastore, transactions across documents and chunks, full-text search for free, HNSW index for speed.
- **Local embeddings:** free, offline, identical in dev/CI/Docker, and fast enough at this scale; a hosted embedding API is a config switch.
- **Hybrid retrieval + RRF:** vectors catch paraphrases, keywords catch exact identifiers and commands; RRF merges them without score calibration.
- **Human-in-the-loop for image generation:** the tool has a cost and a visible side effect, so the agent asks first.
- **Own tracing table:** no extra services to run; the schema maps 1:1 to a hosted tracer (Langfuse/LangSmith) later.
- **BullMQ + Redis, SSE, NestJS, Prisma, shadcn/ui:** as in the original project (see git history), they are also the foundation the agent builds on: the agent's image tool simply waits on the existing queue.

### Design Philosophy

The original project deliberately avoided provider abstractions (KISS/YAGNI). Multi-provider support became a real requirement, so the abstraction now exists, at the narrowest useful point: one `LlmService`, configured by environment, with everything else unaware of which provider is behind it. Letting users pick a model added one more concept, a per-request `ModelRoute`, passed to `LlmService` by the features that call it; nothing below that layer knows who is paying.

## Features

### Generation

- Prompt submission with type selection (Image / Text), priority, model and parameters
- Async job processing (API never blocks), status tracking PENDING → GENERATING → COMPLETED / FAILED, cancel and retry
- **Structured prompt enhancement:** the fast model returns `{ enhancedPrompt, negativePrompt, styleTags }` validated with Zod; falls back to the original prompt on failure
- **Images stored locally and served by the API** (the upstream URL contained the API key)
- Real-time updates via SSE, gallery and history views

### Knowledge base (RAG)

- Upload `.txt` / `.md` / `.pdf` or paste text; async ingestion with live status
- Chunking with overlap, title-prefixed ("contextual") embeddings, pgvector HNSW index
- **Hybrid search** (vector + keyword, RRF) with `hybrid` / `vector` / `keyword` modes and a retrieval test panel that shows scores and fusion ranks
- Prompt-injection scanner flags suspicious passages
- Re-index and delete; scoped search by document ids

### Chat agent

- Streaming responses with visible tool calls, cited answers (`[1]`, `[2]`) with a sources list
- Tools: document search, document list, generation lookups, **image generation with Approve / Deny**
- Conversations persisted and auto-titled; document scope selector
- System prompt versioned and recorded in traces; tool results treated as untrusted data

### Models and your own API keys

- **Model picker** in the chat header and for text generation / prompt enhancement: included models plus a hand-picked flagship, balanced and fast model from OpenAI (GPT-5.6 Sol / Terra / Luna), Anthropic (Claude Opus 5 / Sonnet 5 / Haiku 4.5) and Google (Gemini 3.1 Pro / 3.8 Flash / 3.1 Flash-Lite), with prices; models without a key show "add key"
- **AI providers dialog** (user menu): paste a key, it is checked with a tiny request, stored encrypted (AES-256-GCM, bound to the user and provider), and only its last 4 characters are ever shown again
- Calls on your own key skip the daily budget, are traced as "your key" on the Traces page, and are never retried on another provider; `/api/me` reports their estimated spend separately
- The server validates every model choice: unknown ids, unlisted platform models and providers without a key are rejected before anything is queued
- Claude chats use Anthropic prompt caching on the system prompt and tools; Claude Opus 5 has server-side refusal fallback enabled
- MCP `ask_documents` and `generate_text` accept the same `model` ids
- **Image models:** an "Image model" picker next to Priority lists Pollinations' cheap image models (loaded live, $0.01 per image or less) and **Nano Banana Pro / 2 / 2 Lite** on your Google key. Gemini gets the closest aspect ratio to the requested size. Edits use models that advertise `capabilities.edit`: included FLUX.2 Klein, or Nano Banana on your Google key. Included images count toward the daily budget, images on your key don't

### MCP server

- `POST /api/mcp` (Streamable HTTP, stateless): tools `generate_image`, `edit_image`, `generate_text`, `list_generations`, `get_generation`, `search_documents`, `ask_documents`, `list_documents`, `add_document`, `delete_document`; resource `document://{id}`
- Streamable HTTP at `POST /api/mcp`. Connect Claude Code with the `claude mcp add` command from the API keys dialog, or list tools with the MCP Inspector

### Observability and evaluation

- `LlmCall` trace per model call: name, trace id, provider, model, tokens, cached tokens, estimated cost (Pollinations prices loaded at startup), latency, status; `/traces` page with summaries by model and by feature
- Eval harness (`server/evals`): every CI push runs retrieval hit@k and MRR (free, deterministic). LLM-as-judge correctness/faithfulness, abstention and a prompt-injection test run when `POLLINATIONS_API_KEY` is set. Thresholds fail the job
- Vitest unit tests for the pure logic (RRF, chunking, injection scanner, pricing, history trimming, key encryption and redaction, model routing) and for `LlmService` with mock models

### Accounts and access

- Sign-in / sign-up modal (email + password); sessions are database rows behind an httpOnly cookie (7 days, renewed on use, revoked instantly on sign-out)
- Every route requires a user except `/api/health`; documents, chats, generations, images, live updates and traces are scoped to their owner
- Retrieval filters by owner inside the SQL; agent tools get the user id from the session, never from the model
- API keys (`mat_…`, stored hashed, revocable) authenticate MCP clients and scripts
- Per-user daily AI budget (`USER_DAILY_BUDGET_USD`) and per-user rate limits

### Demo sessions

- **"Try the live demo"** on the landing page opens a guest session in one click, no sign-up (Better Auth anonymous user)
- The guest starts with a private copy of a real session: completed generations, indexed documents (chunks and embeddings copied inside Postgres), conversations and the traces behind them. Copies get new ids, so guests are isolated by the same `userId` filters as accounts
- Included (free) models only: guests can't store provider keys or create MCP API keys, so nobody's paid key is ever used for a visitor
- Cost and abuse limits: a per-guest daily budget, a shared daily budget for all guests, a daily cap on new guests and a per-IP limit on guest sign-ins. Copied traces are history and never count toward a budget
- A BullMQ job scheduler deletes guests after `DEMO_GUEST_TTL_HOURS` with everything they own, and their image files unless the template still uses them

### Platform

- Circuit breakers around every upstream (4xx never trips them), optional LLM fallback provider
- Multi-tier rate limiting (Redis-backed; SSE, image and MCP routes exempt)
- Structured logging (Pino), Docker Compose for dev and prod, GitHub Actions CI (lint, typecheck, tests, evals, Docker build)

## Setup Instructions

### Prerequisites

- Node.js 22+
- Docker and Docker Compose
- A Pollinations API key (free tier available at [pollinations.ai](https://pollinations.ai)); it is used for image generation and, by default, as the LLM provider

### Environment Files

Create `server/.env.development` (and `server/.env.production`) and `client/.env.development` (and `client/.env.production`). The root [`.env.example`](./.env.example) documents every variable; the minimum is:

```bash
# server/.env.development
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=mini_ai_toolkit
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/mini_ai_toolkit?schema=public
REDIS_HOST=redis
REDIS_PORT=6379
POLLINATIONS_API_KEY=your_pollinations_api_key
SERVER_PORT=4000
CLIENT_URL=http://localhost:3000
BETTER_AUTH_SECRET=generate_with_openssl_rand_base64_32
# Optional: lets users add their own OpenAI / Anthropic / Google keys
CREDENTIALS_ENCRYPTION_KEY=generate_with_openssl_rand_base64_32
```

```bash
# client/.env.development
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

For production add `NODE_ENV=production` and set `SERVER_PUBLIC_URL` to the public origin of the API (it is used to build image URLs).

### Option 1: Docker — Development (Recommended)

```bash
docker compose -f docker-compose.dev.yml up --build
```

Starts PostgreSQL (pgvector image), Redis, the NestJS server (hot reload) and the Next.js client. On first start the server downloads the embedding model (~34 MB) into `server/.cache`.

### Option 2: Docker — Production

```bash
docker compose -f docker-compose.prod.yml up --build
```

Generated images and the model cache are kept on named volumes (`server_storage`, `transformers_cache`).

### Option 3: Local Development (without Docker for app services)

```bash
# 1. Infrastructure
docker compose -f docker-compose.dev.yml up postgres redis -d

# 2. Backend (use localhost in DATABASE_URL and REDIS_HOST)
cd server
npm install
npx prisma generate
npx prisma db push
npm run start:dev

# 3. Frontend (new terminal)
cd client
npm install
npm run dev
```

> `nest start --watch` does not reload `.env` files; restart the server after changing them.

The app is available at http://localhost:3000, the API at http://localhost:4000/api.

### Tests, evals and the MCP smoke test

```bash
cd server
npm run typecheck          # tsc --noEmit
npm test                   # vitest unit tests
npm run eval -- --retrieval-only   # retrieval metrics only (free, needs Postgres + Redis)
npm run eval               # full run incl. LLM-as-judge (costs a few cents)
MCP_API_KEY=mat_... npm run mcp:smoke   # exercises the MCP server against a running API
npm run test:auth          # two-user isolation test against a running API (dev/test DB only)
npm run test:providers     # bring-your-own-key isolation test (no provider account needed;
                           # E2E_ANTHROPIC_API_KEY=sk-ant-... adds one real chat turn)
npm run test:demo          # guest session limits and isolation against a running API (no LLM calls)
```

### Filling the demo

Guests start with a copy of one account, the demo template. Fill it through the real pipeline so every trace a visitor sees really happened:

```bash
# server/.env.development: DEMO_TEMPLATE_EMAIL=demo-template@example.com (restart the API)
cd server
DEMO_TEMPLATE_EMAIL=demo-template@example.com npm run demo:seed
# indexes the eval fixture documents, queues 4 images and a text generation on the
# included models, and asks the agent 3 questions (a few cents); prints the password it created.
# --skip-llm indexes the documents only (free). Safe to re-run: finished steps are skipped.
```

Sign in as the template to curate it: whatever it holds is what the next guest gets. Choose an address nobody else can register first, since sign-up is open.

### Connecting an MCP client

```bash
# Claude Code
# Create a key first: user menu -> API keys
claude mcp add --transport http switchboard-ai http://localhost:4000/api/mcp --header "x-api-key: mat_..."

# MCP Inspector
npx @modelcontextprotocol/inspector --cli http://localhost:4000/api/mcp --method tools/list
```

## Environment Variables

| Variable | Description | Default |
| --- | --- | --- |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | PostgreSQL credentials (Docker) | `postgres` / `postgres` / `mini_ai_toolkit` |
| `DATABASE_URL` | PostgreSQL connection string (pgvector required) | `postgresql://postgres:postgres@postgres:5432/mini_ai_toolkit?schema=public` |
| `REDIS_HOST` / `REDIS_PORT` | Redis connection | `redis` (Docker) / `6379` |
| `POLLINATIONS_API_KEY` | Pollinations.ai API key (images; default LLM provider) | required |
| `SERVER_PORT` | Backend port | `4000` |
| `SERVER_PUBLIC_URL` | Public origin of the API, used in image URLs | `http://localhost:<SERVER_PORT>` |
| `CLIENT_URL` | Allowed browser origin(s), comma-separated for more than one (e.g. a second dev port) | `http://localhost:3000` |
| `STORAGE_DIR` | Directory for generated images | `./storage` |
| `BETTER_AUTH_SECRET` | Secret for session cookies (`openssl rand -base64 32`) | required |
| `BETTER_AUTH_URL` | Origin the auth endpoints run on | `SERVER_PUBLIC_URL` |
| `USER_DAILY_BUDGET_USD` | Per-user daily AI spend limit in USD (0 = unlimited) | `0.5` |
| `AUTH_CLAIM_LEGACY_DATA` | First account created takes ownership of rows from before auth | `false` |
| `CREDENTIALS_ENCRYPTION_KEY` | AES-256 key (32 bytes, base64) for users' own provider keys; unset = included models only. Changing it makes stored keys unreadable | none |
| `DEMO_ENABLED` | One-click guest sessions on the landing page | `true` |
| `DEMO_TEMPLATE_EMAIL` | Account every new guest gets a copy of (fill it with `npm run demo:seed`); unset = guests start empty | none |
| `DEMO_GUEST_TTL_HOURS` | Guests and their data are deleted this long after sign-in | `24` |
| `DEMO_GUEST_DAILY_BUDGET_USD` / `DEMO_TOTAL_DAILY_BUDGET_USD` | Daily AI spend limit per guest / for all guests together (0 = unlimited) | `0.1` / `2` |
| `DEMO_MAX_GUESTS_PER_DAY` | New guest sessions per UTC day, across all visitors (plus 5 per IP per hour in production) | `200` |
| `LLM_PROVIDER` | `pollinations` \| `openai` \| `groq` \| `gemini` \| `ollama` \| `custom` | `pollinations` |
| `LLM_BASE_URL` / `LLM_API_KEY` | Override the preset endpoint / key (Pollinations reuses `POLLINATIONS_API_KEY`) | preset |
| `LLM_MODEL` | Main model (chat agent, text generation) | `openai/gpt-5.4-mini` |
| `LLM_FAST_MODEL` | Cheap model (prompt enhancement, titles) | `openai/gpt-5.4-nano` |
| `LLM_PRICING_JSON` | Pricing override, USD per 1M tokens | none |
| `LLM_FALLBACK_PROVIDER` / `_BASE_URL` / `_API_KEY` / `_MODEL` | Optional second provider used on outages | none |
| `EMBEDDING_PROVIDER` | `local` (in-process) \| `openai-compatible` | `local` |
| `EMBEDDING_MODEL` | Embedding model (must output 384 dimensions) | `Xenova/bge-small-en-v1.5` |
| `EMBEDDING_BASE_URL` / `EMBEDDING_API_KEY` | Hosted embedding API (when not local) | none |
| `TRANSFORMERS_CACHE_DIR` | Where the local model is cached | `./.cache/transformers` |
| `NODE_ENV` | `development` / `production` | `development` |
| `NEXT_PUBLIC_API_URL` | Backend API URL (client) | `http://localhost:4000/api` |
| `NEXT_PUBLIC_APP_URL` | Public app URL (client, SEO) | `http://localhost:3000` |

## API Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Health check (public, like `/api/demo` and `/api/auth/*`) |
| `GET` | `/api/demo` | Whether one-click guest sessions are open, their lifetime and budget (public) |
| `POST` | `/api/auth/sign-up/email` · `/sign-in/email` · `/sign-out` | Better Auth (sets / clears the session cookie) |
| `POST` | `/api/auth/sign-in/anonymous` | Opens a demo guest session, filled with a copy of the demo template |
| `GET` | `/api/auth/get-session` | Current session |
| `POST` | `/api/auth/api-key/create` · `GET /api/auth/api-key/list` · `POST /api/auth/api-key/delete` | API keys for MCP clients |
| `GET` | `/api/me` | Signed-in user (`isGuest`), today's AI spend vs budget, estimated spend on own keys, and a guest's expiry |
| `GET` | `/api/providers` | Text and image model catalog grouped by provider, with which providers the user has a key for |
| `PUT` · `DELETE` | `/api/providers/:provider/key` | Verify and store (`{ apiKey }`) / remove your OpenAI, Anthropic or Google key |
| `POST` | `/api/generations` | Submit a generation (`type`, `prompt`, `enhance`, `priority`, `parameters`, `llmModel`) |
| `GET` | `/api/generations` | List generations (paginated, filter by type/status) |
| `GET` | `/api/generations/:id` | Get one generation |
| `GET` | `/api/generations/:id/image` | Stored image bytes |
| `POST` | `/api/generations/:id/retry` · `/cancel` | Retry a failed / cancel a pending generation |
| `GET` | `/api/generations/sse` · `/sse/:id` | SSE stream of generation events |
| `POST` | `/api/documents` | Create a document from text |
| `POST` | `/api/documents/upload` | Upload `.txt` / `.md` / `.pdf` (multipart `file`) |
| `GET` | `/api/documents` · `/:id` · `/:id/chunks` | List / get / chunks |
| `POST` | `/api/documents/search` | Hybrid / vector / keyword search |
| `POST` | `/api/documents/:id/reindex` | Re-chunk and re-embed |
| `DELETE` | `/api/documents/:id` | Delete a document |
| `GET` | `/api/documents/sse` | SSE stream of document status events |
| `POST` | `/api/chat` | Chat agent (AI SDK UI message stream; optional `model`) |
| `GET` | `/api/chat/conversations` · `/:id` | List conversations / get one with messages |
| `DELETE` | `/api/chat/conversations/:id` | Delete a conversation |
| `GET` | `/api/traces` · `/traces/summary` | LLM call traces (filter by `traceId`, `name`) and aggregates |
| `POST` | `/api/mcp` | MCP server (Streamable HTTP) |

## AI Integration

**Providers.** Image generation uses the Pollinations image API. Text, chat, structured outputs and the eval judge go through the AI SDK. The included models run on an OpenAI-compatible endpoint: Pollinations by default (`openai/gpt-5.4-mini` and `openai/gpt-5.4-nano`, priced per token in Pollen ≈ USD), or OpenAI / Groq / Gemini / Ollama via `LLM_PROVIDER`. Users who add their own key can also pick OpenAI (`@ai-sdk/openai`, Responses API), Anthropic (`@ai-sdk/anthropic`) and Google (`@ai-sdk/google`) models.

**Image models:** loaded at startup from Pollinations' `GET /image/models` (a built-in list is used if it can't be reached). Only official models priced per image at $0.01 or less are included, because the app pays for them: token-priced and pricier models, community proxies and video models are left out, and requests naming them are rejected. Premium image models are available on the user's own key:, plus Gemini Nano Banana Pro / 2 / 2 Lite (`gemini-3-pro-image`, `gemini-3.1-flash-image`, `gemini-3.1-flash-lite-image`) on the user's Google key. Default: `platform:flux`. Ids stored on older generations (`flux`, `zimage`) still resolve.

**Costs.** Every call is priced from the provider's published rates and visible on the Traces page. A typical RAG chat turn with `gpt-5.4-mini` costs about $0.002; local embeddings cost nothing.

## What I would improve With More Time

- **Account features**: password reset, email verification, "Sign in with GitHub", roles and document sharing
- **Contract migration**: make `userId` NOT NULL once legacy rows are claimed
- **Conversation summarisation** instead of a plain sliding window
- **S3 storage** for images (the storage interface is already S3-shaped) and **Prisma migrations** instead of `db push` + startup DDL
- **Hosted tracing** (Langfuse / LangSmith / OpenTelemetry) fed from the existing `LlmCall` records
- **Reranking model** on top of hybrid retrieval; layout-aware PDF parsing / OCR
- **Cloud deployment** (AWS ECS Fargate, RDS with pgvector, ElastiCache, S3) with Terraform
- **Multi-agent creative workflow** (planner → prompt writer → critic with a vision model) as a queued, resumable run
