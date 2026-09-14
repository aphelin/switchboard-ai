import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { embedMany, type EmbeddingModel } from 'ai';
import {
  env as transformersEnv,
  pipeline,
  type FeatureExtractionPipeline,
} from '@huggingface/transformers';
import { ModelRegistryService } from './model-registry.service';
import { TraceService } from '../../observability/services/trace.service';
import type {
  AppConfiguration,
  EmbeddingConfig,
} from '../../../config/configuration.interface';
import { EMBEDDING_BATCH_SIZE } from '../../../shared/constants/app.constants';

/** BGE models are trained with this prefix on the query side (not on passages). */
const BGE_QUERY_PREFIX =
  'Represent this sentence for searching relevant passages: ';

/**
 * Turns text into vectors for semantic search. The default runs a small
 * sentence-embedding model in-process via Transformers.js (ONNX, CPU): no API
 * key, no per-token cost, and the same code path in dev, CI and Docker.
 * Set EMBEDDING_PROVIDER=openai-compatible to use a hosted embedding API instead.
 */
@Injectable()
export class EmbeddingService implements OnModuleInit {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly config: EmbeddingConfig;
  private localPipeline?: Promise<FeatureExtractionPipeline>;
  private remoteModel?: EmbeddingModel;

  constructor(
    configService: ConfigService<AppConfiguration, true>,
    private readonly registry: ModelRegistryService,
    private readonly trace: TraceService,
  ) {
    this.config = configService.get('embedding', { infer: true });
  }

  get dimensions(): number {
    return this.config.dimensions;
  }

  get modelName(): string {
    return this.config.model;
  }

  onModuleInit(): void {
    if (this.config.provider === 'local') {
      // Warm up in the background so the first search doesn't pay the model load.
      void this.getLocalPipeline().catch((error) =>
        this.logger.error(
          `Failed to load embedding model ${this.config.model}: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    } else {
      if (!this.config.baseUrl) {
        throw new Error(
          'EMBEDDING_BASE_URL is required for openai-compatible embeddings',
        );
      }
      this.remoteModel = this.registry.embeddingModel(
        this.config.model,
        this.config.baseUrl,
        this.config.apiKey,
      );
    }
  }

  /** Embeds passages for indexing (title + chunk text is passed by the caller). */
  async embedDocuments(texts: string[], traceId?: string): Promise<number[][]> {
    if (texts.length === 0) return [];
    return this.timed('embedding.documents', traceId, texts.length, () =>
      this.embedBatched(texts),
    );
  }

  /** Embeds a search query (applies the model's query instruction if it has one). */
  async embedQuery(text: string, traceId?: string): Promise<number[]> {
    const input = this.isBgeModel ? `${BGE_QUERY_PREFIX}${text}` : text;
    const [vector] = await this.timed('embedding.query', traceId, 1, () =>
      this.embedBatched([input]),
    );
    return vector;
  }

  private get isBgeModel(): boolean {
    return /bge/i.test(this.config.model);
  }

  private async embedBatched(texts: string[]): Promise<number[][]> {
    const vectors: number[][] = [];
    for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
      const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);
      const result =
        this.config.provider === 'local'
          ? await this.embedLocal(batch)
          : await this.embedRemote(batch);
      vectors.push(...result);
    }
    this.assertDimensions(vectors);
    return vectors;
  }

  private async embedLocal(texts: string[]): Promise<number[][]> {
    const extractor = await this.getLocalPipeline();
    const output = await extractor(texts, {
      // BGE uses the [CLS] token as the sentence vector; MiniLM-style models use mean pooling.
      pooling: this.isBgeModel ? 'cls' : 'mean',
      normalize: true,
    });
    return output.tolist() as number[][];
  }

  private async embedRemote(texts: string[]): Promise<number[][]> {
    if (!this.remoteModel)
      throw new Error('Remote embedding model not initialised');
    const { embeddings } = await embedMany({
      model: this.remoteModel,
      values: texts,
    });
    return embeddings;
  }

  private getLocalPipeline(): Promise<FeatureExtractionPipeline> {
    if (!this.localPipeline) {
      transformersEnv.cacheDir = this.config.cacheDir;
      transformersEnv.allowLocalModels = false;
      this.logger.log(`Loading local embedding model ${this.config.model}...`);
      const startedAt = Date.now();
      this.localPipeline = pipeline('feature-extraction', this.config.model, {
        dtype: 'q8',
      }).then((pipe) => {
        this.logger.log(`Embedding model ready in ${Date.now() - startedAt}ms`);
        return pipe;
      });
      this.localPipeline.catch(() => {
        this.localPipeline = undefined;
      });
    }
    return this.localPipeline;
  }

  private assertDimensions(vectors: number[][]): void {
    const bad = vectors.find((v) => v.length !== this.config.dimensions);
    if (bad) {
      throw new Error(
        `Embedding model returned ${bad.length} dimensions but the database column expects ${this.config.dimensions}. ` +
          `Change EMBEDDING_MODEL or the vector(N) size in prisma/schema.prisma.`,
      );
    }
  }

  private async timed<T>(
    name: string,
    traceId: string | undefined,
    count: number,
    run: () => Promise<T>,
  ): Promise<T> {
    const startedAt = Date.now();
    try {
      const result = await run();
      await this.trace.record({
        name,
        traceId,
        provider: this.config.provider,
        model: this.config.model,
        costUsd: this.config.provider === 'local' ? 0 : null,
        latencyMs: Date.now() - startedAt,
        status: 'ok',
        metadata: { count },
      });
      return result;
    } catch (error) {
      await this.trace.record({
        name,
        traceId,
        provider: this.config.provider,
        model: this.config.model,
        latencyMs: Date.now() - startedAt,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        metadata: { count },
      });
      throw error;
    }
  }
}
