import { Global, Module } from '@nestjs/common';
import { LoggerModule } from './logger/logger.module';
import { ThrottlerModule } from './throttler/throttler.module';
import { CircuitBreakerService } from './circuit-breaker/circuit-breaker.service';
import { StorageService } from './storage/storage.service';

// The throttler guard is registered in AuthModule, after AuthGuard, so limits apply per user.
@Global()
@Module({
  imports: [LoggerModule, ThrottlerModule],
  providers: [CircuitBreakerService, StorageService],
  exports: [
    CircuitBreakerService,
    StorageService,
    LoggerModule,
    ThrottlerModule,
  ],
})
export class SharedModule {}
