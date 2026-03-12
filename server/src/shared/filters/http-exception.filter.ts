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

const extractFromHttpException = (exception: HttpException): ExceptionResponse => {
  const status = exception.getStatus();
  const exceptionResponse = exception.getResponse();
  let message = 'Internal server error';
  let error = 'Internal Server Error';

  if (typeof exceptionResponse === 'string') {
    message = exceptionResponse;
  } else if (typeof exceptionResponse === 'object') {
    const res = exceptionResponse as Record<string, unknown>;
    message = (res.message as string) || message;
    error = (res.error as string) || error;
  }

  return { status, message, error };
};

const formatCircuitBreakerError = (): ExceptionResponse => ({
  status: HttpStatus.SERVICE_UNAVAILABLE,
  message: 'Service temporarily unavailable',
  error: 'Service Unavailable',
});

const formatAxiosError = (error: AxiosError): ExceptionResponse => {
  const status = error.response?.status ?? HttpStatus.BAD_GATEWAY;
  const message =
    (error.response?.data as { message?: string })?.message ??
    error.message ??
    'External request failed';
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

const formatPrismaError = (error: Error): ExceptionResponse => {
  if (error instanceof PrismaClientKnownRequestError) {
    return {
      status: mapPrismaCodeToStatus(error.code),
      message: error.message,
      error: 'Database Error',
    };
  }

  if (error instanceof PrismaClientValidationError) {
    return {
      status: HttpStatus.BAD_REQUEST,
      message: error.message,
      error: 'Validation Error',
    };
  }

  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    message: error.message,
    error: 'Database Error',
  };
};

const formatGenericError = (error: unknown): ExceptionResponse => ({
  status: HttpStatus.INTERNAL_SERVER_ERROR,
  message: error instanceof Error ? error.message : 'Internal server error',
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

    return formatGenericError(exception);
  }

  private logException(exception: unknown, result: ExceptionResponse): void {
    if (result.status >= 500) {
      this.logger.error({ err: exception, status: result.status }, result.message);
    } else {
      this.logger.warn({ status: result.status }, result.message);
    }
  }
}
