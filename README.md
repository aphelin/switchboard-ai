# Mini AI Toolkit

A fullstack web application for generating AI content (images and text) through a prompt-based interface with async job processing, real-time status updates, and a gallery view.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), TypeScript, TailwindCSS v4, shadcn/ui |
| Backend | NestJS 11, TypeScript |
| Database | PostgreSQL 16 with Prisma ORM 7 |
| Queue | BullMQ + Redis 7 |
| AI | Pollinations.ai (real API) |
| Infra | Docker + Docker Compose |

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
4. BullMQ worker picks up the job, calls Pollinations API via circuit breaker
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

## Features

### Core
- Prompt submission with type selection (Image / Text)
- Async job processing -- API never blocks until generation completes
- Job status tracking: PENDING → GENERATING → COMPLETED / FAILED
- Results display in gallery (images) and history (all types)
- Full generation history with filtering and pagination
- Graceful error handling for failures, timeouts, invalid prompts

### Bonus
- **Prompt enhancement**: AI-powered prompt improvement before image generation
- **Real-time updates**: SSE for live job status tracking
- **Queue management**: Cancel pending jobs, retry failed ones
- **User-defined parameters**: Model selection, image dimensions, seed
- **Circuit breaker**: Graceful degradation when Pollinations API is down
- **Structured logging**: Full request/response logging with Pino
- **Rate limiting**: Throttler to prevent abuse
- **Multiple generation types**: Image + Text generation
- **Docker**: Full docker-compose setup for one-command deployment

## Setup Instructions

### Prerequisites

- Node.js 20+
- Docker and Docker Compose (for containerized setup)
- PostgreSQL 16 (for local dev without Docker)
- Redis 7 (for local dev without Docker)

### Option 1: Docker (Recommended)

```bash
# Clone the repo
git clone <repo-url>
cd mini-ai-toolkit

# Set your Pollinations API key
cp .env.example .env
# Edit .env and set POLLINATIONS_API_KEY=sk_your_key_here

# Start everything
docker compose up --build
```

The app will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:4000/api

### Option 2: Local Development

```bash
# 1. Start PostgreSQL and Redis locally (or via Docker)
docker compose up postgres redis -d

# 2. Backend setup
cd server
cp ../.env.example .env
# Edit .env with your values
npm install
npx prisma db push
npm run start:dev

# 3. Frontend setup (new terminal)
cd client
npm install
npm run dev
```

## Environment Variables

| Variable | Description | Default |
|----------|------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/mini_ai_toolkit` |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `POLLINATIONS_API_KEY` | Pollinations.ai API key (sk_...) | -- |
| `SERVER_PORT` | Backend server port | `4000` |
| `NEXT_PUBLIC_API_URL` | Backend API URL for frontend | `http://localhost:4000/api` |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/generations` | Submit a new generation |
| `GET` | `/api/generations` | List generations (paginated, filterable) |
| `GET` | `/api/generations/:id` | Get single generation |
| `POST` | `/api/generations/:id/retry` | Retry a failed generation |
| `POST` | `/api/generations/:id/cancel` | Cancel a pending generation |
| `GET` | `/api/generations/sse` | SSE stream for real-time updates |

## Project Structure

```
mini-ai-toolkit/
├── client/                          # Next.js 16 frontend
│   ├── src/
│   │   ├── app/                     # App Router pages
│   │   ├── components/              # React components + shadcn/ui
│   │   ├── hooks/                   # Custom hooks (SSE, data fetching)
│   │   └── lib/                     # API client, types, utilities
│   ├── Dockerfile
│   └── .mcp.json                    # Next.js DevTools MCP config
├── server/                          # NestJS backend
│   ├── src/
│   │   ├── config/                  # Configuration + Zod env validation
│   │   ├── shared/                  # Filters, logger, throttler, circuit breaker
│   │   ├── prisma/                  # Prisma module + service
│   │   ├── generation/              # Core generation module
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   ├── repositories/        # Repository pattern
│   │   │   ├── processors/          # BullMQ job processor
│   │   │   ├── dto/                 # Request validation DTOs
│   │   │   └── types/
│   │   ├── pollinations/            # Pollinations API integration
│   │   └── sse/                     # Server-Sent Events
│   ├── prisma/                      # Prisma schema
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```

## AI Integration

**Real API**: This project uses the [Pollinations.ai](https://pollinations.ai) API for both image and text generation. Pollinations provides an OpenAI-compatible text API and a simple GET-based image generation endpoint.

**Why Pollinations**: Free tier available, supports multiple models (Flux, GPT Image, Seedream), simple API design where the URL itself serves as the stable image URL, and OpenAI-compatible text generation.

## What I'd Improve With More Time

- **Authentication**: Add user accounts with NextAuth.js for per-user generation history
- **Image storage**: Upload generated images to S3/Cloudflare R2 instead of relying on Pollinations URLs
- **WebSocket**: Migrate from SSE to WebSocket for bidirectional communication
- **Testing**: Add unit tests (Jest) and E2E tests (Playwright) for both frontend and backend
- **Monitoring**: Add Prometheus metrics, health checks dashboard, BullMQ board UI
- **Rate limiting per user**: More granular throttling with user-level limits
- **Caching**: Redis-based response caching for gallery queries
- **CI/CD**: GitHub Actions pipeline with linting, testing, Docker build, and deployment
- **Prompt templates**: Pre-built prompt templates for common generation types
- **Generation cost tracking**: Track API usage and costs per generation
