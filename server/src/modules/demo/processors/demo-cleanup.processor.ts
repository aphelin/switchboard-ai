import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { DemoGuestsService } from '../services/demo-guests.service';
import { DEMO, DEMO_QUEUE } from '../../../shared/constants/app.constants';

/**
 * Runs the expired-guest sweep on a BullMQ job scheduler rather than a timer:
 * with several API instances it still runs once per interval, and a crashed
 * run is retried like any other job.
 */
@Processor(DEMO_QUEUE)
export class DemoCleanupProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(DemoCleanupProcessor.name);

  constructor(
    private readonly guests: DemoGuestsService,
    @InjectQueue(DEMO_QUEUE) private readonly queue: Queue,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      DEMO.CLEANUP_JOB,
      { every: DEMO.CLEANUP_EVERY_MS },
      {
        name: DEMO.CLEANUP_JOB,
        opts: { removeOnComplete: 20, removeOnFail: 50 },
      },
    );
    this.logger.log('Expired-guest sweep scheduled');
  }

  async process(job: Job): Promise<{ deleted: number }> {
    if (job.name !== DEMO.CLEANUP_JOB) return { deleted: 0 };
    return { deleted: await this.guests.deleteExpired() };
  }
}
