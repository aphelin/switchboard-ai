# Mini AI toolkit project requirements
_Exported on 3/11/2026 at 18:40:22 GMT+4 from Cursor (2.6.18)_

---

**User**

I have to create the AI toolkit project, a full stack web application. Where I will use Next.js on the front end and Nest.js on back, as for database PostgreSQL. 

1) For next.js use latest version which is 16, app route + typescript
2) For back go with nest.js + typescript
3) Use next-devtools-mcp to retrieve up to date information from official next.js docs

Add next-devtools-mcp to the .mcp.json file at the root of project: 

{
  "mcpServers": {
    "next-devtools": {
      "command": "npx",
      "args": ["-y", "next-devtools-mcp@latest"]
    }
  }
}

For backend use libraries such as nestjs/axios, nestjs/config, nestjs/throttler, helmet, class-validator class transformer to validate incomign requests. For logging use nestjs-pino, pino-http, pino-pretty for structured logging. Validate ENVs with zod, add global exception filter. Also I am thinking of using bullMQ and redis for advance message job processing as requirements say. We need prisma ORM, db should be postgresql. 

For front end go with TailwindCSS and shadcn, we will need SSE for front and back. Make it fully responsive

We will use pollinations API, this is the API docs - https://enter.pollinations.ai/api/docs, I will add api secret/key manually in env file. I have read on pollinations docs that it returns image url so use db to store them, in order to show it on a gallery page.

Also implement opossum circuit breaker, follow SOLID principles for nest.js and structure each nest.js module the same way as a well organized nest.js project  each module should have explicit subfolders for controllers/, services/, dto/, types/. Shared concerns like filters, logger, throttler, constants go under a shared/ folder. Config module lives at the top level of the code in src folder under config/.
+ clean code and repository pattern. 

I was thinking of strategy + factory pattern as well as clean architecture but it is too much for this project in my opinion so ignore it. We also need individual docker files for both front end back and one composer, as well as readme.

Now I am giving you the additional requirements to take note of

Your Task: Build a "Mini AI Toolkit"
Create a fullstack app where users generate AI content (images, text, or any creative media) through a prompt-based interface. The system should handle generation asynchronously and display results in a gallery or feed.
Mandatory Requirements: • Prompt submission UI • Async job processing — API response must NOT block until generation completes • Job status tracking (pending → generating → completed/failed) • Results display — gallery or feed with completed generations • Generation history — all past generations visible • Error handling — graceful handling of failures, timeouts, invalid prompts • AI integration — real API or mock service (see below)
AI Integration — pick one: • Real API (bonus points): Any free service — Pollinations.ai (no auth needed),
Tech Stack: • Frontend: Next.js + TypeScript • Backend: Node.js + TypeScript • Database: any (PostgreSQL preferred, SQLite/MongoDB fine) • UI: your choice (Tailwind, MUI, shadcn, plain CSS — must look decent) • Docker: bonus for running everything with one command
Bonus Points For: Multiple generation types · prompt enhancement · real-time updates (WebSocket/SSE) · queue management (cancel, retry, priority) · user-defined parameters · any creative feature you think of
README in the Repo Include: setup instructions, tech choices rationale, what you'd improve with more time, bonus features added, and whether you used real AI or mock (and why).

---

**Cursor**

Let me start by exploring the current workspace and gathering information from the Pollinations API docs and the Next.js devtools MCP.

Let me check the MCP tools available and gather more info about Next.js 16.

Now I have a thorough understanding of the requirements. Let me create a detailed plan.

---

**User**

Instead of folders named frontend and backend, name it client and server. In addition to this, move next.js mcp file to client

---

**Cursor**

I'll update the plan to rename `frontend` to `client` and `backend` to `server`, and move the `.mcp.json` file into `client/` instead of the project root.

Now update all references from `frontend`/`backend` to `client`/`server` throughout the plan body.

The plan has been updated with both changes:

1. **Renamed `frontend/` to `client/`** and **`backend/` to `server/`** everywhere -- project structure, directory layouts, Dockerfiles, docker-compose services, and todo descriptions.
2. **Moved `.mcp.json` into `client/`** instead of the project root, so it lives alongside the Next.js project at `client/.mcp.json`.

---

**User**

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

I'll start implementing the full project now, beginning with the monorepo scaffolding. Let me work through each todo systematically.

Now let me initialize both projects in parallel. I'll scaffold the NestJS server and Next.js client.

NestJS scaffolded. Now let me install all server dependencies and initialize the Next.js client in parallel.

