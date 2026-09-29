import type { JudgeVerdict } from './judge';
import type { AggregateRetrieval } from './metrics';

export type EvalKind = 'answerable' | 'unanswerable' | 'injection';

export interface EvalCase {
  id: string;
  question: string;
  /** Title of the fixture document that holds the answer (see config.ts FIXTURES). */
  expectedDocument: string;
  /** Substrings (case-insensitive) a correct answer must contain. */
  expectedKeywords: string[];
  /**
   * Gold passages: verbatim excerpts of the expected document that hold the answer
   * (whitespace-insensitive). Retrieval is scored against these. Empty for unanswerable cases.
   */
  expectedPassages?: string[];
  /** Substrings that must never appear (e.g. an injected payload). */
  forbiddenStrings?: string[];
  kind: EvalKind;
  notes?: string;
}

export type RetrievalMode = 'vector' | 'keyword' | 'hybrid';

export interface RetrievalResult {
  /** false for unanswerable cases: nothing to retrieve, excluded from the averages. */
  scored: boolean;
  /** At least one gold passage in the top k. */
  hit: boolean;
  /** 1-based rank of the first chunk that covers a gold passage, or null. */
  rank: number | null;
  reciprocalRank: number;
  recallAtK: number;
  ndcgAtK: number;
  /** "Document#chunkIndex" of the top results (hybrid). */
  topDocuments: string[];
  /** Recall@k of the single retrievers on the same case, for comparison. */
  recallByMode: Partial<Record<RetrievalMode, number>>;
  durationMs: number;
}

export interface GenerationResult {
  answer: string;
  sources: number;
  searches: number;
  steps: number;
  keywordsFound: string[];
  keywordsMissing: string[];
  forbiddenFound: string[];
  judge: JudgeVerdict | null;
  judgeError?: string;
  passed: boolean;
  failures: string[];
  durationMs: number;
}

export interface CaseResult {
  case: EvalCase;
  retrieval: RetrievalResult;
  generation?: GenerationResult;
  error?: string;
}

export interface MetricCheck {
  name: string;
  value: number | null;
  threshold: number;
  /** "min": value must be >= threshold, "max": value must be <= threshold. */
  direction: 'min' | 'max';
  passed: boolean | null;
}

export interface UsageTotals {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  /** false when some calls had no price information (cost is then a lower bound). */
  costComplete: boolean;
  byName: Record<string, number>;
}

export interface EvalReport {
  runId: string;
  startedAt: string;
  finishedAt: string;
  retrievalOnly: boolean;
  promptVersion: string;
  judgeVersion: string;
  /** Model that graded the answers (null in retrieval-only runs). */
  judgeModel: string | null;
  model: string;
  embeddingModel: string;
  cases: CaseResult[];
  /** Vector, keyword and hybrid retrieval scored on the same cases. */
  retrievalByMode: Record<RetrievalMode, AggregateRetrieval>;
  metrics: MetricCheck[];
  usage: UsageTotals;
  passed: boolean;
}
