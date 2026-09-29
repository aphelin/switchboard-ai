import { Injectable } from '@nestjs/common';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { RAG } from '../../../shared/constants/app.constants';
import { estimateTokens } from '../../../shared/ai/estimate-tokens';
import type { TextChunk } from '../types/documents.types';

export { estimateTokens };

/** Counts tokens the way the embedding model will see them. */
export type TokenCounter = (text: string) => number | Promise<number>;

export interface ChunkingOptions {
  /** Maximum chunk size in tokens (as measured by `countTokens`). */
  chunkSize?: number;
  chunkOverlap?: number;
  /** Defaults to the ~4 characters per token estimate; ingestion passes the embedding model's tokenizer. */
  countTokens?: TokenCounter;
}

interface Section {
  /** "Setup > API keys", or null for text before the first heading / plain text. */
  path: string | null;
  text: string;
}

const HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const FENCE = /^\s*(```|~~~)/;

/**
 * Splits markdown into sections at ATX headings, tracking the heading path.
 * Lines inside fenced code blocks are never read as headings ("# comment").
 * A heading with no text under it only contributes to its children's path.
 */
export function splitMarkdownSections(text: string): Section[] {
  const sections: Section[] = [];
  const stack: string[] = [];
  let path: string | null = null;
  let lines: string[] = [];
  let hasBody = false;
  let inFence = false;

  const flush = () => {
    if (hasBody) sections.push({ path, text: lines.join('\n').trim() });
    lines = [];
    hasBody = false;
  };

  for (const line of text.split('\n')) {
    if (FENCE.test(line)) inFence = !inFence;
    const heading = inFence ? null : HEADING.exec(line);
    if (heading) {
      flush();
      const level = heading[1].length;
      stack.length = level - 1;
      stack[level - 1] = heading[2];
      path = stack.filter(Boolean).join(' > ');
      lines.push(line);
      continue;
    }
    lines.push(line);
    if (line.trim()) hasBody = true;
  }
  flush();
  return sections;
}

/**
 * Structure-aware chunking. Markdown is first split at headings, so a chunk
 * never spans two sections and carries its heading path (used in the embedding
 * text and in citations). Each section is then split along natural boundaries
 * (paragraphs, lines, sentences) with overlap, sized in tokens rather than
 * characters: the embedding model truncates by tokens, and token density varies
 * a lot between prose, code and identifiers.
 */
@Injectable()
export class ChunkingService {
  async chunk(
    text: string,
    options: ChunkingOptions = {},
  ): Promise<TextChunk[]> {
    const countTokens = options.countTokens ?? estimateTokens;
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: options.chunkSize ?? RAG.CHUNK_TOKENS,
      chunkOverlap: options.chunkOverlap ?? RAG.CHUNK_OVERLAP_TOKENS,
      lengthFunction: async (piece) => countTokens(piece),
      separators: ['\n\n', '\n', '. ', '? ', '! ', ' ', ''],
    });

    const chunks: TextChunk[] = [];
    for (const section of splitMarkdownSections(text)) {
      for (const piece of await splitter.splitText(section.text)) {
        const content = piece.trim();
        if (!content) continue;
        chunks.push({
          index: chunks.length,
          content,
          tokenCount: await countTokens(content),
          section: section.path,
        });
      }
    }
    return chunks;
  }
}
