import type { Request } from 'express';

/** The signed-in user, as seen by controllers and services. */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export type AuthMethod = 'session' | 'api-key';

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
  authMethod?: AuthMethod;
}
