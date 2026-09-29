import { describe, expect, it, vi } from 'vitest';
import type { Job } from 'bullmq';
import {
  DocumentIngestionProcessor,
  embeddingTextFor,
} from './document-ingestion.processor';
import { ChunkingService } from '../services/chunking.service';
import { DocumentStatus } from 'generated/prisma/enums';
import type { DocumentIngestionJobData } from '../types/documents.types';

const MARKDOWN = '# Runbook\n\n## Contacts\n\nSecondary on-call: Mikkel.';

function setup(embed: () => Promise<number[][]>) {
  const repository = {
    findById: vi.fn(() =>
      Promise.resolve({
        id: 'doc-1',
        userId: 'user-1',
        title: 'Vault runbook',
        content: MARKDOWN,
      }),
    ),
    updateStatus: vi.fn(() => Promise.resolve({ chunkCount: 0, error: null })),
    replaceChunks: vi.fn(() => Promise.resolve()),
  };
  const embedding = {
    modelName: 'Xenova/bge-small-en-v1.5',
    countTokens: vi.fn((text: string) => Promise.resolve(text.length)),
    embedDocuments: vi.fn(embed),
  };
  const processor = new DocumentIngestionProcessor(
    repository as never,
    new ChunkingService(),
    embedding as never,
    { emitDocumentUpdate: vi.fn() } as never,
  );
  const job = (attemptsMade: number) =>
    ({
      data: { documentId: 'doc-1' },
      attemptsMade,
      opts: { attempts: 3 },
    }) as unknown as Job<DocumentIngestionJobData>;
  return { processor, repository, embedding, job };
}

const lastStatus = (repository: {
  updateStatus: { mock: { calls: unknown[][] } };
}) => repository.updateStatus.mock.calls.at(-1)?.[1];

describe('DocumentIngestionProcessor', () => {
  it('marks FAILED only after the last attempt', async () => {
    const { processor, repository, job } = setup(() =>
      Promise.reject(new Error('embedding API returned 503')),
    );

    await expect(processor.process(job(0))).rejects.toThrow('503');
    expect(lastStatus(repository)).toBe(DocumentStatus.PENDING);

    await expect(processor.process(job(1))).rejects.toThrow('503');
    expect(lastStatus(repository)).toBe(DocumentStatus.PENDING);

    await expect(processor.process(job(2))).rejects.toThrow('503');
    expect(lastStatus(repository)).toBe(DocumentStatus.FAILED);
    expect(repository.replaceChunks).not.toHaveBeenCalled();
  });

  it('stores the embedding model with the chunks', async () => {
    const { processor, repository, embedding, job } = setup(() =>
      Promise.resolve([[0.1, 0.2]]),
    );
    await processor.process(job(0));

    // Chunks are sized with the embedding model's tokenizer.
    expect(embedding.countTokens).toHaveBeenCalled();
    // Title and heading path are embedded with the chunk, not stored in it.
    expect(embedding.embedDocuments).toHaveBeenCalledWith(
      [
        'Vault runbook\nRunbook > Contacts\n\n## Contacts\n\nSecondary on-call: Mikkel.',
      ],
      expect.anything(),
    );
    expect(repository.replaceChunks).toHaveBeenCalledWith(
      'doc-1',
      [
        expect.objectContaining({
          section: 'Runbook > Contacts',
          content: '## Contacts\n\nSecondary on-call: Mikkel.',
          embedding: [0.1, 0.2],
        }),
      ],
      'Xenova/bge-small-en-v1.5',
    );
    expect(lastStatus(repository)).toBe(DocumentStatus.READY);
  });

  it('embeds plain text chunks with just the title', () => {
    expect(
      embeddingTextFor('Notes', {
        index: 0,
        content: 'Hello.',
        tokenCount: 2,
        section: null,
      }),
    ).toBe('Notes\n\nHello.');
  });
});
