/**
 * RAG evaluation harness.
 *
 * Boots the real NestJS application context (same modules, config and models
 * as the server), (re)indexes the fixture documents, then measures:
 *   - retrieval: hit@K and MRR of the expected document (deterministic, free)
 *   - generation: answers from ChatService.answer, checked deterministically
 *     (expected keywords present, forbidden strings absent) and by an LLM judge
 *     (correctness, faithfulness, abstention on unanswerable questions)
 *
 * Usage (from server/):
 *   npm run eval                     # full run (costs a few cents)
 *   npm run eval -- --retrieval-only # free, no LLM calls
 *   EVAL_SKIP_GENERATION=1 npm run eval
 * Exits 1 when any threshold in config.ts is missed.
 */
import { NestFactory } from '@nestjs/core';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { DocumentsService } from '../src/modules/documents/services/documents.service';
import { RetrievalService } from '../src/modules/documents/services/retrieval.service';
import { ChatService } from '../src/modules/chat/services/chat.service';
import { LlmService } from '../src/modules/llm/services/llm.service';
import { ModelRegistryService } from '../src/modules/llm/services/model-registry.service';
import { PricingService } from '../src/modules/llm/services/pricing.service';
import { EmbeddingService } from '../src/modules/llm/services/embedding.service';
import { TraceService } from '../src/modules/observability/services/trace.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { ASSISTANT_PROMPT_VERSION } from '../src/modules/chat/prompts/assistant.prompt';
import { DocumentStatus } from '../generated/prisma/enums';
import {
  EVAL_TOP_K,
  FIXTURES,
  GENERATION_CONCURRENCY,
  GLOBAL_FORBIDDEN_STRINGS,
  INGESTION_TIMEOUT_MS,
  THRESHOLDS,
} from './config';
import {
  buildJudgePrompt,
  JUDGE_INSTRUCTIONS,
  JUDGE_PROMPT_VERSION,
  JudgeSchema,
} from './judge';
import { formatCaseTable, formatMetrics, formatSummary } from './report';
import type {
  CaseResult,
  EvalCase,
  EvalReport,
  GenerationResult,
  MetricCheck,
  RetrievalResult,
  UsageTotals,
} from './types';

interface Services {
  documents: DocumentsService;
  retrieval: RetrievalService;
  chat: ChatService;
  llm: LlmService;
  trace: TraceService;
  prisma: PrismaService;
  /** Eval data belongs to a dedicated user so it never mixes with real accounts. */
  userId: string;
}

/** The compiled runner lives in dist/eval/evals; the dataset and fixtures stay in evals/. */
function findEvalsDir(): string {
  const candidates = [resolve(process.cwd(), 'evals'), __dirname];
  let dir = __dirname;
  for (let i = 0; i < 5; i++) {
    dir = dirname(dir);
    candidates.push(join(dir, 'evals'));
  }
  const found = candidates.find((c) => existsSync(join(c, 'dataset.json')));
  if (!found) throw new Error('Could not locate evals/dataset.json');
  return found;
}

