import { Global, Module } from '@nestjs/common';
import { LoggerModule } from './logger/logger.module';
import { ThrottlerModule } from './throttler/throttler.module';
import { CircuitBreakerService } from './circuit-breaker/circuit-breaker.service';

@Global()
@Module({
  imports: [LoggerModule, ThrottlerModule],
  providers: [CircuitBreakerService],
  exports: [CircuitBreakerService, LoggerModule, ThrottlerModule],
})
export class SharedModule {}
