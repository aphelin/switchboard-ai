import { describe, expect, it, vi } from 'vitest';
import { HttpException } from '@nestjs/common';
import { GenerationService } from './generation.service';
import { GenerationType, JobPriority, JobStatus } from 'generated/prisma/enums';
import type { GenerationRepository } from '../repositories/generation.repository';
import type { StorageService } from '../../../shared/storage/storage.service';
import type { BudgetService } from '../../auth/services/budget.service';
import type { ModelRouterService } from '../../providers/services/model-router.service';
import type { SseService } from '../../sse/services/sse.service';
import type { Generation } from '../types/generation.types';
import { MAX_IN_FLIGHT_GENERATIONS } from '../../../shared/constants/app.constants';

const generation = (overrides: Partial<Generation> = {}): Generation =>
  ({
    id: 'gen-copy',
    userId: 'guest-1',
    type: GenerationType.IMAGE,
    status: JobStatus.COMPLETED,
    priority: JobPriority.NORMAL,
    prompt: 'a lighthouse',
    parameters: { storageKey: 'images/gen-template.png' },
    ...overrides,
  }) as Generation;

function setup(options: { othersUsingFile?: number; inFlight?: number } = {}) {
  const repository = {
    findByIdForUser: vi.fn(() => Promise.resolve(generation())),
    delete: vi.fn(() => Promise.resolve()),
    countOthersUsingStorageKey: vi.fn(() =>
      Promise.resolve(options.othersUsingFile ?? 0),
    ),
    countInFlight: vi.fn(() => Promise.resolve(options.inFlight ?? 0)),
    create: vi.fn(),
  };
  const storage = { delete: vi.fn(() => Promise.resolve()) };
  const budget = { assertWithinBudget: vi.fn(() => Promise.resolve()) };
  const router = {
    resolve: vi.fn(() => Promise.resolve({ source: 'platform' })),
    resolveImage: vi.fn(() => Promise.resolve({ source: 'platform' })),
  };
  const queue = { add: vi.fn() };
  const config = { get: () => ({ publicUrl: 'http://localhost:4000' }) };
  const service = new GenerationService(
    repository as unknown as GenerationRepository,
    { events$: undefined } as unknown as SseService,
    budget as unknown as BudgetService,
    router as unknown as ModelRouterService,
    storage as unknown as StorageService,
    queue as never,
    config as never,
  );
  return { service, repository, storage, queue };
}

describe('GenerationService.remove', () => {
  it('keeps an image file another generation still uses', async () => {
    const { service, repository, storage } = setup({ othersUsingFile: 3 });
    await service.remove('guest-1', 'gen-copy');
    expect(repository.delete).toHaveBeenCalledWith('gen-copy');
    expect(repository.countOthersUsingStorageKey).toHaveBeenCalledWith(
      'images/gen-template.png',
      'gen-copy',
    );
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it('deletes an image file nobody else uses', async () => {
    const { service, storage } = setup({ othersUsingFile: 0 });
    await service.remove('guest-1', 'gen-copy');
    expect(storage.delete).toHaveBeenCalledWith('images/gen-template.png');
  });
});

describe('GenerationService.create', () => {
  it('refuses a new job while too many are in flight', async () => {
    const { service, repository, queue } = setup({
      inFlight: MAX_IN_FLIGHT_GENERATIONS,
    });
    const attempt = service.create('user-1', {
      prompt: 'a lighthouse',
      type: GenerationType.IMAGE,
    });
    await expect(attempt).rejects.toBeInstanceOf(HttpException);
    await expect(attempt).rejects.toMatchObject({ status: 429 });
    expect(repository.create).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });
});
