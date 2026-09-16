import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { fromNodeHeaders } from 'better-auth/node';
import {
  AUTH_INSTANCE,
  API_KEY_HEADER,
  IS_PUBLIC_KEY,
} from '../auth.constants';
import { extractApiKey } from '../utils/api-key';
import type { Auth } from '../auth.instance';
import type { AuthenticatedRequest } from '../types/auth.types';

/**
 * Global guard: every route requires a signed-in user unless marked `@Public()`.
 * Accepts the session cookie (browser) or an API key (MCP clients, scripts);
 * both resolve to the same user through Better Auth's getSession.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(AUTH_INSTANCE) private readonly auth: Auth,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const headers = fromNodeHeaders(request.headers);
    const apiKey = extractApiKey(headers);
    if (apiKey) headers.set(API_KEY_HEADER, apiKey);

    let session: Awaited<ReturnType<Auth['api']['getSession']>> = null;
    try {
      session = await this.auth.api.getSession({ headers });
    } catch (error) {
      // Invalid, expired or disabled API keys are reported as errors, not as "no session".
      throw new UnauthorizedException(
        error instanceof Error ? error.message : 'Invalid credentials',
      );
    }

    if (!session) {
      throw new UnauthorizedException('Sign in required');
    }

    request.user = {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      isGuest: session.user.isAnonymous === true,
    };
    request.authMethod = apiKey ? 'api-key' : 'session';
    return true;
  }
}
