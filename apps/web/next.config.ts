import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@sharpener/game-core", "@sharpener/protocol"],
  experimental: {
    // The managed build environment drops stdout from Next's detached tsc
    // process. The in-process TypeScript API performs the same validation
    // without relying on that child-process output.
    useTypeScriptCli: false,
  },
};

export default nextConfig;
