import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Next.js 15 blocks cross-origin dev-server requests by default. When
   * testing from a phone over a LAN/hotspot (e.g. http://192.168.x.x:3000),
   * add that exact origin here or the browser will fail to load assets.
   * See: https://nextjs.org/docs/app/api-reference/config/next-config-js/allowedDevOrigins
   */
  allowedDevOrigins: [],
};

export default nextConfig;
