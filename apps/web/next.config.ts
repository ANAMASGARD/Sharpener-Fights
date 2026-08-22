import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const pwaCacheVersion = process.env.VERCEL_GIT_COMMIT_SHA
  ?? process.env.NEXT_PUBLIC_PWA_CACHE_VERSION
  ?? "v0.1.0";

const nextConfig: NextConfig = {
  transpilePackages: ["@sharpener/game-core", "@sharpener/multiplayer-core", "@sharpener/protocol"],
  env: { NEXT_PUBLIC_PWA_CACHE_VERSION: pwaCacheVersion },
  turbopack: {},
  experimental: {
    // The managed build environment drops stdout from Next's detached tsc
    // process. The in-process TypeScript API performs the same validation
    // without relying on that child-process output.
    useTypeScriptCli: false,
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/invite/:path*",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
    ];
  },
};

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV !== "production",
  register: false,
  cacheOnNavigation: false,
  reloadOnOnline: false,
  maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
  manifestTransforms: [
    async (entries) => ({
      manifest: [
        ...entries,
        { url: "/", revision: null, size: 0 },
        { url: "/modes", revision: null, size: 0 },
        { url: "/play/local", revision: null, size: 0 },
      ],
      warnings: [],
    }),
  ],
});

export default withSerwist(nextConfig);
