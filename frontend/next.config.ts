import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Enable standalone output for Docker deployment
  output: "standalone",
};

export default nextConfig;
