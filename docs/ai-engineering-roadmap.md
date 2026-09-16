# AI Engineering Roadmap & Notes

Notes for extending Switchboard AI into a portfolio project that covers a typical "Senior AI Node.js Engineer" job description (RAG, agents, MCP, evals, cloud, CI/CD).

> Written 2026-09-13. Free tiers, pricing and framework landscape change often. Re-check before relying on numbers.

---

## 1. Current state of the project

**Already covered (good interview talking points):**

- Async job processing with BullMQ + Redis (retries, backoff, priority), which is the same foundation long-running agent runs need
- Real-time streaming to the UI via SSE
- Circuit breaker around the external AI API (Opossum)
- Structured logging (Pino), rate limiting, Docker Compose for dev and prod
- AI-assisted development history in `AI-history/`

**Issues found while running locally (all fixed on 2026-09-13):**

- **API key leaked to the browser.** Image URLs pointed at Pollinations with `key=...` in the query string. Images are now downloaded by the worker, stored locally (`StorageService`) and served from `GET /api/generations/:id/image`.
- **Circuit breaker hid auth errors.** A `401` was reported as "service temporarily unavailable" and counted toward opening the breaker. 4xx errors are now excluded (`errorFilter`) and the real upstream error is surfaced.
- **Rate limiting was configured but never enforced.** `ThrottlerGuard` is now a global guard; SSE, image and MCP routes are exempt.

**Implemented on 2026-09-13** (see [`architecture.md`](./architecture.md) for the design): LLM layer with provider abstraction, circuit breaker, fallback, structured outputs and cost tracing; RAG (pgvector, hybrid search, RRF, injection scanner); streaming tool-using chat agent with human approval; MCP server; evals with LLM-as-judge; CI workflow; Documents / Chat / Traces pages.

**Implemented on 2026-09-14:** authentication and per-user data isolation (architecture §9); multi-provider models with bring-your-own-key: OpenAI, Anthropic and Google on users' encrypted keys next to the free Pollinations default, with a model picker (architecture §10). Next: run the eval set across providers and compare quality, cost and latency.

**Running locally without Docker for app services:**

- `docker compose -f docker-compose.dev.yml up postgres redis -d`
- `server/.env.development` must use `localhost` for `DATABASE_URL` and `REDIS_HOST`
- Server: `cd server && npx prisma generate && npx prisma db push && npm run start:dev`
- Client: `cd client && npx next dev -p 3001` if port 3000 is taken (then set `CLIENT_URL=http://localhost:3001` on the server for CORS)
- `nest start --watch` does not reload `.env` changes, so restart the server after editing it

---

## 2. Job requirements → features to build

| Requirement | Feature | Where it fits |
|---|---|---|
| **RAG** | Document upload → chunk → embed → **pgvector** → retrieval with citations. Hybrid search (Postgres full-text + vector) and reranking. | Swap Postgres image to `pgvector/pgvector:pg16`. Ingestion as a BullMQ job. New "Chat with docs" page. |
| **LLM SDKs, tool use, agents** | Agent module using Anthropic/OpenAI SDK. Tools: `search_docs`, `generate_image` (existing pipeline), `get_generation`, `web_fetch`. | Agent loop runs in the BullMQ worker; each step streams to the UI over existing SSE. |
| **LangChain / LlamaIndex** | Agent as a **LangGraph.js** graph; RAG with LlamaIndex.TS or LangChain. | Same agent module. Be able to explain when a framework helps vs. plain SDK. |
| **Multi-agent** | Planner + researcher (RAG) + prompt writer + critic. Critic uses a vision model to score the image against the request and retries if poor. | Grows out of the existing "enhance prompt" feature. |
| **MCP** | Expose the toolkit as an **MCP server** (`generate_image`, `generate_text`, `search_docs`, `list_generations`). Also let the agent connect to external MCP servers. | New `mcp` module. Cheap to build, strong signal. |
| **Deterministic / reliability** | Structured output validated with Zod + retry on mismatch. Fixed workflows for predictable tasks, agents only where needed. Temperature 0 / seeds, cache by prompt hash, idempotency keys, guardrails. | Wraps the LLM service layer. |
| **Evaluation-driven** | Golden datasets. Retrieval metrics (recall@k / hit rate) and answer quality (faithfulness, relevance) with LLM-as-judge. Prompt versions stored in DB. | `evals/` folder, run in CI; score drop fails the build. |
| **CI/CD & cloud** | GitHub Actions: lint, tests, evals, Docker build. Deploy to AWS: ECS Fargate, RDS (pgvector), ElastiCache, S3 for images. | `.github/workflows/`, Terraform optional. |
| **Observability** | Tracing with **Langfuse** (self-hosted in Docker Compose); token count, cost and latency per generation. | New columns on `Generation` + one extra compose service. |
| **Nice-to-haves** | GraphRAG with **Neo4j** (entity extraction), voice agent (LiveKit Agents / OpenAI Realtime; Pipecat is Python), small Python service for embeddings or fine-tuning. | Only after the above. |

