import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DemoController } from './controllers/demo.controller';
import { DemoGuestsService } from './services/demo-guests.service';
import { DemoTemplateService } from './services/demo-template.service';
import { DemoCleanupProcessor } from './processors/demo-cleanup.processor';
import { DEMO_QUEUE } from '../../shared/constants/app.constants';

/** One-click guest sessions: imported by AuthModule, whose sign-in hooks call these services. */
@Module({
  imports: [BullModule.registerQueue({ name: DEMO_QUEUE })],
  controllers: [DemoController],
  providers: [DemoGuestsService, DemoTemplateService, DemoCleanupProcessor],
  exports: [DemoGuestsService, DemoTemplateService],
})
export class DemoModule {}
