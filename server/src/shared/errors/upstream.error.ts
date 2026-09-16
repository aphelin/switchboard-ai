import { HttpException, HttpStatus } from '@nestjs/common';
import { isAxiosError } from 'axios';
import { redactSecrets } from '../ai/redact-secrets';

/**
 * A failure from an external AI provider, with the upstream HTTP status when known.
 * 4xx statuses are configuration/input problems (bad key, bad model) and should
 * not trip circuit breakers; 5xx/timeouts are real outages and should.
 */
export class UpstreamError extends Error {
  constructor(
    readonly service: string,
    readonly status: number | undefined,
    message: string,
  ) {
    super(`${service}: ${message}`);
    this.name = 'UpstreamError';
  }

  get isClientError(): boolean {
    return (
      this.status !== undefined &&
      this.status >= 400 &&
      this.status < 500 &&
      this.status !== 429
    );
  }
}

export class ServiceUnavailableError extends HttpException {
  constructor(message: string) {
    super(message, HttpStatus.SERVICE_UNAVAILABLE);
  }
}

const CIRCUIT_OPEN_CODE = 'EOPENBREAKER';

export const isCircuitOpenError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  (error as { code?: string }).code === CIRCUIT_OPEN_CODE;

/** Extracts an HTTP status from axios errors and AI SDK `APICallError`s. */
export const upstreamStatusOf = (error: unknown): number | undefined => {
  if (isAxiosError(error)) return error.response?.status;
  if (error instanceof UpstreamError) return error.status;
  if (typeof error === 'object' && error !== null) {
    const status = (error as { statusCode?: unknown }).statusCode;
    if (typeof status === 'number') return status;
    // AI SDK RetryError: the status is on the last attempt's error.
    const lastError = (error as { lastError?: unknown }).lastError;
    if (lastError && lastError !== error) return upstreamStatusOf(lastError);
  }
  return undefined;
};

/** Circuit-breaker `errorFilter`: true means "do not count this as a failure". */
export const isUpstreamClientError = (error: unknown): boolean => {
  if (error instanceof UpstreamError) return error.isClientError;
  const status = upstreamStatusOf(error);
  return (
    status !== undefined && status >= 400 && status < 500 && status !== 429
  );
};

export const toUpstreamError = (
  service: string,
  error: unknown,
): UpstreamError => {
  if (error instanceof UpstreamError) return error;
  const status = upstreamStatusOf(error);
  let message = error instanceof Error ? error.message : String(error);
  if (isAxiosError(error)) {
    const body = error.response?.data as
      | { error?: { message?: string } | string; message?: string }
      | undefined;
    const upstreamMessage =
      (typeof body?.error === 'object' ? body.error?.message : body?.error) ??
      body?.message;
    if (status) {
      message = `HTTP ${status}${upstreamMessage ? ` - ${upstreamMessage}` : ''}`;
    }
  }
  // Provider error bodies can echo the key that was sent.
  return new UpstreamError(service, status, redactSecrets(message));
};

/**
 * Circuit-breaker filter for calls on users' own keys: besides 4xx, a rate
 * limit (429) on one user's key says nothing about the provider's health.
 */
export const isNotProviderOutage = (error: unknown): boolean =>
  isUpstreamClientError(error) || upstreamStatusOf(error) === 429;

/** Upstream error for a call on the user's own key: a rejected key gets an actionable message. */
export const toUserKeyError = (
  service: string,
  error: unknown,
): UpstreamError => {
  const upstream = toUpstreamError(service, error);
  if (upstream.status === 401 || upstream.status === 403) {
    return new UpstreamError(
      service,
      upstream.status,
      `rejected your API key (HTTP ${upstream.status}). Update or remove it under AI providers.`,
    );
  }
  return upstream;
};
