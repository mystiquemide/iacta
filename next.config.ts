import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  // The engine resolves runtime paths with import.meta.url; bundling it
  // breaks that, so it stays external and Node resolves it at runtime.
  serverExternalPackages: ["better-sqlite3", "@iacta/engine"],
};

export default nextConfig;
