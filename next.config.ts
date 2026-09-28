import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "date-fns"],
    serverActions: {
      bodySizeLimit: "10mb",
      allowedOrigins: [
        "admin.yangchenghu88.com",
        "admin-test.yangchenghu88.com",
        "yangcheng.traview.cn",
        "localhost:3000",
        "127.0.0.1:3000",
      ],
    },
  },
};

export default nextConfig;
