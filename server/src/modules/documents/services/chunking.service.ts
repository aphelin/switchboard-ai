import { Injectable } from '@nestjs/common';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { RAG } from '../../../shared/constants/app.constants';
import type { TextChunk } from '../types/documents.types';

export interface ChunkingOptions {
  chunkSize?: number;
  chunkOverlap?: number;
}

/** Rough token estimate (≈4 characters per token for English). */
export const estimateTokens = (text: string): number =>
  Math.ceil(text.length / 4);

/**
 * Splits text into overlapping chunks along natural boundaries (paragraphs,
 * then lines, then sentences) so that a chunk rarely cuts an idea in half.
 * Chunk size is the main retrieval tuning knob: small chunks are precise but
 * lose context, large chunks dilute the embedding.
 */
@Injectable()
export class ChunkingService {
  async chunk(
    text: string,
    options: ChunkingOptions = {},
  ): Promise<TextChunk[]> {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: options.chunkSize ?? RAG.CHUNK_SIZE,
      chunkOverlap: options.chunkOverlap ?? RAG.CHUNK_OVERLAP,
      separators: ['\n\n', '\n', '. ', '? ', '! ', ' ', ''],
    });

    const pieces = await splitter.splitText(text);

    return pieces
      .map((content) => content.trim())
      .filter((content) => content.length > 0)
      .map((content, index) => ({
        index,
        content,
        tokenCount: estimateTokens(content),
      }));
  }
}
