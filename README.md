# Mini AI Toolkit

A fullstack AI application: image and text generation with async job processing, a **RAG knowledge base** over your own documents (pgvector, hybrid search), a **streaming tool-using chat agent** with human approval for side effects, an **MCP server** that exposes the same capabilities to external agents, **LLM observability** (tokens, cost, latency per call) and an **evaluation harness** that runs in CI. Everything is **per user**: email + password accounts, API keys for MCP clients, and a daily AI spending limit.

Design notes and interview-oriented explanations live in [`docs/architecture.md`](./docs/architecture.md); the plan and cost notes in [`docs/ai-engineering-roadmap.md`](./docs/ai-engineering-roadmap.md).

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
| LLM layer     | Vercel AI SDK v7 over any **OpenAI-compatible** provider (Pollinations by default; OpenAI, Groq, Gemini, Ollama presets) |
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
│ MCP client │◂──────────────────────────────────▸│  llm ─▸ OpenAI-compatible provider         │
│ (Claude …) │                                     │  observability ─▸ Postgres (LlmCall)      │
└────────────┘                                     │  documents ─▸ Postgres + pgvector         │
                                                   │  circuit breakers ─▸ Pollinations / LLM   │
                                                   └───────────────────────────────────────────┘
```

**Generation flow:** submit prompt → `Generation` row (PENDING) → BullMQ job → worker calls the provider through a circuit breaker → image bytes stored locally and served by the API (`/api/generations/:id/image`) → DB updated → SSE event → UI updates.

**RAG flow:** upload document → `Document` row → ingestion job: chunk (LangChain splitter) → embed (local model) → pgvector → READY. Search = vector similarity + Postgres full-text, fused with Reciprocal Rank Fusion; every passage is scanned for prompt-injection patterns.

**Agent flow:** `POST /api/chat` → AI SDK `streamText` loop (max 6 steps) with tools `search_documents`, `list_documents`, `list_generations`, `get_generation`, `generate_image` (requires user approval) → UI message stream to the browser → messages persisted, conversation titled by the fast model.

Every model call goes through `LlmService` (provider registry, breaker, optional fallback provider, Zod-validated structured output with one repair attempt) and is recorded as an `LlmCall` (tokens, estimated cost, latency).

## Tech Choices Rationale

- **Vercel AI SDK as the LLM layer:** thin and typed, native streaming, tool calling and tool approval, provider-agnostic. LangChain is used only where it earns its place (text splitting).
- **OpenAI-compatible providers only:** one code path; switching from Pollinations to Groq/Gemini/OpenAI/Ollama is configuration. A second provider can be configured as a fallback for outages.
- **pgvector instead of a separate vector database:** one datastore, transactions across documents and chunks, full-text search for free, HNSW index for speed.
- **Local embeddings:** free, offline, identical in dev/CI/Docker, and fast enough at this scale; a hosted embedding API is a config switch.
- **Hybrid retrieval + RRF:** vectors catch paraphrases, keywords catch exact identifiers and commands; RRF merges them without score calibration.
- **Human-in-the-loop for image generation:** the tool has a cost and a visible side effect, so the agent asks first.
- **Own tracing table:** no extra services to run; the schema maps 1:1 to a hosted tracer (Langfuse/LangSmith) later.
- **BullMQ + Redis, SSE, NestJS, Prisma, shadcn/ui:** as in the original project (see git history), they are also the foundation the agent builds on: the agent's image tool simply waits on the existing queue.

### Design Philosophy

The original project deliberately avoided provider abstractions (KISS/YAGNI). Multi-provider support became a real requirement, so the abstraction now exists, at the narrowest useful point: one `LlmService`, configured by environment, with everything else unaware of which provider is behind it.

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

### MCP server

- `POST /api/mcp` (Streamable HTTP, stateless): tools `generate_image`, `generate_text`, `list_generations`, `get_generation`, `search_documents`, `ask_documents`, `list_documents`, `add_document`, `delete_document`; resource `document://{id}`
- Works with Claude Code, Claude Desktop and the MCP Inspector

### Observability and evaluation

- `LlmCall` trace per model call: name, trace id, provider, model, tokens, cached tokens, estimated cost (Pollinations prices loaded at startup), latency, status; `/traces` page with summaries by model and by feature
- Eval harness (`server/evals`): retrieval hit@k and MRR (free, deterministic) plus LLM-as-judge correctness/faithfulness, abstention on unanswerable questions and a prompt-injection test; thresholds fail CI
- Vitest unit tests for the pure logic (RRF, chunking, injection scanner, pricing, history trimming)

### Accounts and access

- Sign-in / sign-up modal (email + password); sessions are database rows behind an httpOnly cookie (7 days, renewed on use, revoked instantly on sign-out)
- Every route requires a user except `/api/health`; documents, chats, generations, images, live updates and traces are scoped to their owner
- Retrieval filters by owner inside the SQL; agent tools get the user id from the session, never from the model
- API keys (`mat_…`, stored hashed, revocable) authenticate MCP clients and scripts
- Per-user daily AI budget (`USER_DAILY_BUDGET_USD`) and per-user rate limits

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
```

### Connecting an MCP client

```bash
# Claude Code
# Create a key first: user menu -> API keys
claude mcp add --transport http mini-ai-toolkit http://localhost:4000/api/mcp --header "x-api-key: mat_..."

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
| `CLIENT_URL` | Allowed CORS origin | `http://localhost:3000` |
| `STORAGE_DIR` | Directory for generated images | `./storage` |
| `BETTER_AUTH_SECRET` | Secret for session cookies (`openssl rand -base64 32`) | required |
| `BETTER_AUTH_URL` | Origin the auth endpoints run on | `SERVER_PUBLIC_URL` |
| `USER_DAILY_BUDGET_USD` | Per-user daily AI spend limit in USD (0 = unlimited) | `0.5` |
| `AUTH_CLAIM_LEGACY_DATA` | First account created takes ownership of rows from before auth | `false` |
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
| `GET` | `/api/health` | Health check (the only public route besides `/api/auth/*`) |
| `POST` | `/api/auth/sign-up/email` · `/sign-in/email` · `/sign-out` | Better Auth (sets / clears the session cookie) |
| `GET` | `/api/auth/get-session` | Current session |
| `POST` | `/api/auth/api-key/create` · `GET /api/auth/api-key/list` · `POST /api/auth/api-key/delete` | API keys for MCP clients |
| `GET` | `/api/me` | Signed-in user and today's AI spend vs budget |
| `POST` | `/api/generations` | Submit a generation (`type`, `prompt`, `enhance`, `priority`, `parameters`) |
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
| `POST` | `/api/chat` | Chat agent (AI SDK UI message stream) |
| `GET` | `/api/chat/conversations` · `/:id` | List conversations / get one with messages |
| `DELETE` | `/api/chat/conversations/:id` | Delete a conversation |
| `GET` | `/api/traces` · `/traces/summary` | LLM call traces (filter by `traceId`, `name`) and aggregates |
| `POST` | `/api/mcp` | MCP server (Streamable HTTP) |

## AI Integration

**Providers.** Image generation uses the Pollinations image API. Text, chat, structured outputs and the eval judge go through the AI SDK to an OpenAI-compatible endpoint: Pollinations by default (`openai/gpt-5.4-mini` and `openai/gpt-5.4-nano`, priced per token in Pollen ≈ USD), or OpenAI / Groq / Gemini / Ollama via `LLM_PROVIDER`.

**Supported image models:** `flux` (default), `flux-2-dev`, `gptimage`, `seedream`, `imagen-4`, `grok-imagine`, `zimage`, `dirtberry`.

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
