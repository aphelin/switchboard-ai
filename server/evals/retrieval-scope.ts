/**
 * Database check for the vector search filter (needs a pgvector database, DATABASE_URL).
 *
 * A plain HNSW scan returns about `hnsw.ef_search` (40) nearest chunks across ALL
 * users and filters by owner afterwards, so a user with few chunks in a large table
 * silently gets fewer results than asked for, or none. This script builds exactly
 * that situation, shows the naive query losing results, and checks that
 * DocumentsRepository.vectorSearch still returns a full top-k for the small user and
 * never compares vectors from another embedding model.
 *
 *   npm run test:retrieval-scope
 *
 * Creates two throwaway users and deletes them at the end: use a dev or test database.
 */
import { randomUUID } from 'node:crypto';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { DocumentsRepository } from '../src/modules/documents/repositories/documents.repository';
import { EMBEDDING_DIMENSIONS } from '../src/shared/constants/app.constants';
import type { ChunkRow } from '../src/modules/documents/types/documents.types';

const MODEL = 'Xenova/bge-small-en-v1.5';
const OTHER_MODEL = 'Xenova/all-MiniLM-L6-v2';
const BIG_USER_CHUNKS = 6000;
const SMALL_USER_CHUNKS = 8;
const TOP_K = 6;

let failures = 0;
const check = (condition: boolean, message: string) => {
  console.log(`  ${condition ? 'ok  ' : 'FAIL'} ${message}`);
  if (!condition) failures++;
};

const randomUnitVector = (): number[] => {
  const v = Array.from(
    { length: EMBEDDING_DIMENSIONS },
    () => Math.random() - 0.5,
  );
  const norm = Math.hypot(...v);
  return v.map((x) => x / norm);
};

const connect = async () => {
  const client = new PrismaService({
    get: () => ({ url: process.env.DATABASE_URL }),
  } as never);
  await client.$connect();
  return client;
};

async function main(): Promise<void> {
  const prisma = await connect();
  const repository = new DocumentsRepository(prisma);
  await repository.onModuleInit();

  const stamp = Date.now();
  const [big, small] = await Promise.all(
    ['big', 'small'].map((name) =>
      prisma.user.create({
        data: {
          id: randomUUID(),
          name: `retrieval-scope ${name}`,
          email: `retrieval-scope-${name}-${stamp}@example.test`,
        },
      }),
    ),
  );

  try {
    const bigDoc = await repository.create({
      userId: big.id,
      title: 'Big corpus',
      content: '-',
    });
    const smallDoc = await repository.create({
      userId: small.id,
      title: 'Small corpus',
      content: '-',
    });
    const staleDoc = await repository.create({
      userId: small.id,
      title: 'Old index',
      content: '-',
    });

    // Another user's large corpus, generated in SQL.
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "DocumentChunk" ("id", "documentId", "index", "content", "tokenCount", "embedding", "embeddingModel")
      SELECT gen_random_uuid(), ${bigDoc.id}, i, 'filler ' || i, 2, r.v, ${MODEL}
      FROM generate_series(1, ${BIG_USER_CHUNKS}) AS i
      -- LATERAL with a reference to i: a fresh random vector per row
      CROSS JOIN LATERAL (
        SELECT array_agg(random() - 0.5)::vector AS v
        FROM generate_series(1, ${EMBEDDING_DIMENSIONS}) WHERE i > 0
      ) AS r
    `);
    await repository.replaceChunks(
      smallDoc.id,
      Array.from({ length: SMALL_USER_CHUNKS }, (_, index) => ({
        index,
        content: `small user passage ${index}`,
        tokenCount: 4,
        section: null,
        embedding: randomUnitVector(),
      })),
      MODEL,
    );
    const query = randomUnitVector();
    // The small user's closest vectors, but embedded by a different model.
    await repository.replaceChunks(
      staleDoc.id,
      [0, 1, 2].map((index) => ({
        index,
        content: `stale passage ${index}`,
        tokenCount: 3,
        section: null,
        embedding: query,
      })),
      OTHER_MODEL,
    );
    await prisma.$executeRawUnsafe('ANALYZE "DocumentChunk"');

    // The planner picks the HNSW index once the table is large and the owner filter
    // doesn't look selective. That is the case the iterative scan exists for, so it is
    // forced here (sorts made prohibitively expensive) on a separate connection pool.
    const dbName = new URL(process.env.DATABASE_URL!).pathname.slice(1);
    await prisma.$executeRawUnsafe(
      `ALTER DATABASE "${dbName}" SET enable_sort = off`,
    );
    const forced = await connect();
    let results: ChunkRow[] = [];
    try {
      const vector = `[${query.join(',')}]`;
      const naiveSql = Prisma.sql`
        SELECT c.id FROM "DocumentChunk" c JOIN "Document" d ON d.id = c."documentId"
        WHERE d."userId" = ${small.id} AND c."embeddingModel" = ${MODEL}
        ORDER BY c.embedding <=> ${vector}::vector LIMIT ${TOP_K}
      `;
      const naive = await forced.$queryRaw<Array<{ id: string }>>(naiveSql);
      const plan = await forced.$queryRaw<Array<{ 'QUERY PLAN': string }>>(
        Prisma.sql`EXPLAIN ${naiveSql}`,
      );
      const usesIndex = plan.some((row) =>
        row['QUERY PLAN'].includes('DocumentChunk_embedding_hnsw_idx'),
      );

      console.log(
        `\n[vector search for a small user next to ${BIG_USER_CHUNKS} chunks of another user]`,
      );
      console.log(`  plain HNSW scan returned ${naive.length}/${TOP_K}`);
      check(usesIndex, 'the query plan uses the HNSW index');
      check(
        naive.length < TOP_K,
        'without an iterative scan the filtered result comes back short (the bug is reproduced)',
      );

      results = await new DocumentsRepository(forced).vectorSearch({
        userId: small.id,
        embedding: query,
        embeddingModel: MODEL,
        limit: TOP_K,
      });
    } finally {
      await prisma.$executeRawUnsafe(
        `ALTER DATABASE "${dbName}" RESET enable_sort`,
      );
      await forced.$disconnect();
    }
    check(
      results.length === TOP_K,
      `vectorSearch returns a full top-${TOP_K} (${results.length})`,
    );
    check(
      results.every((row) => row.documentId === smallDoc.id),
      "every result is the small user's own current-model chunk",
    );
    const scores = results.map((row) => Number(row.score));
    check(
      scores.every((score, i) => i === 0 || scores[i - 1] >= score),
      'results are ordered by similarity',
    );

    const stale = await repository.findStaleEmbeddingDocumentIds(MODEL);
    check(
      stale.includes(staleDoc.id),
      'a document embedded by another model is reported for re-indexing',
    );

    const keyword = await repository.keywordSearch({
      userId: small.id,
      query: 'passage',
      embeddingModel: MODEL,
      limit: 20,
    });
    check(
      keyword.length === SMALL_USER_CHUNKS &&
        keyword.every((row) => row.documentId === smallDoc.id),
      `keyword search reads the same chunk set (${keyword.length} hits, no stale chunks)`,
    );
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: [big.id, small.id] } } });
    await prisma.$disconnect();
  }

  if (failures > 0) {
    console.log(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log('\nRETRIEVAL SCOPE OK');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
