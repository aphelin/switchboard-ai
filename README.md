# Mini AI Toolkit

A fullstack web application for generating AI content (images and text) through a prompt-based interface with async job processing, real-time status updates, and a gallery view.

---

> **AI Development Session Logs**
> The full AI-assisted development chat history for this project is available in the `[AI-history/](./AI-history)` directory. Each file is a readable transcript of a Cursor AI session, covering architecture decisions, implementation details, and debugging.

---

## Tech Stack

| Layer    | Technology                                                     |
| -------- | -------------------------------------------------------------- |
| Frontend | Next.js 16 (App Router), TypeScript, TailwindCSS v4, shadcn/ui |
| Backend  | NestJS 11, TypeScript                                          |
| Database | PostgreSQL 16 with Prisma ORM 7                                |
| Queue    | BullMQ + Redis 7                                               |
| AI       | Pollinations.ai (real API)                                     |
| Infra    | Docker + Docker Compose                                        |

## Architecture Overview

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Next.js    │────▸│   NestJS     │────▸│  PostgreSQL  │
│   Client     │◂───▸│   Server     │     │              │
│  (port 3000) │ SSE │  (port 4000) │     └──────────────┘
└──────────────┘     │              │     ┌──────────────┐
                     │  BullMQ ─────┼────▸│    Redis     │
                     │  Worker      │     └──────────────┘
                     │       │      │
                     │       ▼      │     ┌──────────────┐
                     │  Circuit  ───┼────▸│ Pollinations │
                     │  Breaker     │     │     API      │
                     └──────────────┘     └──────────────┘
```

**Request flow:**

1. User submits a prompt via the frontend
2. Backend creates a Generation record (PENDING) and enqueues a BullMQ job
3. API returns immediately (non-blocking)
4. BullMQ worker picks up the job, calls the Pollinations API via circuit breaker
5. On completion/failure, updates the DB and emits SSE events
6. Frontend receives real-time updates via Server-Sent Events

## Tech Choices Rationale

- **Next.js 16**: Latest App Router with Turbopack for fast development, React 19 features, built-in optimizations
- **NestJS**: Enterprise-grade Node.js framework with excellent TypeScript support, dependency injection, modular architecture
- **BullMQ + Redis**: Production-ready job queue for async processing with retry/backoff, priority, and monitoring
- **Prisma 7**: Type-safe ORM with excellent DX, schema-first approach, migrations
- **Pollinations.ai**: Real AI API (not mocked) supporting image and text generation with OpenAI-compatible endpoints
- **Opossum Circuit Breaker**: Prevents cascading failures when the external AI API is down
- **SSE over WebSocket**: Simpler protocol for unidirectional server-to-client updates, auto-reconnect, works through proxies
- **shadcn/ui**: High-quality, accessible components built on Radix UI with full customization

### Design Philosophy

The codebase deliberately avoids clean architecture patterns (e.g., strategy and factory for swappable AI providers). While such patterns would enable swapping AI implementations, they introduce significant boilerplate. This project follows **KISS** (Keep It Simple, Stupid) and **YAGNI** (You Aren't Gonna Need It) principles, prioritizing simplicity over hypothetical extensibility.

## Features

### Core

- Prompt submission with type selection (Image / Text)
- Async job processing — API never blocks until generation completes
- Job status tracking: PENDING → GENERATING → COMPLETED / FAILED
- Results display in gallery (images) and history (all types)
- Full generation history with filtering and pagination
- Graceful error handling for failures, timeouts, and invalid prompts

### Bonus

- **Prompt enhancement**: AI-powered prompt improvement before image generation
- **Real-time updates**: SSE for live job status tracking
- **Queue management**: Cancel pending jobs, retry failed ones
- **Job priority**: High / Normal / Low priority levels for generation queue ordering
- **User-defined parameters**: Model selection, image dimensions, seed
- **Circuit breaker**: Graceful degradation when the Pollinations API is down
- **Structured logging**: Full request/response logging with Pino
- **Rate limiting**: Multi-tier throttler to prevent abuse (per-second, per-minute, per-hour)
- **Multiple generation types**: Image + Text generation
- **Docker**: Full Docker Compose setup for one-command deployment (dev and production configs)

## Setup Instructions

### Prerequisites

- Node.js 20+
- Docker and Docker Compose

### Environment Files

The application requires `.env.development` and `.env.production` files in both the `server/` and `client/` directories. These files are not committed to the repository.

**1. Server environment files**

Create `server/.env.development` and `server/.env.production` with the following content:

```bash
# PostgreSQL
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=mini_ai_toolkit
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/mini_ai_toolkit?schema=public

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# Pollinations API
POLLINATIONS_API_KEY=your_pollinations_api_key

# Server
SERVER_PORT=4000
CLIENT_URL=http://localhost:3000

NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

For production, also add `NODE_ENV=production`.

**2. Client environment files**

