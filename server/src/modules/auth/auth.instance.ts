import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { apiKey } from '@better-auth/api-key';
import type { PrismaClient } from 'generated/prisma/client';
import type { AuthConfig } from '../../config/configuration.interface';
import {
  API_KEY_HEADER,
  API_KEY_PREFIX,
  SESSION_EXPIRES_IN_SECONDS,
  SESSION_UPDATE_AGE_SECONDS,
} from './auth.constants';

export interface AuthHooks {
  onAccountCreated: (userId: string) => Promise<void>;
}

/**
 * Better Auth owns identity: sign-up, sign-in, password hashing, sessions and
 * API keys. It runs inside this API (mounted at /api/auth) so browsers and MCP
 * clients are authenticated by the same service.
 *
 * Sessions are rows in Postgres referenced by an httpOnly cookie. There are no
 * refresh tokens: revoking a session deletes the row, and active sessions are
 * extended (7 days, renewed at most once a day).
 */
export function createAuth(
  prisma: PrismaClient,
  config: AuthConfig,
  hooks: AuthHooks,
) {
  return betterAuth({
    appName: 'Mini AI Toolkit',
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
