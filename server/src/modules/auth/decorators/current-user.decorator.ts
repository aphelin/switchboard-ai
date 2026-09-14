import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthenticatedRequest, AuthUser } from '../types/auth.types';

/**
 * Injects the user resolved by `AuthGuard`. Services receive the id from here,
 * never from request bodies or model tool arguments.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) {
      throw new UnauthorizedException('Sign in required');
    }
    return request.user;
  },
);
