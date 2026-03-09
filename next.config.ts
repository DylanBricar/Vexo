import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@neondatabase/serverless"],
  allowedDevOrigins: ["http://10.77.10.20:3000", "http://172.22.16.1:3000"],
};

export default nextConfig;
