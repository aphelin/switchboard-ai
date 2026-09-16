import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { GenerationController } from './controllers/generation.controller';
import { GenerationService } from './services/generation.service';
import { ImageGenerationService } from './services/image-generation.service';
import { GenerationRepository } from './repositories/generation.repository';
import { GenerationProcessor } from './processors/generation.processor';
import { PollinationsModule } from '../pollinations/pollinations.module';
import { LlmModule } from '../llm/llm.module';
import { ProvidersModule } from '../providers/providers.module';
import { ObservabilityModule } from '../observability/observability.module';
import { GENERATION_QUEUE } from '../../shared/constants/app.constants';

@Module({
  imports: [
    BullModule.registerQueue({ name: GENERATION_QUEUE }),
    PollinationsModule,
    LlmModule,
    ProvidersModule,
    ObservabilityModule,
  ],
  controllers: [GenerationController],
  providers: [
    GenerationService,
    ImageGenerationService,
    GenerationRepository,
    GenerationProcessor,
  ],
  exports: [GenerationService],
})
export class GenerationModule {}
