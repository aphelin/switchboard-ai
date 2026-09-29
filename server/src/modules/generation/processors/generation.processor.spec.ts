import { describe, expect, it, vi } from 'vitest';
import type { Job } from 'bullmq';
import { GenerationProcessor } from './generation.processor';
import { BudgetExceededException } from '../../auth/errors/budget-exceeded.exception';
import { GenerationType, JobStatus } from 'generated/prisma/enums';
import type { GenerationJobData } from '../types/generation.types';

function setup(source: 'platform' | 'user') {
  const repository = {
    findById: vi.fn(() => Promise.resolve({ status: JobStatus.PENDING })),
    updateStatus: vi.fn(() => Promise.resolve({})),
  };
  const imageGeneration = { generate: vi.fn() };
  const sse = { emitStatusUpdate: vi.fn(), emitGenerationComplete: vi.fn() };
  const router = {
    resolveImage: vi.fn(() =>
      Promise.resolve({ source, model: { id: `${source}:model` } }),
    ),
  };
  const budget = {
    assertWithinBudget: vi.fn(() =>
      Promise.reject(new BudgetExceededException(0.5)),
    ),
  };
  const config = { get: () => ({ publicUrl: 'http://localhost:4000' }) };
  const processor = new GenerationProcessor(
    repository as never,
    imageGeneration as never,
    sse as never,
    {} as never,
    router as never,
    {} as never,
    {} as never,
    budget as never,
    config as never,
  );
  const job = {
    data: {
      generationId: 'gen-1',
      userId: 'user-1',
      prompt: 'a lighthouse',
      type: GenerationType.IMAGE,
      enhance: false,
      parameters: {},
    },
  } as Job<GenerationJobData>;
  return { processor, job, repository, imageGeneration, budget };
}

describe('GenerationProcessor budget', () => {
  it('fails a platform job queued past the daily budget', async () => {
    const { processor, job, repository, imageGeneration } = setup('platform');
    await processor.process(job);
    expect(imageGeneration.generate).not.toHaveBeenCalled();
    expect(repository.updateStatus).toHaveBeenLastCalledWith(
      'gen-1',
      JobStatus.FAILED,
      { error: expect.stringContaining('Daily AI budget') as unknown },
    );
  });

  it("doesn't charge the budget for a job on the user's own key", async () => {
    const { processor, job, budget, imageGeneration } = setup('user');
    imageGeneration.generate.mockRejectedValue(new Error('stop here'));
    await processor.process(job);
    expect(budget.assertWithinBudget).not.toHaveBeenCalled();
    expect(imageGeneration.generate).toHaveBeenCalled();
  });
});
