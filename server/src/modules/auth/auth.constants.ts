/** DI token for the Better Auth instance. */
export const AUTH_INSTANCE = Symbol('AUTH_INSTANCE');

/** Metadata key set by `@Public()`. */
export const IS_PUBLIC_KEY = 'auth:isPublic';

/** Prefix of generated API keys, so leaked keys are easy to recognise (and scan for). */
export const API_KEY_PREFIX = 'mat_';

/** Header MCP clients and scripts send the API key in (`Authorization: Bearer mat_...` also works). */
export const API_KEY_HEADER = 'x-api-key';

export const SESSION_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 7;
export const SESSION_UPDATE_AGE_SECONDS = 60 * 60 * 24;
