import { Global, Module } from '@nestjs/common';
import { SseService } from './services/sse.service';
import { SseController } from './controllers/sse.controller';

@Global()
@Module({
  controllers: [SseController],
  providers: [SseService],
  exports: [SseService],
})
export class SseModule {}
