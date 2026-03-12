import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { GenerationController } from './controllers/generation.controller';
import { GenerationService } from './services/generation.service';
import { GenerationRepository } from './repositories/generation.repository';
import { GenerationProcessor } from './processors/generation.processor';
import { PollinationsModule } from '../pollinations/pollinations.module';
import { GENERATION_QUEUE } from '../../shared/constants/app.constants';

@Module({
  imports: [
    BullModule.registerQueue({ name: GENERATION_QUEUE }),
    PollinationsModule,
  ],
  controllers: [GenerationController],
  providers: [GenerationService, GenerationRepository, GenerationProcessor],
})
export class GenerationModule {}