function loadDataset(evalsDir: string): EvalCase[] {
  const cases = JSON.parse(
    readFileSync(join(evalsDir, 'dataset.json'), 'utf8'),
  ) as EvalCase[];
  const ids = new Set<string>();
  for (const c of cases) {
    if (ids.has(c.id)) throw new Error(`Duplicate eval case id: ${c.id}`);
    ids.add(c.id);
    if (!FIXTURES.some((f) => f.title === c.expectedDocument)) {
      throw new Error(
        `Case ${c.id} expects unknown document "${c.expectedDocument}"`,
      );
    }
  }
  return cases;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const EVAL_USER_EMAIL = 'eval-runner@switchboard-ai.local';

/** A user row without an account: it owns eval data but has no password and cannot sign in. */
async function ensureEvalUser(prisma: PrismaService): Promise<string> {
  const user = await prisma.user.upsert({
    where: { email: EVAL_USER_EMAIL },
    update: {},
    create: { id: randomUUID(), name: 'Eval runner', email: EVAL_USER_EMAIL },
  });
  return user.id;
}

async function ingestFixtures(
  services: Services,
  evalsDir: string,
): Promise<{ ids: string[]; titles: Map<string, string> }> {
  const stale = await services.prisma.document.findMany({
    where: {
      userId: services.userId,
      metadata: { path: ['evalFixture'], equals: true },
    },
    select: { id: true, title: true },
  });
  for (const doc of stale) {
    await services.documents.remove(services.userId, doc.id);
  }
  if (stale.length)
    console.log(`Removed ${stale.length} stale eval fixture document(s)`);

  const titles = new Map<string, string>();
  for (const fixture of FIXTURES) {
    const content = readFileSync(
      join(evalsDir, 'fixtures', fixture.file),
      'utf8',
    );
    const doc = await services.documents.create(
      services.userId,
      { title: fixture.title, content },
      { evalFixture: true, fixture: fixture.file },
    );
    titles.set(doc.id, fixture.title);
  }

  const ids = [...titles.keys()];
  const deadline = Date.now() + INGESTION_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const docs = await Promise.all(
      ids.map((id) => services.documents.findOne(services.userId, id)),
    );
    const failed = docs.find((d) => d.status === DocumentStatus.FAILED);
    if (failed)
      throw new Error(
        `Ingestion failed for "${failed.title}": ${failed.error}`,
      );
    if (docs.every((d) => d.status === DocumentStatus.READY)) {
      const chunks = docs
        .map((d) => `${d.title}: ${d.chunkCount} chunks`)
        .join(', ');
      console.log(`Fixtures indexed (${chunks})`);
      return { ids, titles };
    }
    await sleep(500);
  }
  throw new Error(
    `Fixture ingestion did not finish within ${INGESTION_TIMEOUT_MS}ms`,
  );
}

async function evaluateRetrieval(
  services: Services,
  evalCase: EvalCase,
  documentIds: string[],
  runId: string,
): Promise<RetrievalResult> {
  const startedAt = Date.now();
  const results = await services.retrieval.search({
    userId: services.userId,
    query: evalCase.question,
    topK: EVAL_TOP_K,
    documentIds,
    traceId: runId,
  });
  const index = results.findIndex(
    (r) => r.documentTitle === evalCase.expectedDocument,
  );
  const rank = index >= 0 ? index + 1 : null;
  return {
    hit: rank !== null,
    rank,
    reciprocalRank: rank ? 1 / rank : 0,
    topDocuments: results.map((r) => `${r.documentTitle}#${r.chunkIndex}`),
    durationMs: Date.now() - startedAt,
  };
}

const includes = (haystack: string, needle: string) =>
  haystack.toLowerCase().includes(needle.toLowerCase());

async function evaluateGeneration(
  services: Services,
  evalCase: EvalCase,
  documentIds: string[],
  runId: string,
): Promise<GenerationResult> {
  const startedAt = Date.now();
  const answer = await services.chat.answer({
    userId: services.userId,
    question: evalCase.question,
    documentIds,
    traceId: runId,
  });

  const keywordsFound = evalCase.expectedKeywords.filter((k) =>
    includes(answer.text, k),
  );
  const keywordsMissing = evalCase.expectedKeywords.filter(
    (k) => !includes(answer.text, k),
  );
  const forbiddenFound = [
    ...GLOBAL_FORBIDDEN_STRINGS,
    ...(evalCase.forbiddenStrings ?? []),
  ].filter((s) => includes(answer.text, s));

  let judge: GenerationResult['judge'] = null;
  let judgeError: string | undefined;
  try {
    judge = await services.llm.generateObject(JudgeSchema, {
      name: 'eval.judge',
      traceId: runId,
      userId: services.userId,
      metadata: { caseId: evalCase.id, judgeVersion: JUDGE_PROMPT_VERSION },
      model: 'main',
      instructions: JUDGE_INSTRUCTIONS,
      prompt: buildJudgePrompt({
        question: evalCase.question,
        kind: evalCase.kind,
        expectedKeywords: evalCase.expectedKeywords,
        sources: answer.sources.map((s) => ({
          document: s.document,
          content: s.content,
        })),
        answer: answer.text,
        notes: evalCase.notes,
      }),
    });
  } catch (error) {
    judgeError = error instanceof Error ? error.message : String(error);
  }

  const failures: string[] = [];
  if (forbiddenFound.length)
    failures.push(`forbidden: ${forbiddenFound.join(', ')}`);
  if (evalCase.kind === 'unanswerable') {
    if (!judge?.abstained) failures.push('did not abstain');
  } else {
    const keywordsOk = keywordsMissing.length === 0;
    const judgeOk = (judge?.correctness ?? 0) >= 4;
    if (!keywordsOk && !judgeOk) {
      failures.push(
        `missing: ${keywordsMissing.join(', ')}` +
          (judge ? ` (judge ${judge.correctness}/5)` : ''),
      );
    }
    if (answer.searches === 0) failures.push('did not search the documents');
  }
  if (judgeError) failures.push(`judge error: ${judgeError}`);

  return {
    answer: answer.text,
    sources: answer.sources.length,
    searches: answer.searches,
    steps: answer.steps,
    keywordsFound,
    keywordsMissing,
    forbiddenFound,
    judge,
    judgeError,
    passed: failures.length === 0,
    failures,
    durationMs: Date.now() - startedAt,
  };
}

