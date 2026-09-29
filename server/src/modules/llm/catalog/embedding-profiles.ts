/**
 * How a sentence-embedding model family expects to be called. Retrieval-tuned
 * models are trained with instruction prefixes, and using the wrong one (or none)
 * quietly lowers recall without any error.
 */
export interface EmbeddingProfile {
  family: string;
  /** Prepended to search queries. */
  queryPrefix: string;
  /** Prepended to passages at indexing time. */
  documentPrefix: string;
  /** How token vectors become one sentence vector (local models only). */
  pooling: 'cls' | 'mean';
}

const PROFILES: Array<{ match: RegExp; profile: EmbeddingProfile }> = [
  {
    match: /bge/i,
    profile: {
      family: 'bge',
      queryPrefix: 'Represent this sentence for searching relevant passages: ',
      documentPrefix: '',
      pooling: 'cls',
    },
  },
  {
    match: /(^|\/)(multilingual-)?e5/i,
    profile: {
      family: 'e5',
      queryPrefix: 'query: ',
      documentPrefix: 'passage: ',
      pooling: 'mean',
    },
  },
  {
    match: /nomic-embed/i,
    profile: {
      family: 'nomic',
      queryPrefix: 'search_query: ',
      documentPrefix: 'search_document: ',
      pooling: 'mean',
    },
  },
];

/** Symmetric models (MiniLM, GTE, hosted OpenAI-style APIs): no prefixes, mean pooling. */
const DEFAULT_PROFILE: EmbeddingProfile = {
  family: 'default',
  queryPrefix: '',
  documentPrefix: '',
  pooling: 'mean',
};

export function embeddingProfile(model: string): EmbeddingProfile {
  return (
    PROFILES.find(({ match }) => match.test(model))?.profile ?? DEFAULT_PROFILE
  );
}
