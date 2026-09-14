import { describe, expect, it } from 'vitest';
import { ChunkingService, estimateTokens } from './chunking.service';
import { RAG } from '../../../shared/constants/app.constants';

const paragraph = (n: number) =>
  `Paragraph ${n}. ${'This sentence is filler text used to grow the paragraph. '.repeat(6)}`.trim();

describe('estimateTokens', () => {
  it('approximates 4 characters per token, rounding up', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcde')).toBe(2);
    expect(estimateTokens('a'.repeat(400))).toBe(100);
  });
});

describe('ChunkingService', () => {
  const service = new ChunkingService();

  it('returns no chunks for empty or whitespace-only input', async () => {
    expect(await service.chunk('')).toEqual([]);
    expect(await service.chunk('   \n\n  ')).toEqual([]);
  });

  it('keeps short text as a single chunk', async () => {
    const chunks = await service.chunk('Just one short line.');
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual({
      index: 0,
      content: 'Just one short line.',
      tokenCount: estimateTokens('Just one short line.'),
    });
  });

  it('respects the chunk size and numbers chunks sequentially', async () => {
    const text = Array.from({ length: 8 }, (_, i) => paragraph(i + 1)).join(
      '\n\n',
    );
    const chunks = await service.chunk(text, {
      chunkSize: 200,
      chunkOverlap: 40,
    });

    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk, i) => {
      expect(chunk.index).toBe(i);
      expect(chunk.content.length).toBeLessThanOrEqual(200);
      expect(chunk.content.length).toBeGreaterThan(0);
      expect(chunk.tokenCount).toBe(estimateTokens(chunk.content));
    });
  });

  it('overlaps consecutive chunks so ideas are not cut in half', async () => {
    const text = 'word '.repeat(300).trim();
    const chunks = await service.chunk(text, {
      chunkSize: 100,
      chunkOverlap: 30,
    });

    expect(chunks.length).toBeGreaterThan(2);
    // With plain repeated words the tail of one chunk must reappear at the head of the next.
    for (let i = 1; i < chunks.length; i++) {
      const tail = chunks[i - 1].content.slice(-20);
      expect(chunks[i].content.startsWith(tail.trimStart().split(' ')[0])).toBe(
        true,
      );
    }
  });

  it('prefers paragraph boundaries over mid-sentence cuts', async () => {
    const text = `${paragraph(1)}\n\n${paragraph(2)}\n\n${paragraph(3)}`;
    const chunks = await service.chunk(text, {
      chunkSize: 420,
      chunkOverlap: 0,
    });

    // Each paragraph is ~370 chars, so each chunk should hold exactly one paragraph.
    expect(chunks.map((c) => c.content)).toEqual([
      paragraph(1),
      paragraph(2),
      paragraph(3),
    ]);
  });

  it('uses the RAG defaults when no options are given', async () => {
    const text = 'lorem ipsum '.repeat(400);
    const chunks = await service.chunk(text);
    chunks.forEach((chunk) =>
      expect(chunk.content.length).toBeLessThanOrEqual(RAG.CHUNK_SIZE),
    );
    expect(chunks.length).toBeGreaterThan(text.length / RAG.CHUNK_SIZE - 1);
  });
});
