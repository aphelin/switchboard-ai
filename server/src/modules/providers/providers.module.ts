import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { ProvidersController } from './controllers/providers.controller';
import { ProviderCredentialsService } from './services/provider-credentials.service';
import { ModelRouterService } from './services/model-router.service';
import { ImageModelCatalogService } from './services/image-model-catalog.service';

@Module({
  imports: [LlmModule],
  controllers: [ProvidersController],
  providers: [
    ProviderCredentialsService,
    ModelRouterService,
    ImageModelCatalogService,
  ],
  exports: [ModelRouterService],
})
export class ProvidersModule {}
