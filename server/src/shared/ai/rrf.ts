/**
 * Reciprocal Rank Fusion (Cormack et al., 2009).
 *
 * Combines several ranked lists (e.g. vector search and keyword search) into
 * one ranking without needing to normalise their incomparable scores:
 * each item gets sum(1 / (k + rank_i)) over the lists it appears in.
 * Items found by several retrievers are boosted; `k` dampens the effect of
 * top ranks (60 is the constant from the paper).
 */
export interface RankedItem<T> {
  id: string;
  item: T;
}

export interface FusedItem<T> {
  id: string;
  item: T;
  score: number;
  /** Rank (1-based) in each input list, keyed by list name. */
  ranks: Record<string, number>;
}

export function reciprocalRankFusion<T>(
  lists: Record<string, RankedItem<T>[]>,
  k = 60,
): FusedItem<T>[] {
  const fused = new Map<string, FusedItem<T>>();

  for (const [listName, items] of Object.entries(lists)) {
    items.forEach(({ id, item }, index) => {
      const rank = index + 1;
      const existing = fused.get(id);
      if (existing) {
        existing.score += 1 / (k + rank);
        existing.ranks[listName] = rank;
      } else {
        fused.set(id, {
          id,
          item,
          score: 1 / (k + rank),
          ranks: { [listName]: rank },
        });
      }
    });
  }

  return [...fused.values()].sort((a, b) => b.score - a.score);
}
