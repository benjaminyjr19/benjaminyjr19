import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Linting runs in CI / editor tooling; keep builds deterministic.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
