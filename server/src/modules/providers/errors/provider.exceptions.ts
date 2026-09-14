import { HttpException, HttpStatus } from '@nestjs/common';

const badRequest = (error: string, message: string) => ({
  statusCode: HttpStatus.BAD_REQUEST,
  error,
  message,
});

/** The request named a model that is not in the catalog (or not offered on this server). */
export class UnknownModelException extends HttpException {
  constructor(modelId: string) {
    super(
      badRequest(
        'Unknown Model',
        `Model "${modelId.slice(0, 120)}" is not available. Pick one from GET /api/providers.`,
      ),
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class UnsupportedModelException extends HttpException {
  constructor(modelLabel: string, capability: string) {
    super(
      badRequest(
        'Unsupported Model',
        `${modelLabel} does not support ${capability}, which this feature needs.`,
      ),
      HttpStatus.BAD_REQUEST,
    );
  }
}

/** The model runs on the user's own key, and they have not added one for that provider. */
export class ProviderKeyRequiredException extends HttpException {
  constructor(providerLabel: string, modelLabel: string) {
    super(
      badRequest(
        'Provider Key Required',
        `Add your ${providerLabel} API key under AI providers to use ${modelLabel}.`,
      ),
      HttpStatus.BAD_REQUEST,
    );
  }
}

/** The provider refused the key during verification; nothing was stored. */
export class InvalidProviderKeyException extends HttpException {
  constructor(message: string) {
    super(badRequest('Invalid Provider Key', message), HttpStatus.BAD_REQUEST);
  }
}
