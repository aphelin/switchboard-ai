import { Module } from '@nestjs/common';
import { TraceService } from './services/trace.service';
import { LangfuseService } from './services/langfuse.service';
import { TraceController } from './controllers/trace.controller';

@Module({
  controllers: [TraceController],
  providers: [TraceService, LangfuseService],
  exports: [TraceService, LangfuseService],
})
export class ObservabilityModule {}
