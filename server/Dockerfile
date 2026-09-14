# Debian-based image (not Alpine): the local embedding model runs on onnxruntime-node,
# which ships glibc binaries only.
FROM node:22-slim AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM deps AS dev
RUN mkdir -p /app/storage /app/.cache
CMD ["npm", "run", "start:docker:dev"]

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate
RUN npm run build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
# Generated images and the cached embedding model live on volumes (see docker-compose.prod.yml).
ENV STORAGE_DIR=/app/storage
ENV TRANSFORMERS_CACHE_DIR=/app/.cache/transformers

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/generated ./generated
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/evals/fixtures ./evals/fixtures

RUN mkdir -p /app/storage /app/.cache && chown -R nestjs:nodejs /app/storage /app/.cache

USER nestjs

EXPOSE 4000

CMD ["npm", "run", "start:docker:prod"]
