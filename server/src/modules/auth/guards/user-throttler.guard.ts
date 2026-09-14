import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { AuthenticatedRequest } from '../types/auth.types';

/**
 * Rate limits per user instead of per IP once a user is known: users behind the
 * same NAT don't share a limit, and one user can't dodge it by switching IPs.
 * Runs after AuthGuard (registered after it), so `request.user` is populated.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected override getTracker(request: Record<string, any>): Promise<string> {
    const user = (request as AuthenticatedRequest).user;
    return Promise.resolve(user ? `user:${user.id}` : String(request.ip));
  }
}
