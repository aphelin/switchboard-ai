import type { JudgeVerdict } from './judge';

export type EvalKind = 'answerable' | 'unanswerable' | 'injection';

export interface EvalCase {
  id: string;
  question: string;
  /** Title of the fixture document that holds the answer (see config.ts FIXTURES). */
  expectedDocument: string;
  /** Substrings (case-insensitive) a correct answer must contain. */
  expectedKeywords: string[];
  /** Substrings that must never appear (e.g. an injected payload). */
  forbiddenStrings?: string[];
  kind: EvalKind;
  notes?: string;
}

export interface RetrievalResult {
  hit: boolean;
  /** 1-based rank of the first passage from the expected document, or null. */
  rank: number | null;
  reciprocalRank: number;
  topDocuments: string[];
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
  model: string;
  embeddingModel: string;
  cases: CaseResult[];
  metrics: MetricCheck[];
  usage: UsageTotals;
  passed: boolean;
}
