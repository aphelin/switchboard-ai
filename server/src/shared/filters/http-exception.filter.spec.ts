import { describe, expect, it, vi } from 'vitest';
import { ArgumentsHost, NotFoundException } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import type { Logger } from 'nestjs-pino';
import { HttpExceptionFilter } from './http-exception.filter';

function run(exception: unknown) {
  const json = vi.fn();
  const response = {
    headersSent: false,
    status: vi.fn(() => ({ json })),
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ url: '/api/test' }),
    }),
  } as unknown as ArgumentsHost;
  const logger = { error: vi.fn(), warn: vi.fn() };
  new HttpExceptionFilter(logger as unknown as Logger).catch(exception, host);
  const [[status]] = response.status.mock.calls as unknown as [[number]];
  const [[body]] = json.mock.calls as unknown as [[Record<string, unknown>]];
  return { status, body, logger };
}

describe('HttpExceptionFilter', () => {
  it('hides internal error details in 5xx responses', () => {
    const { status, body, logger } = run(
      new Error('Invalid storage key: ../../etc/passwd'),
    );
    expect(status).toBe(500);
    expect(body.message).toBe('Internal server error');
    expect(JSON.stringify(body)).not.toContain('storage key');
    // ...but the log keeps them.
    expect(logger.error).toHaveBeenCalledWith(
      expect.anything(),
      'Invalid storage key: ../../etc/passwd',
    );
  });

  it('hides database error details', () => {
    const error = new PrismaClientKnownRequestError(
      'Invalid `prisma.generation.create()` invocation: Unique constraint failed on the fields: (`jobId`)',
      { code: 'P2002', clientVersion: '7.0.0' },
    );
    const { status, body } = run(error);
    expect(status).toBe(409);
    expect(body.message).toBe('A record with these values already exists');
    expect(JSON.stringify(body)).not.toContain('prisma');

    const unknown = run(
      new PrismaClientKnownRequestError('connection to 10.0.0.5:5432 lost', {
        code: 'P1017',
        clientVersion: '7.0.0',
      }),
    );
    expect(unknown.status).toBe(500);
    expect(JSON.stringify(unknown.body)).not.toContain('10.0.0.5');
  });

  it('keeps HttpException messages', () => {
    const { status, body } = run(
      new NotFoundException('Document 42 not found'),
    );
    expect(status).toBe(404);
    expect(body.message).toBe('Document 42 not found');
  });
});
