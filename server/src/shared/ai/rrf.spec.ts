import { describe, expect, it } from 'vitest';
import { reciprocalRankFusion } from './rrf';

const ranked = (...ids: string[]) => ids.map((id) => ({ id, item: { id } }));

describe('reciprocalRankFusion', () => {
  it('scores a single list as 1 / (k + rank) and keeps its order', () => {
    const fused = reciprocalRankFusion({ vector: ranked('a', 'b', 'c') }, 60);

    expect(fused.map((f) => f.id)).toEqual(['a', 'b', 'c']);
    expect(fused[0].score).toBeCloseTo(1 / 61, 10);
    expect(fused[1].score).toBeCloseTo(1 / 62, 10);
    expect(fused[0].ranks).toEqual({ vector: 1 });
  });

  it('boosts items that appear in several lists above single-list top hits', () => {
    const fused = reciprocalRankFusion({
      vector: ranked('a', 'shared', 'c'),
      keyword: ranked('shared', 'd'),
    });

    // "shared" is rank 2 in vector and rank 1 in keyword: 1/62 + 1/61 > 1/61 (a's single score)
    expect(fused[0].id).toBe('shared');
    expect(fused[0].score).toBeCloseTo(1 / 62 + 1 / 61, 10);
    expect(fused[0].ranks).toEqual({ vector: 2, keyword: 1 });
    expect(fused[1].id).toBe('a');
  });

  it('sorts by fused score descending', () => {
    const fused = reciprocalRankFusion({
      vector: ranked('x', 'y', 'z'),
      keyword: ranked('y', 'z'),
    });

    const scores = fused.map((f) => f.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    // y: 1/62 + 1/61, z: 1/63 + 1/62, x: 1/61 alone
    expect(fused.map((f) => f.id)).toEqual(['y', 'z', 'x']);
  });

  it('honours the k constant (larger k flattens the differences)', () => {
    const small = reciprocalRankFusion({ vector: ranked('a', 'b') }, 1);
    const large = reciprocalRankFusion({ vector: ranked('a', 'b') }, 1000);

    expect(small[0].score - small[1].score).toBeGreaterThan(
      large[0].score - large[1].score,
    );
  });

  it('returns an empty list when every input list is empty', () => {
    expect(reciprocalRankFusion({ vector: [], keyword: [] })).toEqual([]);
  });

  it('keeps the original item payload', () => {
    const fused = reciprocalRankFusion({
      vector: [{ id: 'a', item: { id: 'a', content: 'hello' } }],
    });
    expect(fused[0].item).toEqual({ id: 'a', content: 'hello' });
  });
});