Create `client/.env.development` and `client/.env.production` with the following content:

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> A root-level `.env.example` file is provided as a reference for all variables.

### Option 1: Docker — Development (Recommended)

```bash
# Clone the repo
git clone <repo-url>
cd mini-ai-toolkit

# Create the environment files as described above, then start everything
docker compose -f docker-compose.dev.yml up --build
```

This starts PostgreSQL, Redis, the NestJS server (with hot reload), and the Next.js client (with Turbopack). Source code is volume-mounted for live changes.

### Option 2: Docker — Production

```bash
docker compose -f docker-compose.prod.yml up --build
```

### Option 3: Local Development (without Docker for app services)

```bash
# 1. Start PostgreSQL and Redis via Docker
docker compose -f docker-compose.dev.yml up postgres redis -d

# 2. Backend setup
cd server
npm install
npx prisma db push
npm run start:dev

# 3. Frontend setup (new terminal)
cd client
npm install
npm run dev
```

> When running locally (outside Docker), set `REDIS_HOST=localhost` and update `DATABASE_URL` to use `localhost` instead of `postgres` as the host.

The app will be available at:

- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend API: [http://localhost:4000/api](http://localhost:4000/api)

## Environment Variables

| Variable               | Description                                   | Default                                                                      |
| ---------------------- | --------------------------------------------- | ---------------------------------------------------------------------------- |
| `POSTGRES_USER`        | PostgreSQL username                           | `postgres`                                                                   |
| `POSTGRES_PASSWORD`    | PostgreSQL password                           | `postgres`                                                                   |
| `POSTGRES_DB`          | PostgreSQL database name                      | `mini_ai_toolkit`                                                            |
| `DATABASE_URL`         | PostgreSQL connection string                  | `postgresql://postgres:postgres@postgres:5432/mini_ai_toolkit?schema=public` |
| `REDIS_HOST`           | Redis host                                    | `redis` (Docker) / (local)                                                   |
| `REDIS_PORT`           | Redis port                                    | `6379`                                                                       |
| `POLLINATIONS_API_KEY` | Pollinations.ai API key                       | none, get one at [pollinations.ai](https://pollinations.ai)                  |
| `SERVER_PORT`          | Backend server port                           | `4000`                                                                       |
| `CLIENT_URL`           | Allowed CORS origin for the frontend          | `http://localhost:3000`                                                      |
| `NODE_ENV`             | Node environment (`development`/`production`) | `development`                                                                |
| `NEXT_PUBLIC_API_URL`  | Backend API URL (used by the Next.js client)  | `http://localhost:4000/api`                                                  |
| `NEXT_PUBLIC_APP_URL`  | Public app URL (used for sitemap/SEO)         | `http://localhost:3000`                                                      |

## API Endpoints

| Method | Path                          | Description                                             |
| ------ | ----------------------------- | ------------------------------------------------------- |
| `GET`  | `/api/health`                 | Health check                                            |
| `POST` | `/api/generations`            | Submit a new generation                                 |
| `GET`  | `/api/generations`            | List generations (paginated, filterable by type/status) |
| `GET`  | `/api/generations/:id`        | Get a single generation by ID                           |
| `POST` | `/api/generations/:id/retry`  | Retry a failed generation                               |
| `POST` | `/api/generations/:id/cancel` | Cancel a pending generation                             |
| `GET`  | `/api/generations/sse`        | SSE stream for all real-time updates                    |
| `GET`  | `/api/generations/sse/:id`    | SSE stream for a single generation's updates            |

## AI Integration

**Real API**: This project uses the [Pollinations.ai](https://pollinations.ai) API for both image and text generation. Pollinations provides an OpenAI-compatible text API and a simple GET-based image generation endpoint.

**Why Pollinations**: Free tier available, supports multiple models, simple API design where the URL itself serves as the stable image URL, and OpenAI-compatible text generation.

**Supported image models:**

| Model            | Value          |
| ---------------- | -------------- |
| Flux Schnell     | `flux`         |
| Flux 2 Dev       | `flux-2-dev`   |
| GPT Image 1 Mini | `gptimage`     |
| Seedream         | `seedream`     |
| Imagen 4         | `imagen-4`     |
| Grok Imagine     | `grok-imagine` |
| Z-Image Turbo    | `zimage`       |
| Dirtberry        | `dirtberry`    |

## What I would improve With More Time

- **Authentication/Authorization**: Add JWT-based authentication and authorization, user accounts
- **Image storage**: Upload generated images to S3 instead of relying on Pollinations URLs, or store them locally and serve them with the `@nestjs/serve-static` library
- **Testing**: Add unit tests and E2E tests for both frontend and backend
- **Caching**: Redis-based response caching for gallery queries
- **CI/CD**: GitHub Actions pipeline with linting, testing, Docker build, and deployment
- **Video and audio generation**: Extend the generation pipeline to support video and audio since Pollinations.ai already provides those endpoints
