import { Injectable } from '@nestjs/common';
import { DocumentsRepository } from '../repositories/documents.repository';
import { EmbeddingService } from '../../llm/services/embedding.service';
import { reciprocalRankFusion } from '../../../shared/ai/rrf';
import { scanForInjection } from '../../../shared/ai/injection-scanner';
import { RAG } from '../../../shared/constants/app.constants';
import type {
  ChunkRow,
  RetrievedChunk,
  SearchParams,
} from '../types/documents.types';

/**
 * Hybrid retrieval: semantic (pgvector) and lexical (Postgres full-text) search
 * run in parallel and are merged with Reciprocal Rank Fusion. Vectors catch
 * paraphrases ("staff" vs "employees"); keywords catch exact identifiers, names
 * and codes that embeddings blur. Together they beat either one alone.
 */
@Injectable()
export class RetrievalService {
  constructor(
    private readonly repository: DocumentsRepository,
    private readonly embedding: EmbeddingService,
  ) {}

  async search(params: SearchParams): Promise<RetrievedChunk[]> {
    const { query, documentIds, traceId } = params;
    const topK = params.topK ?? RAG.TOP_K;
    const mode = params.mode ?? 'hybrid';
    const pool = Math.max(RAG.CANDIDATE_POOL, topK);

    const [vectorHits, keywordHits] = await Promise.all([
      mode === 'keyword'
        ? Promise.resolve<ChunkRow[]>([])
        : this.embedding
            .embedQuery(query, traceId)
            .then((vector) =>
              this.repository.vectorSearch(vector, pool, documentIds),
            ),
      mode === 'vector'
        ? Promise.resolve<ChunkRow[]>([])
        : this.repository.keywordSearch(query, pool, documentIds),
    ]);

    const fused = reciprocalRankFusion(
      {
        vector: vectorHits.map((row) => ({ id: row.id, item: row })),
        keyword: keywordHits.map((row) => ({ id: row.id, item: row })),
      },
      RAG.RRF_K,
    );

    const vectorScores = new Map(vectorHits.map((row) => [row.id, row.score]));
    const keywordScores = new Map(
      keywordHits.map((row) => [row.id, row.score]),
    );

    return fused.slice(0, topK).map(({ item, score, ranks }) => {
      const scan = scanForInjection(item.content);
      return {
        chunkId: item.id,
        documentId: item.documentId,
        documentTitle: item.documentTitle,
        chunkIndex: item.index,
        content: item.content,
        score,
        vectorScore: vectorScores.get(item.id),
        keywordScore: keywordScores.get(item.id),
        ranks,
        flagged: scan.flagged,
        flagReasons: scan.reasons,
      };
    });
  }
}