/** Runs `worker` over `items` with at most `limit` in flight, preserving order. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const runners = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await worker(items[index], index);
      }
    },
  );
  await Promise.all(runners);
  return results;
}

const average = (values: number[]): number | null =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;

const rate = (values: boolean[]): number | null =>
  values.length ? values.filter(Boolean).length / values.length : null;

function computeMetrics(
  cases: CaseResult[],
  retrievalOnly: boolean,
): MetricCheck[] {
  const check = (
    name: string,
    value: number | null,
    threshold: number,
    direction: 'min' | 'max' = 'min',
  ): MetricCheck => ({
    name,
    value,
    threshold,
    direction,
    passed:
      value === null
        ? null
        : direction === 'min'
          ? value >= threshold
          : value <= threshold,
  });

  const metrics: MetricCheck[] = [
    check(
      'retrieval hit@' + EVAL_TOP_K,
      rate(cases.map((c) => c.retrieval.hit)),
      THRESHOLDS.retrievalHitAtK,
    ),
    check(
      'retrieval MRR',
      average(cases.map((c) => c.retrieval.reciprocalRank)),
      THRESHOLDS.retrievalMrr,
    ),
  ];
  if (retrievalOnly) return metrics;

  const generated = cases.filter((c) => c.generation);
  const scored = generated.filter((c) => c.generation?.judge);
  const answerable = generated.filter((c) => c.case.kind !== 'unanswerable');
  const unanswerable = generated.filter((c) => c.case.kind === 'unanswerable');
  const injection = generated.filter((c) => c.case.kind === 'injection');
  const withKeywords = answerable.filter(
    (c) => c.case.expectedKeywords.length > 0,
  );

  metrics.push(
    check(
      'judge correctness avg',
      average(scored.map((c) => c.generation!.judge!.correctness)),
      THRESHOLDS.correctnessAvg,
    ),
    check(
      'judge faithfulness avg',
      average(scored.map((c) => c.generation!.judge!.faithfulness)),
      THRESHOLDS.faithfulnessAvg,
    ),
    check(
      'keyword pass rate',
      rate(withKeywords.map((c) => c.generation!.keywordsMissing.length === 0)),
      THRESHOLDS.keywordPassRate,
    ),
    check(
      'unanswerable abstain rate',
      rate(unanswerable.map((c) => !!c.generation!.judge?.abstained)),
      THRESHOLDS.unanswerableAbstainRate,
    ),
    check(
      'injection pass rate',
      rate(injection.map((c) => c.generation!.forbiddenFound.length === 0)),
      THRESHOLDS.injectionPassRate,
    ),
    check(
      'case pass rate',
      rate(cases.map((c) => !c.error && !!c.generation?.passed)),
      THRESHOLDS.casePassRate,
    ),
  );
  return metrics;
}

async function collectUsage(
  trace: TraceService,
  userId: string,
  runId: string,
): Promise<UsageTotals> {
  const totals: UsageTotals = {
    calls: 0,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    costComplete: true,
    byName: {},
  };
  let page = 1;
  for (;;) {
    const result = await trace.list({
      userId,
      traceId: runId,
      page,
      limit: 200,
    });
    for (const call of result.data) {
      totals.calls++;
      totals.inputTokens += call.inputTokens ?? 0;
      totals.outputTokens += call.outputTokens ?? 0;
      totals.costUsd += call.costUsd ?? 0;
      if (
        call.costUsd === null &&
        call.status === 'ok' &&
        (call.inputTokens ?? 0) > 0
      ) {
        totals.costComplete = false;
      }
      totals.byName[call.name] = (totals.byName[call.name] ?? 0) + 1;
    }
    if (page >= result.totalPages) break;
    page++;
  }
  return totals;
}

function writeReport(evalsDir: string, report: EvalReport): string {
  const dir = join(evalsDir, 'results');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${report.runId}.json`);
  const json = JSON.stringify(report, null, 2);
  writeFileSync(file, json);
  writeFileSync(join(dir, 'latest.json'), json);
  return file;
}

async function main(): Promise<void> {
  const retrievalOnly =
    process.argv.includes('--retrieval-only') ||
    process.env.EVAL_SKIP_GENERATION === '1';
  const evalsDir = findEvalsDir();
  const dataset = loadDataset(evalsDir);
  const startedAt = new Date();
  const runId = `eval-${startedAt.toISOString().replace(/[:.]/g, '-')}`;

  console.log(
    `Starting eval run ${runId} (${dataset.length} cases, ${retrievalOnly ? 'retrieval only' : 'retrieval + generation'})`,
  );

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  let passed = false;
  try {
    const services: Services = {
      documents: app.get(DocumentsService),
      retrieval: app.get(RetrievalService),
      chat: app.get(ChatService),
      llm: app.get(LlmService),
      trace: app.get(TraceService),
      prisma: app.get(PrismaService),
      userId: await ensureEvalUser(app.get(PrismaService)),
    };
    const registry = app.get(ModelRegistryService);
    const embedding = app.get(EmbeddingService);
    const pricing = app.get(PricingService);
    const mainModel = registry.resolveModelId('main');
    if (
      pricing.estimateCost(mainModel, undefined, {
        inputTokens: 1000,
        outputTokens: 0,
      }) === null
    ) {
      console.warn(
        `No pricing known for ${mainModel}; reported cost will be a lower bound`,
      );
    }

    const { ids: fixtureIds } = await ingestFixtures(services, evalsDir);

    const cases: CaseResult[] = [];
    for (const evalCase of dataset) {
      const retrieval = await evaluateRetrieval(
        services,
        evalCase,
        fixtureIds,
        runId,
      );
      cases.push({ case: evalCase, retrieval });
      console.log(
        `retrieval  ${evalCase.id.padEnd(30)} rank=${retrieval.rank ?? '-'}  top=${retrieval.topDocuments.slice(0, 3).join(' | ')}`,
      );
    }

    if (!retrievalOnly) {
      await mapWithConcurrency(
        cases,
        GENERATION_CONCURRENCY,
        async (result) => {
          try {
            result.generation = await evaluateGeneration(
              services,
              result.case,
              fixtureIds,
              runId,
            );
            const g = result.generation;
            console.log(
              `generation ${result.case.id.padEnd(30)} ${g.passed ? 'ok  ' : 'FAIL'} corr=${g.judge?.correctness ?? '-'} faith=${g.judge?.faithfulness ?? '-'} searches=${g.searches} ${g.durationMs}ms`,
            );
          } catch (error) {
            result.error =
              error instanceof Error ? error.message : String(error);
            console.log(
              `generation ${result.case.id.padEnd(30)} ERROR ${result.error}`,
            );
          }
        },
      );
    }

    const metrics = computeMetrics(cases, retrievalOnly);
    const usage = await collectUsage(services.trace, services.userId, runId);
    passed =
      metrics.every((m) => m.passed !== false) && cases.every((c) => !c.error);

    const report: EvalReport = {
      runId,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      retrievalOnly,
      promptVersion: ASSISTANT_PROMPT_VERSION,
      judgeVersion: JUDGE_PROMPT_VERSION,
      model: registry.resolveModelId('main'),
      embeddingModel: embedding.modelName,
      cases,
      metrics,
      usage,
      passed,
    };

    const file = writeReport(evalsDir, report);
    console.log('\n' + formatCaseTable(cases, retrievalOnly));
    console.log('\n' + formatMetrics(metrics));
    console.log('\n' + formatSummary(report));
    console.log(`Report written to ${file}`);
  } finally {
    await app.close();
  }

  process.exit(passed ? 0 : 1);
}

main().catch((error) => {
  console.error('Eval run failed:', error);
  process.exit(1);
});
