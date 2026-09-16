import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { anonymous } from 'better-auth/plugins';
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
} from 'better-auth/api';
import { apiKey } from '@better-auth/api-key';
import type { PrismaClient } from 'generated/prisma/client';
import type { AuthConfig } from '../../config/configuration.interface';
import type { GuestBlock } from '../demo/types/demo.types';
import { DEMO } from '../../shared/constants/app.constants';
import {
  API_KEY_CREATE_PATH,
  API_KEY_HEADER,
  API_KEY_PREFIX,
  GUEST_EMAIL_DOMAIN,
  GUEST_SIGN_IN_PATH,
  SESSION_EXPIRES_IN_SECONDS,
  SESSION_UPDATE_AGE_SECONDS,
} from './auth.constants';

export interface AuthHooks {
  onAccountCreated: (userId: string) => Promise<void>;
  /** Why a guest session can't open right now (demo off, daily cap reached), or null. */
  guestCreationBlock: () => Promise<GuestBlock | null>;
  /** Awaited before the guest's sign-in response, so the app opens with the demo data in place. */
  onGuestCreated: (userId: string) => Promise<void>;
}

const isGuest = (user: unknown): boolean =>
  (user as { isAnonymous?: boolean | null } | undefined)?.isAnonymous === true;

/**
 * Better Auth owns identity: sign-up, sign-in, password hashing, sessions and
 * API keys. It runs inside this API (mounted at /api/auth) so browsers and MCP
 * clients are authenticated by the same service.
 *
 * Sessions are rows in Postgres referenced by an httpOnly cookie. There are no
 * refresh tokens: revoking a session deletes the row, and active sessions are
 * extended (7 days, renewed at most once a day).
 *
 * Guests (the one-click demo) are Better Auth anonymous users: a real user row
 * with `isAnonymous`, no password, isolated like any account and deleted by the
 * demo sweep after DEMO_GUEST_TTL_HOURS.
 */
export function createAuth(
  prisma: PrismaClient,
  config: AuthConfig,
  hooks: AuthHooks,
) {
  return betterAuth({
    appName: 'Switchboard AI',
    baseURL: config.baseUrl,
    basePath: '/api/auth',
    secret: config.secret,
    trustedOrigins: config.trustedOrigins,
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      autoSignIn: true,
    },
    session: {
      expiresIn: SESSION_EXPIRES_IN_SECONDS,
      updateAge: SESSION_UPDATE_AGE_SECONDS,
    },
    rateLimit: {
      // Better Auth's limiter (on in production) caps how many guests one IP can open.
      customRules: {
        [GUEST_SIGN_IN_PATH]: {
          window: 60 * 60,
          max: DEMO.GUESTS_PER_IP_PER_HOUR,
        },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === GUEST_SIGN_IN_PATH) {
          const block = await hooks.guestCreationBlock();
          if (block)
            throw new APIError(block.status, { message: block.message });
        }
        if (ctx.path === API_KEY_CREATE_PATH) {
          // A key would let an MCP client act as a guest that is deleted within a day.
          const session = await getSessionFromCtx(ctx);
          if (isGuest(session?.user)) {
            throw new APIError('FORBIDDEN', {
              message:
                'Demo sessions cannot create API keys. Create an account to connect an MCP client.',
            });
          }
        }
      }),
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== GUEST_SIGN_IN_PATH) return;
        const guest = ctx.context.newSession?.user;
        if (guest) await hooks.onGuestCreated(guest.id);
      }),
    },
    databaseHooks: {
      account: {
        create: {
          after: async (account) => {
            await hooks.onAccountCreated(account.userId);
          },
        },
      },
    },
    plugins: [
      anonymous({
        emailDomainName: GUEST_EMAIL_DOMAIN,
        generateName: () => 'Guest',
        // Guests are removed by the demo sweep, which also deletes their image files.
        disableDeleteAnonymousUser: true,
      }),
      apiKey({
        defaultPrefix: API_KEY_PREFIX,
        apiKeyHeaders: API_KEY_HEADER,
        // Lets the same getSession() call authenticate cookies and API keys.
        enableSessionForAPIKeys: true,
        // Request limits are enforced per user by the API's throttler and the AI budget.
        rateLimit: { enabled: false },
      }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
