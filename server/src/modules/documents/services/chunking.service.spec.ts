import { describe, expect, it } from 'vitest';
import {
  ChunkingService,
  estimateTokens,
  splitMarkdownSections,
} from './chunking.service';
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

/** One "token" per character: lets the size assertions below read in characters. */
const chars = (text: string) => text.length;

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
      section: null,
    });
  });

  it('respects the chunk size and numbers chunks sequentially', async () => {
    const text = Array.from({ length: 8 }, (_, i) => paragraph(i + 1)).join(
      '\n\n',
    );
    const chunks = await service.chunk(text, {
      chunkSize: 200,
      chunkOverlap: 40,
      countTokens: chars,
    });

    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk, i) => {
      expect(chunk.index).toBe(i);
      expect(chunk.content.length).toBeLessThanOrEqual(200);
      expect(chunk.content.length).toBeGreaterThan(0);
      expect(chunk.tokenCount).toBe(chunk.content.length);
    });
  });

  it('overlaps consecutive chunks so ideas are not cut in half', async () => {
    const text = 'word '.repeat(300).trim();
    const chunks = await service.chunk(text, {
      chunkSize: 100,
      chunkOverlap: 30,
      countTokens: chars,
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
      countTokens: chars,
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
      expect(chunk.tokenCount).toBeLessThanOrEqual(RAG.CHUNK_TOKENS),
    );
    expect(chunks.length).toBeGreaterThan(
      estimateTokens(text) / RAG.CHUNK_TOKENS - 1,
    );
  });

  it('sizes chunks by the token counter', async () => {
    // A counter where digits are expensive (like identifiers in a real tokenizer):
    // the same character count holds far fewer "tokens" of digits than of letters.
    const countTokens = (text: string) =>
      [...text].reduce((n, c) => n + (/\d/.test(c) ? 4 : 1), 0);
    const words = 'alpha beta gamma delta '.repeat(20).trim();
    const digits = '1234 5678 9012 3456 '.repeat(20).trim();
    const options = { chunkSize: 100, chunkOverlap: 0, countTokens };

    const wordChunks = await service.chunk(words, options);
    const digitChunks = await service.chunk(digits, options);

    for (const chunk of [...wordChunks, ...digitChunks]) {
      expect(chunk.tokenCount).toBe(countTokens(chunk.content));
      expect(chunk.tokenCount).toBeLessThanOrEqual(100);
    }
    expect(digitChunks.length).toBeGreaterThan(wordChunks.length * 2);
  });

  it('carries the markdown heading path into each chunk', async () => {
    const doc = [
      '# Nimbus Vault Runbook',
      '',
      '## Alerts',
      '',
      '### VaultGatewayHighLatency',
      '',
      'p99 latency above 800 ms for 5 minutes.',
      '',
      '```bash',
      '# not a heading, a shell comment',
      'vaultctl status',
      '```',
      '',
      '## Contacts',
      '',
      'Secondary on-call: Mikkel.',
    ].join('\n');

    const chunks = await service.chunk(doc);

    expect(chunks.map((c) => c.section)).toEqual([
      'Nimbus Vault Runbook > Alerts > VaultGatewayHighLatency',
      'Nimbus Vault Runbook > Contacts',
    ]);
    expect(chunks[0].content).toContain('# not a heading, a shell comment');
    expect(chunks[0].content).toContain('800 ms');
    expect(chunks[1].content).toContain('Mikkel');
    // A chunk never spans two sections.
    expect(chunks[0].content).not.toContain('Mikkel');
  });
});

describe('splitMarkdownSections', () => {
  it('keeps text before the first heading as a section without a path', () => {
    expect(splitMarkdownSections('Intro line.\n\n# Title\nBody.')).toEqual([
      { path: null, text: 'Intro line.' },
      { path: 'Title', text: '# Title\nBody.' },
    ]);
  });

  it('resets deeper levels when a shallower heading starts', () => {
    const sections = splitMarkdownSections(
      '# A\n## B\n### C\ntext c\n## D\ntext d',
    );
    expect(sections.map((s) => s.path)).toEqual(['A > B > C', 'A > D']);
  });
});