Now initialize Prisma and the Next.js client project in parallel.

Need to handle conflicts. Let me move the .mcp.json temporarily and run prisma with proper permissions.

Let me check what we have so far and fix the issues.

Good, both have basic structures. Let me check the client src and also the Next.js package.json to see what version we got.

Next.js 16.1.6 is installed. Prisma has been initialized. Now let me install client dependencies and remove the .git from client (we don't want nested git repos). Let me also set up the Prisma schema.

Good. Now let me install shadcn/ui and lucide-react for the client, and also install the remaining client deps.

Shadcn is initialized. Now let me install all the shadcn components we'll need and also mark the backend setup as complete.

Good. Now let me mark the setup tasks as done and start building the backend. I'll work on the config module, Prisma schema, and shared module. Let me clean up the default NestJS files first and start creating the actual architecture.

Now let me remove the default NestJS controller/service files and create the config module. I'll use multiple parallel task agents to build several backend modules at once.

Now let me read the current server tsconfig to understand the setup, then start creating all the backend files. I'll create them in batches.

Now let me create all backend files. I'll start with the config module, shared module, and Prisma setup in parallel.

Now the shared module files:

Now let me create the Prisma schema, module, service, and all the core backend modules.

Now let me generate the Prisma client and then create the generation module files.

Prisma 7 requires a different configuration approach. Let me check the existing config file and update.

Good, Prisma 7 uses `prisma.config.ts` for the datasource URL. Let me update the schema to remove the `url` property and install dotenv.

Prisma client generated. Now let me also update the PrismaService to work with Prisma 7's new client pattern. Let me check what the generated client looks like.

Now I understand. Prisma 7 requires `@prisma/adapter-pg` and the `pg` driver. Let me install those.

Now update the PrismaService to use the adapter pattern for Prisma 7:

Now let me create all the remaining backend module files. Let me create the generation types, DTOs, repository, service, controller, processor, and the pollinations + SSE modules.

Now the SSE module:

Now the generation service, processor, controller, and module:

Now let me wire up the AppModule and main.ts, along with a health controller:

Let me verify the server builds successfully:

I need to fix the import paths for Prisma (needs `.js` extension with `nodenext`) and fix the circuit breaker types. Let me fix these issues.

The Prisma generated files use ESM. With `nodenext` module resolution, I need to use `.js` extensions. But the simpler approach is to re-export from the Prisma client using a barrel file. Let me fix this by adjusting the import approach and also the circuit breaker types.

Server builds cleanly. Now let me update all the backend todos and move to the frontend.

Now let me build the frontend. Let me first check what shadcn set up, then create all the frontend files.

Good, shadcn is properly configured with dark mode support. Now let me create the frontend directory structure and all the files. I'll create them efficiently.

Now let me create the types, API client, hooks, and then all the components and pages. I'll start with the foundational files.

Now let me create all the UI components - navbar, status badge, prompt form, job tracker, gallery grid, generation card, and generation history.

Now let me create the layout, pages, and the next.config.ts. I'll also update the root layout.

Now let me build the client to verify there are no errors:

The shadcn `Select` `onValueChange` can return `null`. Let me fix the type issue.

The `onValueChange` expects `(value: string | null, ...)`. Let me fix the parameter types.

Same issue in prompt-form. The shadcn Select's `onValueChange` passes `string | null`.

Client builds successfully. Now let me update todos and move to Docker setup.

Now let me create the Docker setup files.

For the standalone Next.js output, I need to enable it in next.config.ts:

Now let me also add `.dockerignore` files and create the `server/.env` file for local development, then move on to the README.

Now the README:

Now let me also create the `.env` file for local development with the server:

Now let me do a final comprehensive check -- verify the server builds, make sure everything is clean, and look at the overall project structure.

Both build successfully. Let me also verify the overall project structure:

All todos are complete. Here's a summary of everything that was built:

---

**Mini AI Toolkit** -- the full-stack project is now fully scaffolded and builds cleanly.

### What was created:

**Server (`server/`)** -- NestJS 11 + TypeScript
- `config/` -- Zod-validated environment variables, typed config files for app, database, Redis, and Pollinations
- `shared/` -- Global exception filter, Pino structured logger, throttler rate limiting, constants, and an Opossum circuit breaker service
- `prisma/` -- Prisma 7 ORM with PostgreSQL adapter, Generation model with proper enums and indexes
- `generation/` -- Full CRUD controller, service with BullMQ queue integration, repository pattern for data access, job processor, DTOs with class-validator
- `pollinations/` -- Pollinations API service with circuit breaker wrapping image + text generation, plus a prompt enhancement feature
- `sse/` -- Server-Sent Events controller and service for real-time job status updates
- `main.ts` -- Wired with helmet, CORS, ValidationPipe, global exception filter, and Pino logger

**Client (`client/`)** -- Next.js 16 + TypeScript + TailwindCSS v4 + shadcn/ui
- `/` -- Home page with prompt form (type selector, image parameters, AI enhancement toggle) and active job tracker
- `/gallery` -- Responsive grid of completed image generations with hover previews and click-to-expand dialogs
- `/history` -- Filterable, paginated generation history with retry/cancel actions
- `useSSE` hook for auto-reconnecting EventSource
- `useGenerations` hook for data fetching with SSE-driven live updates

**Infrastructure**
- Individual multi-stage Dockerfiles for both client and server
- `docker-compose.yml` with PostgreSQL, Redis, server, and client services
- `.env.example`, `.gitignore`, `.dockerignore` files
- `.mcp.json` in `client/` for Next.js DevTools MCP

**Both projects compile without errors.** To run locally, set your `POLLINATIONS_API_KEY` in the server `.env` file, start PostgreSQL + Redis (via `docker compose up postgres redis -d`), then run `npm run start:dev` in `server/` and `npm run dev` in `client/`.

---

**User**

@/home/giorgi/Desktop/projects/mini-ai-toolkit/ Review entire project, all files and check if all requirements are met.

---

**Cursor**

Let me do a thorough review of the entire project against all requirements. I'll explore everything systematically.

The review found several real issues. Let me fix them all systematically.

**Issues found across the project:**

| # | Severity | Issue |
|---|----------|-------|
| 1 | High | `PrismaService` reads `DATABASE_URL` directly but config module registers it as `database.url` |
| 2 | High | SSE `streamOne` uses `@Query('id')` instead of `@Param('id')` |
| 3 | High | `JobTracker` `refreshKey` logic creates a new object each render -- refetch never fires |
| 4 | Medium | No health endpoint on the server |
| 5 | Medium | ENV validation may receive nested config object instead of raw `process.env` |
| 6 | Medium | `ThemeProvider` missing for `next-themes` / `Sonner` |
| 7 | Medium | No server healthcheck in `docker-compose.yml` |
| 8 | Medium | No `prisma` scripts in `server/package.json` |
| 9 | Low | `updateStatus` uses `status as any` -- should be typed |

Let me fix all of them now.

Now let me also read the remaining files I need to fix:

Now let me also read the sonner component to understand the ThemeProvider issue:

Good. Now I have all the context. Let me fix all the issues. I'll apply them all in parallel batches.

**Fix 1**: PrismaService - use `database.url` from config (or just use `process.env.DATABASE_URL` directly since config registers it under a namespace)

**Fix 2**: SSE controller - `@Query` to `@Param`

**Fix 3**: JobTracker - proper `useRef` + `useEffect`

**Fix 4**: Add health endpoint to server

**Fix 5**: ENV validation - validate `process.env` directly

**Fix 6**: ThemeProvider for next-themes

**Fix 7**: docker-compose - add server healthcheck

**Fix 8**: package.json - add prisma scripts

**Fix 9**: Repository `updateStatus` - proper typing

Now fix the JobTracker, add ThemeProvider, add health endpoint, update docker-compose and package.json:

Now update the layout to use ThemeProvider, and check if `next-themes` is installed:

Good, it's installed (shadcn added it). Now update the layout:

Now add the health endpoint and add prisma scripts to server package.json:

Now add prisma scripts to package.json and add server healthcheck to docker-compose:

Now let me also fix the `generation.service.ts` and `generation.processor.ts` to pass properly typed status strings to the repository:

Good -- the service and processor already pass string literals like `'PENDING'`, `'GENERATING'`, `'COMPLETED'`, `'FAILED'`, `'CANCELLED'` to the repository, which will now accept the union type properly.

Now let me also remove the unused `let PrismaClient: any;` line from prisma.service.ts and verify both projects build:

Both build successfully. Let me now do a final checklist verification of all requirements against the implementation:

Everything looks correct. Here's the complete review and summary of all fixes applied:

---

## Review Complete -- All Fixes Applied

### Bugs Fixed (9 total)

| # | Severity | What was wrong | Fix applied |
|---|----------|----------------|-------------|
| 1 | **High** | `PrismaService` used `configService.get('DATABASE_URL')` but config registers it as `database.url` via `registerAs('database', ...)` -- DB connection would fail | Changed to `configService.get('database.url')` |
| 2 | **High** | SSE `streamOne` used `@Query('id')` for a path param `sse/:id` -- the `id` would always be `undefined` | Changed to `@Param('id')` |
| 3 | **High** | `JobTracker` created `prevKeyRef` as a plain object every render -- `refreshKey !== prevKeyRef.current` was always false, so refetch never triggered on new generation | Replaced with proper `useRef` + `useEffect` |
| 4 | **Medium** | No health endpoint -- plan required `GET /api/health`, docker-compose had no way to healthcheck the server | Added `HealthController` with `GET /api/health`, registered in `AppModule` |
| 5 | **Medium** | ENV validation received the merged config object (with nested keys from `load`) instead of raw `process.env` -- Zod schema expects flat env keys | Changed `validate` to explicitly pass `process.env` |
| 6 | **Medium** | `Sonner` toaster uses `useTheme()` from `next-themes` but no `ThemeProvider` was wrapping the app -- would error or silently fail | Added `ThemeProvider` component, wrapped the root layout |
| 7 | **Medium** | No server healthcheck in `docker-compose.yml` -- client couldn't use `service_healthy` condition | Added `healthcheck` to server service hitting `/api/health`, updated client `depends_on` to use `condition: service_healthy` |
| 8 | **Medium** | No prisma-related scripts in `server/package.json` | Added `prisma:generate`, `prisma:push`, `prisma:migrate`, `prisma:studio` scripts |
| 9 | **Low** | `updateStatus` in repository used `status as any` -- bypassed type safety | Changed parameter type to the proper union `'PENDING' \| 'GENERATING' \| 'COMPLETED' \| 'FAILED' \| 'CANCELLED'` |

### Requirements Checklist

| Requirement | Status |
|-------------|--------|
| Next.js 16 + App Router + TypeScript | Implemented (16.1.6) |
| NestJS + TypeScript | Implemented (v11) |
| `.mcp.json` in `client/` with next-devtools | Present |
| TailwindCSS v4 + shadcn/ui | Configured, 11 shadcn components installed |
| Fully responsive UI | 3 breakpoints (mobile/tablet/desktop) across all pages |
| `@nestjs/axios`, `@nestjs/config`, `@nestjs/throttler` | All used |
| `helmet` | Applied in `main.ts` |
| `class-validator` + `class-transformer` | DTOs with decorators |
| `nestjs-pino`, `pino-http`, `pino-pretty` | Logger module configured |
| ENV validation with Zod | `env.validation.ts` with safeParse |
| Global exception filter | `GlobalExceptionFilter` applied globally |
| BullMQ + Redis for async job processing | Queue + processor + worker pattern |
| Prisma ORM + PostgreSQL | Schema with enums, indexes, PrismaService with pg adapter |
| Pollinations.ai integration (real API) | Image generation (GET), Text generation (POST), Prompt enhancement |
| Opossum circuit breaker | Wraps both image and text API calls |
| SOLID principles + repository pattern | Single responsibility services, DI throughout, `GenerationRepository` |
| Module structure: controllers/services/dto/types | All modules follow the pattern |
| `shared/` folder (filters, logger, throttler, constants, circuit-breaker) | All present |
| `config/` at src top level | Present with Zod validation |
| SSE for real-time updates (front + back) | `SseService` + `SseController` + `useSSE` hook |
| Prompt submission UI | `PromptForm` with Image/Text toggle, parameters |
| Async job processing (non-blocking API) | POST returns 201 immediately, BullMQ processes |
| Job status tracking (PENDING -> GENERATING -> COMPLETED/FAILED) | DB status + SSE events |
| Gallery page | Responsive grid of completed image generations |
| Generation history | Filterable, paginated, with retry/cancel actions |
| Error handling | Global filter, circuit breaker fallbacks, toast notifications |
| Health endpoint | `GET /api/health` |
| Docker: individual Dockerfiles + docker-compose | Multi-stage builds, 4 services, healthchecks, volumes |
| README | Setup instructions, tech rationale, architecture, bonus features, improvements |
| Prompt enhancement (bonus) | AI-enhanced prompts via text API |
| Queue management (cancel, retry) | Both implemented |
| User-defined parameters (model, dimensions, seed) | Configurable in prompt form |
| Rate limiting (throttler) | 30 req/60s |

