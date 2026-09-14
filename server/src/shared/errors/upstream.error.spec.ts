import { AxiosError } from 'axios';
import { describe, expect, it } from 'vitest';
import {
  isCircuitOpenError,
  isUpstreamClientError,
  toUpstreamError,
  UpstreamError,
  upstreamStatusOf,
} from './upstream.error';

const axiosError = (status: number, data?: unknown) =>
  new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
    status,
    statusText: 'x',
    data,
    headers: {},
    config: {} as never,
  });

describe('isUpstreamClientError (circuit-breaker errorFilter)', () => {
  it('treats 4xx (except 429) as client errors that must not trip the breaker', () => {
    expect(
      isUpstreamClientError(new UpstreamError('svc', 401, 'unauthorised')),
    ).toBe(true);
    expect(
      isUpstreamClientError(new UpstreamError('svc', 404, 'missing')),
    ).toBe(true);
    expect(isUpstreamClientError(axiosError(400))).toBe(true);
    expect(isUpstreamClientError({ statusCode: 422 })).toBe(true);
  });

  it('counts 429 and 5xx as real failures', () => {
    expect(
      isUpstreamClientError(new UpstreamError('svc', 429, 'slow down')),
    ).toBe(false);
    expect(isUpstreamClientError(axiosError(500))).toBe(false);
    expect(isUpstreamClientError(axiosError(503))).toBe(false);
    expect(isUpstreamClientError({ statusCode: 502 })).toBe(false);
  });

  it('counts errors without a status (timeouts, network) as failures', () => {
    expect(isUpstreamClientError(new Error('socket hang up'))).toBe(false);
    expect(
      isUpstreamClientError(new UpstreamError('svc', undefined, 'timeout')),
    ).toBe(false);
    expect(isUpstreamClientError(null)).toBe(false);
  });
});

describe('upstreamStatusOf', () => {
  it('reads the status from axios errors and AI SDK style errors', () => {
    expect(upstreamStatusOf(axiosError(418))).toBe(418);
    expect(upstreamStatusOf({ statusCode: 401 })).toBe(401);
    expect(upstreamStatusOf(new Error('nope'))).toBeUndefined();
  });
});

describe('toUpstreamError', () => {
  it('formats axios errors with the upstream status and message', () => {
    const error = toUpstreamError(
      'Pollinations',
      axiosError(401, { error: { message: 'bad key' } }),
    );
    expect(error).toBeInstanceOf(UpstreamError);
    expect(error.status).toBe(401);
    expect(error.message).toBe('Pollinations: HTTP 401 - bad key');
    expect(error.isClientError).toBe(true);
  });

  it('wraps plain errors and keeps existing UpstreamErrors untouched', () => {
    const plain = toUpstreamError('LLM', new Error('boom'));
    expect(plain.message).toBe('LLM: boom');
    expect(plain.status).toBeUndefined();

    const existing = new UpstreamError('LLM', 500, 'down');
    expect(toUpstreamError('other', existing)).toBe(existing);
  });
});

describe('isCircuitOpenError', () => {
  it('recognises opossum open-circuit rejections by code', () => {
    expect(isCircuitOpenError({ code: 'EOPENBREAKER' })).toBe(true);
    expect(isCircuitOpenError({ code: 'ETIMEDOUT' })).toBe(false);
    expect(isCircuitOpenError(new Error('x'))).toBe(false);
    expect(isCircuitOpenError(undefined)).toBe(false);
  });
});
