import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/embed',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: 'frame-ancestors https://gyomusystem.com https://*.gyomusystem.com;',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
