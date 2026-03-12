import { Injectable, Logger } from '@nestjs/common';
import CircuitBreaker, { type Options } from 'opossum';
import { CIRCUIT_BREAKER_OPTIONS } from '../constants/app.constants';

type AsyncFn<TResult> = (...args: unknown[]) => Promise<TResult>;

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);

  create<TResult>(
    fn: AsyncFn<TResult>,
    options?: Partial<Options>,
    fallback?: AsyncFn<TResult>,
  ): CircuitBreaker {
    const breaker = new CircuitBreaker(fn, {
      ...CIRCUIT_BREAKER_OPTIONS,
      ...options,
    });

    const name = fn.name || 'anonymous';

    breaker.on('open', () =>
      this.logger.warn(`Circuit breaker OPENED for: ${name}`),
    );
    breaker.on('halfOpen', () =>
      this.logger.log(`Circuit breaker HALF-OPEN for: ${name}`),
    );
    breaker.on('close', () =>
      this.logger.log(`Circuit breaker CLOSED for: ${name}`),
    );
    breaker.on('fallback', () =>
      this.logger.warn(`Circuit breaker FALLBACK triggered for: ${name}`),
    );
    breaker.on('failure', (error: unknown) =>
      this.logger.error(
        `Circuit breaker FAILURE for: ${name} — ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      ),
    );

    if (fallback) {
      breaker.fallback(fallback);
    }

    return breaker;
  }
}
