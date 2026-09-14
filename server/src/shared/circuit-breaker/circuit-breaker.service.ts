import { Injectable, Logger } from '@nestjs/common';
import CircuitBreaker, { type Options } from 'opossum';
import { CIRCUIT_BREAKER_OPTIONS } from '../constants/app.constants';
import { isUpstreamClientError } from '../errors/upstream.error';
import { redactSecrets } from '../ai/redact-secrets';

type AsyncFn<TResult> = (...args: any[]) => Promise<TResult>;

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);

  /**
   * Wraps an upstream call. Client errors (4xx: bad key, bad input) are NOT
   * counted as failures, so a misconfiguration never looks like an outage.
   * Errors are re-thrown untouched so callers can surface the real cause;
   * an open circuit rejects with `code: 'EOPENBREAKER'`.
   */
  create<TResult>(
    fn: AsyncFn<TResult>,
    options?: Partial<Options>,
  ): CircuitBreaker<any[], TResult> {
    const breaker = new CircuitBreaker<any[], TResult>(fn, {
      ...CIRCUIT_BREAKER_OPTIONS,
      errorFilter: isUpstreamClientError,
      ...options,
    });

    const name = options?.name ?? fn.name ?? 'anonymous';

    breaker.on('open', () =>
      this.logger.warn(`Circuit breaker OPENED for: ${name}`),
    );
    breaker.on('halfOpen', () =>
      this.logger.log(`Circuit breaker HALF-OPEN for: ${name}`),
    );
    breaker.on('close', () =>
      this.logger.log(`Circuit breaker CLOSED for: ${name}`),
    );
    // Provider error messages can echo the API key that was sent.
    breaker.on('failure', (error: unknown) =>
      this.logger.error(
        `Circuit breaker FAILURE for: ${name} — ${redactSecrets(error instanceof Error ? error.message : String(error))}`,
      ),
    );

    return breaker;
  }
}
