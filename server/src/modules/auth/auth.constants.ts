/** DI token for the Better Auth instance. */
export const AUTH_INSTANCE = Symbol('AUTH_INSTANCE');

/** Metadata key set by `@Public()`. */
export const IS_PUBLIC_KEY = 'auth:isPublic';

/** Prefix of generated API keys, so leaked keys are easy to recognise (and scan for). */
export const API_KEY_PREFIX = 'mat_';

/** Header MCP clients and scripts send the API key in (`Authorization: Bearer mat_...` also works). */
export const API_KEY_HEADER = 'x-api-key';

/** Better Auth anonymous-plugin endpoint that opens a guest (demo) session. */
export const GUEST_SIGN_IN_PATH = '/sign-in/anonymous';
export const API_KEY_CREATE_PATH = '/api-key/create';
/** Placeholder email domain of guests (`.invalid` can never receive mail). */
export const GUEST_EMAIL_DOMAIN = 'guest.switchboard.invalid';

export const SESSION_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 7;
export const SESSION_UPDATE_AGE_SECONDS = 60 * 60 * 24;
