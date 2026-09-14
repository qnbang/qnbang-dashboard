import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [{ source: '/', destination: '/operating', permanent: true }];
  },
};

export default nextConfig;
