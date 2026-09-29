import { describe, expect, it } from 'vitest';
import { embeddingProfile } from './embedding-profiles';

describe('embeddingProfile', () => {
  it('uses the BGE query instruction and CLS pooling', () => {
    expect(embeddingProfile('Xenova/bge-small-en-v1.5')).toMatchObject({
      family: 'bge',
      documentPrefix: '',
      pooling: 'cls',
    });
    expect(embeddingProfile('BAAI/bge-base-en-v1.5').queryPrefix).toMatch(
      /^Represent this sentence/,
    );
  });

  it('prefixes both sides for E5 and Nomic models', () => {
    expect(embeddingProfile('Xenova/multilingual-e5-small')).toMatchObject({
      queryPrefix: 'query: ',
      documentPrefix: 'passage: ',
    });
    expect(embeddingProfile('intfloat/e5-small-v2').family).toBe('e5');
    expect(embeddingProfile('nomic-ai/nomic-embed-text-v1.5')).toMatchObject({
      queryPrefix: 'search_query: ',
      documentPrefix: 'search_document: ',
    });
  });

  it('falls back to no prefixes for symmetric models', () => {
    expect(embeddingProfile('Xenova/all-MiniLM-L6-v2')).toMatchObject({
      family: 'default',
      queryPrefix: '',
      documentPrefix: '',
      pooling: 'mean',
    });
    expect(embeddingProfile('text-embedding-3-small').family).toBe('default');
  });
});
