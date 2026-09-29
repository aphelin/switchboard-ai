import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Logger } from 'nestjs-pino';
import CircuitBreaker from 'opossum';
import { isAxiosError, type AxiosError } from 'axios';
import {
  PrismaClientKnownRequestError,
  PrismaClientValidationError,
} from '@prisma/client/runtime/client';

export interface ExceptionResponse {
  status: number;
  message: string;
  error: string;
}

const CIRCUIT_BREAKER_CODE_OPEN = 'EOPENBREAKER';
const CIRCUIT_BREAKER_CODE_TIMEOUT = 'ETIMEDOUT';
const CIRCUIT_BREAKER_CODE_SEMAPHORE = 'ESEMLOCKED';
const CIRCUIT_BREAKER_CODE_SHUTDOWN = 'ESHUTDOWN';

const isCircuitBreakerError = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null) return false;
  const code = (error as { code?: string }).code ?? '';
  return (
    code === CIRCUIT_BREAKER_CODE_OPEN ||
    code === CIRCUIT_BREAKER_CODE_TIMEOUT ||
    code === CIRCUIT_BREAKER_CODE_SEMAPHORE ||
    code === CIRCUIT_BREAKER_CODE_SHUTDOWN ||
    CircuitBreaker.isOurError(error as Error)
  );
};

const extractFromHttpException = (
  exception: HttpException,
): ExceptionResponse => {
  const status = exception.getStatus();
  const exceptionResponse = exception.getResponse();
  let message = 'Internal server error';
  let error = statusLabel(status);

  if (typeof exceptionResponse === 'string') {
    message = exceptionResponse;
  } else if (typeof exceptionResponse === 'object') {
    const res = exceptionResponse as Record<string, unknown>;
    message = (res.message as string) || message;
    error = (res.error as string) || error;
  }

  return { status, message, error };
};

/** "TOO_MANY_REQUESTS" -> "Too Many Requests", for exceptions created from a plain message. */
function statusLabel(status: number): string {
  const name = HttpStatus[status] as string | undefined;
  if (!name) return 'Error';
  return name
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

const formatCircuitBreakerError = (): ExceptionResponse => ({
  status: HttpStatus.SERVICE_UNAVAILABLE,
  message: 'Service temporarily unavailable',
  error: 'Service Unavailable',
});

/** Shown for any unexpected failure: the details go to the log, never to the client. */
const INTERNAL_ERROR_MESSAGE = 'Internal server error';

const formatAxiosError = (error: AxiosError): ExceptionResponse => {
  const status = error.response?.status ?? HttpStatus.BAD_GATEWAY;
  // An upstream 4xx explains what was wrong with the request; anything else is an outage.
  const message =
    status < 500
      ? ((error.response?.data as { message?: string })?.message ??
        'External request failed')
      : 'External service unavailable';
  const error_label = error.response?.status
    ? `HTTP ${error.response.status}`
    : 'Bad Gateway';

  return { status, message, error: error_label };
};

const mapPrismaCodeToStatus = (code: string): number => {
  switch (code) {
    case 'P2002':
      return HttpStatus.CONFLICT;
    case 'P2003':
      return HttpStatus.BAD_REQUEST;
    case 'P2025':
      return HttpStatus.NOT_FOUND;
    default:
      return HttpStatus.INTERNAL_SERVER_ERROR;
  }
};

/** Prisma messages quote the query, model and column names, so clients get a fixed sentence per code. */
const PRISMA_CLIENT_MESSAGES: Record<string, string> = {
  P2002: 'A record with these values already exists',
  P2003: 'A related record does not exist',
  P2025: 'Record not found',
};

const formatPrismaError = (error: Error): ExceptionResponse => {
  if (error instanceof PrismaClientKnownRequestError) {
    const status = mapPrismaCodeToStatus(error.code);
    return {
      status,
      message: PRISMA_CLIENT_MESSAGES[error.code] ?? INTERNAL_ERROR_MESSAGE,
      error: status < 500 ? statusLabel(status) : 'Internal Server Error',
    };
  }

  if (error instanceof PrismaClientValidationError) {
    return {
      status: HttpStatus.BAD_REQUEST,
      message: 'Invalid request',
      error: 'Bad Request',
    };
  }

  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    message: INTERNAL_ERROR_MESSAGE,
    error: 'Internal Server Error',
  };
};

const formatGenericError = (): ExceptionResponse => ({
  status: HttpStatus.INTERNAL_SERVER_ERROR,
  message: INTERNAL_ERROR_MESSAGE,
  error: 'Internal Server Error',
});

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const result = this.resolveException(exception);
    this.logException(exception, result);

    // Streaming responses (chat, images) may already be in flight; nothing more can be sent.
    if (response.headersSent) {
      response.end();
      return;
    }

    response.status(result.status).json({
      statusCode: result.status,
      error: result.error,
      message: result.message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private resolveException(exception: unknown): ExceptionResponse {
    if (exception instanceof HttpException) {
      return extractFromHttpException(exception);
    }

    if (isCircuitBreakerError(exception)) {
      return formatCircuitBreakerError();
    }

    if (isAxiosError(exception)) {
      return formatAxiosError(exception);
    }

    if (
      exception instanceof PrismaClientKnownRequestError ||
      exception instanceof PrismaClientValidationError
    ) {
      return formatPrismaError(exception);
    }

    return formatGenericError();
  }

  private logException(exception: unknown, result: ExceptionResponse): void {
    if (result.status >= 500) {
      // The full error (message, stack, Prisma details) is only ever logged.
      this.logger.error(
        { err: exception, status: result.status },
        exception instanceof Error ? exception.message : result.message,
      );
    } else {
      this.logger.warn({ status: result.status }, result.message);
    }
  }
}
