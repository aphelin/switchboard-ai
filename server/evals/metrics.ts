/**
 * Retrieval metrics at the passage level.
 *
 * Each answerable case lists its gold passages: short verbatim excerpts of the
 * source text that hold the answer. A retrieved chunk "covers" a gold passage
 * when it comes from the expected document and contains the excerpt. Scoring
 * against labelled passages (not "any chunk of the right document") is what
 * makes the numbers mean something: with look-alike documents in the corpus, a
 * chunk from the right document can still be the wrong chunk.
 */
import type { EvalCase } from './types';

export interface RankedChunk {
  documentTitle: string;
  content: string;
}

export interface RetrievalScore {
  /** Share of gold passages covered by the top k. */
  recallAtK: number;
  /** 1 / rank of the first chunk that covers a gold passage (0 if none). */
  reciprocalRank: number;
  /** Binary-gain nDCG@k: a gold passage counts at the first rank that covers it. */
  ndcgAtK: number;
  /** 1-based rank of the first relevant chunk, or null. */
  firstRelevantRank: number | null;
}

const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();

/** Which gold passages (by index) a chunk covers. */
export function coveredPassages(
  chunk: RankedChunk,
  evalCase: Pick<EvalCase, 'expectedDocument' | 'expectedPassages'>,
): number[] {
  if (chunk.documentTitle !== evalCase.expectedDocument) return [];
  const content = normalize(chunk.content);
  return (evalCase.expectedPassages ?? []).flatMap((passage, i) =>
    content.includes(normalize(passage)) ? [i] : [],
  );
}

/**
 * Scores one ranked result list. Unanswerable cases have nothing to retrieve and
 * return null, so they never dilute (or inflate) the averages.
 */
export function scoreRetrieval(
  evalCase: EvalCase,
  ranked: RankedChunk[],
  k: number,
): RetrievalScore | null {
  const gold = evalCase.expectedPassages ?? [];
  if (evalCase.kind === 'unanswerable' || gold.length === 0) return null;

  const found = new Set<number>();
  let dcg = 0;
  let firstRelevantRank: number | null = null;
  ranked.slice(0, k).forEach((chunk, i) => {
    const covered = coveredPassages(chunk, evalCase);
    if (covered.length > 0 && firstRelevantRank === null) {
      firstRelevantRank = i + 1;
    }
    const newlyFound = covered.filter((p) => !found.has(p));
    newlyFound.forEach((p) => found.add(p));
    dcg += newlyFound.length / Math.log2(i + 2);
  });

  // Ideal: one new gold passage at each of the first ranks. A chunk that holds
  // several gold passages can beat that, so the ratio is capped at 1.
  let idcg = 0;
  for (let i = 0; i < Math.min(gold.length, k); i++)
    idcg += 1 / Math.log2(i + 2);

  return {
    recallAtK: found.size / gold.length,
    reciprocalRank: firstRelevantRank ? 1 / firstRelevantRank : 0,
    ndcgAtK: Math.min(1, dcg / idcg),
    firstRelevantRank,
  };
}

export interface AggregateRetrieval {
  cases: number;
  recallAtK: number | null;
  mrr: number | null;
  ndcgAtK: number | null;
  /** Share of cases with at least one relevant chunk in the top k. */
  hitRate: number | null;
}

export function aggregateRetrieval(
  scores: Array<RetrievalScore | null>,
): AggregateRetrieval {
  const scored = scores.filter((s): s is RetrievalScore => s !== null);
  const mean = (pick: (s: RetrievalScore) => number) =>
    scored.length
      ? scored.reduce((sum, s) => sum + pick(s), 0) / scored.length
      : null;
  return {
    cases: scored.length,
    recallAtK: mean((s) => s.recallAtK),
    mrr: mean((s) => s.reciprocalRank),
    ndcgAtK: mean((s) => s.ndcgAtK),
    hitRate: mean((s) => (s.firstRelevantRank ? 1 : 0)),
  };
}
