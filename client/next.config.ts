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

const nextConfig: NextConfig = {
  output: "standalone",
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
  reactStrictMode: false,
};

export default nextConfig;
