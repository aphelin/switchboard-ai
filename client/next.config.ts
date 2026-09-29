import type { NextConfig } from "next";

// Generated images are served by our own API (`/api/generations/:id/image`).
// They are rendered with `unoptimized` (see components/generated-image.tsx)
// because the optimizer refuses private/local upstream hosts; the pattern below
// allows optimization when the API is deployed on a public host.
const apiUrl = new URL(
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api",
);
const apiProtocol = apiUrl.protocol.replace(":", "") as "http" | "https";
const apiPathPrefix = apiUrl.pathname.replace(/\/$/, "");

/**
 * Security headers for every page. The CSP covers what can't break the app:
 * no framing (clickjacking on the key and budget dialogs), no plugins, no
 * <base> or form hijacking. Script sources aren't restricted, because Next's
 * inline bootstrap scripts would need per-request nonces.
 */
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The chat composer records voice input; nothing else needs device access.
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "gen.pollinations.ai",
      },
      {
        protocol: apiProtocol,
        hostname: apiUrl.hostname,
        ...(apiUrl.port ? { port: apiUrl.port } : {}),
        pathname: `${apiPathPrefix}/generations/**`,
      },
    ],
  },
};

export default nextConfig;
