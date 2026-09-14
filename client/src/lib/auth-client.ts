import { createAuthClient } from "better-auth/react";
import { apiKeyClient } from "@better-auth/api-key/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

/** Origin of the NestJS API (Better Auth is mounted there at /api/auth). */
export const API_ORIGIN = new URL(API_URL).origin;

/**
 * Better Auth client. The session lives in an httpOnly cookie set by the API,
 * so every API request from the browser must be sent with credentials.
 */
export const authClient = createAuthClient({
  baseURL: API_ORIGIN,
  plugins: [apiKeyClient()],
});

export type AuthSession = typeof authClient.$Infer.Session;
