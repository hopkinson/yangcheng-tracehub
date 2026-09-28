import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "date-fns"],
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
