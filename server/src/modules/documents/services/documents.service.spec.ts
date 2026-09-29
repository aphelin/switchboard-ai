import { describe, expect, it, vi } from 'vitest';
import { DocumentsService, ingestionJobId } from './documents.service';
import {
  JOB_ATTEMPTS,
  JOB_BACKOFF_DELAY,
} from '../../../shared/constants/app.constants';

function setup(existingState?: string) {
  const existing = existingState
    ? {
        getState: vi.fn(() => Promise.resolve(existingState)),
        remove: vi.fn(() => Promise.resolve()),
      }
    : undefined;
  const queue = {
    getJob: vi.fn(() => Promise.resolve(existing)),
    add: vi.fn(() => Promise.resolve({})),
  };
  const repository = {
    findByIdForUser: vi.fn(() => Promise.resolve({ id: 'doc-1' })),
    updateStatus: vi.fn(() => Promise.resolve({ id: 'doc-1' })),
    findStaleEmbeddingDocumentIds: vi.fn(() =>
      Promise.resolve(['doc-old-1', 'doc-old-2']),
    ),
  };
  const embedding = { modelName: 'Xenova/bge-small-en-v1.5' };
  const service = new DocumentsService(
    repository as never,
    {} as never,
    embedding as never,
    queue as never,
  );
  return { service, queue, existing, repository };
}

describe('DocumentsService ingestion queue', () => {
  it('queues ingestion with a stable job id and retries', async () => {
    const { service, queue } = setup();
    await service.reindex('user-1', 'doc-1');
    expect(queue.add).toHaveBeenCalledWith(
      'ingest',
      { documentId: 'doc-1' },
      expect.objectContaining({
        jobId: ingestionJobId('doc-1'),
        attempts: JOB_ATTEMPTS,
        backoff: { type: 'exponential', delay: JOB_BACKOFF_DELAY },
      }),
    );
    expect(JOB_ATTEMPTS).toBeGreaterThan(1);
  });

  it('does not queue a document twice while its job is waiting or running', async () => {
    const { service, queue } = setup('active');
    await service.reindex('user-1', 'doc-1');
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('replaces a finished job so a later reindex still runs', async () => {
    const { service, queue, existing } = setup('completed');
    await service.reindex('user-1', 'doc-1');
    expect(existing!.remove).toHaveBeenCalled();
    expect(queue.add).toHaveBeenCalledTimes(1);
  });

  it('re-indexes documents embedded by another model on startup', async () => {
    const { service, queue, repository } = setup();
    await service.onApplicationBootstrap();
    expect(repository.findStaleEmbeddingDocumentIds).toHaveBeenCalledWith(
      'Xenova/bge-small-en-v1.5',
    );
    expect(queue.add).toHaveBeenCalledTimes(2);
  });
});
