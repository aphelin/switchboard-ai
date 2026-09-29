import { describe, expect, it, vi } from 'vitest';
import { buildChatTools } from './chat-tools';
import type { RetrievalService } from '../../documents/services/retrieval.service';
import type { RetrievedChunk } from '../../documents/types/documents.types';
import type { SearchToolOutput } from '../types/chat.types';

const chunk = (id: string): RetrievedChunk => ({
  chunkId: id,
  documentId: 'doc-1',
  documentTitle: 'Runbook',
  chunkIndex: Number(id.replace(/\D/g, '')),
  section: null,
  content: `passage ${id}`,
  score: 0.5,
  ranks: {},
  flagged: false,
  flagReasons: [],
});

describe('search_documents tool', () => {
  it('numbers citation refs across searches in one turn', async () => {
    const results = [
      [chunk('c1'), chunk('c2')],
      // The rephrased search finds one new passage and one it already returned.
      [chunk('c3'), chunk('c2')],
    ];
    const retrieval = {
      search: vi.fn(() => Promise.resolve(results.shift()!)),
    } as unknown as RetrievalService;
    const tools = buildChatTools({
      retrieval,
      documents: {} as never,
      generations: {} as never,
      userId: 'user-1',
    });
    if (!('search_documents' in tools)) throw new Error('search tools missing');
    const run = (query: string) =>
      tools.search_documents.execute({ query }, {
        toolCallId: query,
        messages: [],
      } as never) as Promise<SearchToolOutput>;

    const first = await run('vault freeze');
    const second = await run('how to freeze the vault');

    expect(first.passages.map((p) => [p.chunkId, p.ref])).toEqual([
      ['c1', 1],
      ['c2', 2],
    ]);
    expect(second.passages.map((p) => [p.chunkId, p.ref])).toEqual([
      ['c3', 3],
      ['c2', 2],
    ]);
  });
});
