import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { LoggerModule } from './logger/logger.module';
import { ThrottlerModule } from './throttler/throttler.module';
import { CircuitBreakerService } from './circuit-breaker/circuit-breaker.service';
import { StorageService } from './storage/storage.service';

@Global()
@Module({
  imports: [LoggerModule, ThrottlerModule],
  providers: [
    CircuitBreakerService,
    StorageService,
    // Enforces THROTTLE_CONFIGS on every route; streaming/asset routes opt out with @SkipThrottle().
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
  exports: [
    CircuitBreakerService,
    StorageService,
    LoggerModule,
    ThrottlerModule,
  ],
})
export class SharedModule {}
