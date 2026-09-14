import { Module } from '@nestjs/common';
import { ObservabilityModule } from '../observability/observability.module';
import { ModelRegistryService } from './services/model-registry.service';
import { PricingService } from './services/pricing.service';
import { LlmService } from './services/llm.service';
import { EmbeddingService } from './services/embedding.service';
import { PromptEnhancerService } from './services/prompt-enhancer.service';

@Module({
  imports: [ObservabilityModule],
  providers: [
    ModelRegistryService,
    PricingService,
    LlmService,
    EmbeddingService,
    PromptEnhancerService,
  ],
  exports: [
    ModelRegistryService,
    LlmService,
    EmbeddingService,
    PromptEnhancerService,
  ],
})
export class LlmModule {}