### Production concerns to add on top

- **Prompt-injection defenses** on agent tools, and a **human approval step** for risky or expensive actions (e.g. "generate 50 images")
- **Permission-aware retrieval**: documents have an owner, search results filtered by who is asking
- **Prompt caching and model routing** (easy requests → smaller/cheaper model), cost tracked per request
- **Zod-validated structured outputs** everywhere LLM output feeds into code
- **Multi-provider support with fallback** via an OpenAI-compatible interface. The README currently argues against provider abstraction (YAGNI); the requirement is now real, so explain why the decision changed.

### Suggested build order

1. RAG with pgvector + structured outputs
2. Agent with tools (reuse image/text pipeline), steps streamed over SSE
3. MCP server
4. Evals in CI
5. Tracing + cost tracking, then AWS deployment
6. Multi-agent critic loop, then GraphRAG or voice if time allows

Keep short notes on decisions while building (chunk size, workflow vs agent, what evals showed, what broke). Interviewers dig into trade-offs more than feature lists.

---

## 3. Cost: what's free and how to test

Almost everything runs locally in Docker. The parts that can cost money are LLM API calls and cloud hosting.

| Piece | Free? | Free way to test |
|---|---|---|
| RAG with pgvector | Yes, open source | Existing Docker Postgres. Embeddings via a local model in Ollama, or Gemini free tier. |
| LangGraph.js / LangChain / LlamaIndex.TS | Yes, open source | Local |
| MCP server | Yes, open source SDK | MCP Inspector (`npx @modelcontextprotocol/inspector`), then Claude Desktop / Claude Code as client |
| LLM for agents | Depends | **Groq**: free, no card, ~30 req/min, 14,400 req/day. **Gemini**: free Flash models ~10–15 req/min; Pro paid-only since April 2026; free-tier data used for training. **Ollama**: fully free, local hardware. **Pollinations**: free models like `flux` cost 0; premium models use paid Pollen credits. |
| Anthropic / OpenAI | Pay per use | Anthropic: one-time ~$5 trial credit for new accounts, no free tier. OpenAI trial credits not checked. |
| Evals | Code is free; judge calls cost tokens | Use a free-tier model as judge |
| Tracing | Yes | Langfuse self-hosted, or Langfuse Cloud Hobby (50k units/month). LangSmith Developer: 5k traces/month. |
| GitHub Actions | Yes | 2,000 Linux minutes/month on private repos; unlimited on public repos |
| AWS | Temporarily | New accounts: $100 + up to $100 more in credits; free plan ends after 6 months or when credits run out. Fargate/RDS burn credits, so deploy for the demo and set a billing alert. |
| Neo4j | Yes | Community Edition in Docker, or AuraDB Free (Neo4j's own pages disagree on limits) |

**Approach:** write agent code against an OpenAI-compatible API (Groq, Gemini, Ollama and Pollinations all offer one). Develop on free models, switch to Claude/OpenAI with a few dollars of credit for a demo recording.

---

## 4. AI engineering landscape (as of 2026)

### Job description items and current alternatives

| Item | Still used? | Alternatives / current thinking |
|---|---|---|
| OpenAI / Anthropic SDKs | Yes, core | Enterprises often use the same models through their cloud: AWS Bedrock, Azure AI Foundry, Google Vertex AI |
| LangChain / LlamaIndex | Yes, common in consulting | Lighter options or plain SDK. TypeScript: Vercel AI SDK, Mastra, LangGraph.js, OpenAI Agents SDK, Claude Agent SDK |
| RAG | Essential | Hybrid search, reranking, contextualized chunks, **agentic RAG** (agent decides when/what to search). Long context replaces RAG for some small doc sets. |
| Multi-agent | Real but overhyped | Start with fixed workflows or a single agent with tools; add agents only for parallelism or context isolation |
| MCP | Very current | De facto standard for tool integration. **A2A** protocol covers agent-to-agent communication. |
| Prompt design | Yes | Now **context engineering**: what goes into the context window (tools, retrieved docs, memory, summaries) |
| Fine-tuning / distillation | Nice-to-have | Prompts + RAG + evals first. Fine-tune for narrow high-volume tasks or distilling to a cheaper model. |
| LLM evaluation | Listed as nice-to-have | **One of the most important skills in practice.** promptfoo, Braintrust, Langfuse evals, Ragas/DeepEval (Python) |
| Graph databases | Niche | Useful for relationship-heavy domains (legal, supply chain). Postgres often enough. |
| Pipecat (voice) | Yes, Python | LiveKit Agents (Node SDK), OpenAI Realtime API, hosted Vapi / Retell |
| Vector DB | Yes | pgvector as pragmatic default; Qdrant, Weaviate, Pinecone, Turbopuffer |

### Important things the job description doesn't mention

1. **Security & guardrails**: prompt injection is the biggest agent risk, especially when an agent reads private data, reads untrusted content, and can send data out. Tool permissions, PII removal, output checks, human approval.
2. **Structured outputs & fixed workflows**: schema-validated output with retries; fixed pipelines where possible, agents only where flexibility is needed.
3. **Observability**: trace every LLM and tool call with tokens, cost, latency (Langfuse, LangSmith, Arize Phoenix, OpenTelemetry).
4. **Cost & latency**: prompt caching, routing to smaller models, streaming, token budgets, batch APIs.
5. **Durable execution**: long agent runs need retries, checkpoints, resume (Temporal, Inngest, LangGraph checkpoints). The BullMQ queue here already covers this.
6. **Memory & state**: conversation memory, long-term memory across sessions, summarizing history before context overflows.
7. **RAG data quality & access control**: parsing messy PDFs/tables (Docling, Unstructured, LlamaParse); users only retrieve documents they're allowed to see.
8. **Testing non-deterministic systems**: evals in CI as regression tests, production quality monitoring from user feedback.
9. **Compliance**: data residency, no training on client data, EU AI Act (relevant for European clients).
10. **AI coding tools**: Claude Code, Cursor, etc. are now expected.

### Three questions the project should answer

- When should something be a fixed workflow vs. an agent?
- How do you know a prompt change didn't make things worse?
- How do you stop an agent from leaking data?

---

## Sources

- [Pollinations Pollen FAQ](https://github.com/pollinations/pollinations/blob/master/enter.pollinations.ai/POLLEN_FAQ.md)
- [Pollinations free tier overview](https://itsfree.dev/tools/pollinations-ai)
- [Gemini API free tier 2026](https://pecollective.com/tools/gemini-free-tier-guide/)
- [Gemini rate limits 2026](https://aipromptshub.co/limits/gemini-rate-limits-2026)
- [Groq free tier limits](https://tokenmix.ai/blog/groq-free-tier-limits-2026)
- [Anthropic free credits](https://www.linkmodel.ai/blog/free-anthropic-api-key)
- [AWS Free Tier $200 credits / 6-month plan](https://aws.amazon.com/about-aws/whats-new/2025/07/aws-free-tier-credits-month-free-plan/)
- [AWS Free Tier 2026 changes](https://infratally.com/articles/aws-free-tier-2026/)
- [Langfuse pricing](https://langfuse.com/pricing)
- [LangSmith pricing](https://www.langchain.com/pricing)
- [GitHub Actions billing](https://docs.github.com/billing/managing-billing-for-github-actions/about-billing-for-github-actions)
- [GitHub Actions free tier 2026](https://cicdcalculator.com/github-actions-free-tier)
- [Neo4j AuraDB FAQ](https://neo4j.com/cloud/platform/aura-graph-database/faq/)
- [Neo4j pricing 2026](https://www.modern-datatools.com/tools/neo4j/pricing)
