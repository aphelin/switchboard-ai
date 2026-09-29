import { describe, expect, it } from 'vitest';
import { aggregateRetrieval, scoreRetrieval } from './metrics';
import type { EvalCase } from './types';

const DOC = 'Nimbus Vault On-call Runbook';

const answerable = (expectedPassages: string[]): EvalCase => ({
  id: 'case',
  question: 'q',
  expectedDocument: DOC,
  expectedKeywords: [],
  expectedPassages,
  kind: 'answerable',
});

const chunk = (content: string, documentTitle = DOC) => ({
  documentTitle,
  content,
});

describe('scoreRetrieval', () => {
  it('recall counts gold passages found in the top k', () => {
    const evalCase = answerable(['p99 above 800 ms', 'Mikkel Sørensen']);
    const ranked = [
      chunk('unrelated'),
      chunk('Alert: p99  above\n800 ms for 5 minutes'),
      chunk('Secondary: Mikkel Sørensen'),
    ];
    expect(scoreRetrieval(evalCase, ranked, 2)!.recallAtK).toBe(0.5);
    expect(scoreRetrieval(evalCase, ranked, 3)!.recallAtK).toBe(1);
  });

  it('does not credit the right text from the wrong document', () => {
    const evalCase = answerable(['secondary on-call']);
    const score = scoreRetrieval(
      evalCase,
      [chunk('the secondary on-call is Ines', 'Nimbus Queue On-call Runbook')],
      5,
    )!;
    expect(score.recallAtK).toBe(0);
    expect(score.reciprocalRank).toBe(0);
  });

  it('reciprocal rank of the first relevant chunk', () => {
    const evalCase = answerable(['8+4']);
    const ranked = [
      chunk('a'),
      chunk('b'),
      chunk('erasure-coded 8+4'),
      chunk('8+4 again'),
    ];
    const score = scoreRetrieval(evalCase, ranked, 5)!;
    expect(score.firstRelevantRank).toBe(3);
    expect(score.reciprocalRank).toBeCloseTo(1 / 3, 10);
  });

  it('ndcg of an ideal ranking is 1', () => {
    const evalCase = answerable(['fact one', 'fact two']);
    expect(
      scoreRetrieval(
        evalCase,
        [chunk('fact one'), chunk('fact two'), chunk('x')],
        5,
      )!.ndcgAtK,
    ).toBe(1);
    // The same facts one rank lower score less.
    const lower = scoreRetrieval(
      evalCase,
      [chunk('x'), chunk('fact one'), chunk('fact two')],
      5,
    )!.ndcgAtK;
    const expected =
      (1 / Math.log2(3) + 1 / Math.log2(4)) / (1 + 1 / Math.log2(3));
    expect(lower).toBeCloseTo(expected, 10);
    // A duplicate chunk covering an already-found fact adds nothing.
    expect(
      scoreRetrieval(evalCase, [chunk('fact one'), chunk('fact one')], 5)!
        .ndcgAtK,
    ).toBeCloseTo(1 / (1 + 1 / Math.log2(3)), 10);
  });

  it('unanswerable cases are not scored', () => {
    const unanswerable: EvalCase = {
      ...answerable([]),
      kind: 'unanswerable',
    };
    expect(scoreRetrieval(unanswerable, [chunk('anything')], 5)).toBeNull();

    const aggregate = aggregateRetrieval([
      scoreRetrieval(answerable(['a']), [chunk('a')], 5),
      scoreRetrieval(unanswerable, [chunk('a')], 5),
      scoreRetrieval(answerable(['b']), [chunk('x')], 5),
    ]);
    expect(aggregate).toEqual({
      cases: 2,
      recallAtK: 0.5,
      mrr: 0.5,
      ndcgAtK: 0.5,
      hitRate: 0.5,
    });
  });
});
