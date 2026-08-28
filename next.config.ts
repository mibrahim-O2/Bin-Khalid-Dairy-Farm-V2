import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Next.js 15 blocks cross-origin dev-server requests by default. When
   * testing from a phone over a LAN/hotspot (e.g. http://192.168.x.x:3000),
   * add that exact origin here or the browser will fail to load assets.
   * See: https://nextjs.org/docs/app/api-reference/config/next-config-js/allowedDevOrigins
   */
  allowedDevOrigins: [],
  images: {
    // github.com/<user>.png redirects to avatars.githubusercontent.com —
    // allow both so next/image can optimize the developer-credit avatar.
    remotePatterns: [
      { protocol: "https", hostname: "github.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
};

export default nextConfig;
