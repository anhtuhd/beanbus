import type { NextConfig } from "next";

const productionHttps = process.env.NEXT_PUBLIC_APP_MODE === 'production'
  && process.env.NEXT_PUBLIC_SITE_URL?.startsWith('https://');
const developmentScriptPolicy = process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : '';

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  allowedDevOrigins: ['127.0.0.1'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy-Report-Only',
            value: `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; img-src 'self' data: blob: https:; script-src 'self' 'unsafe-inline'${developmentScriptPolicy} https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; connect-src 'self' https:; frame-src 'self' https://challenges.cloudflare.com https://www.google.com; font-src 'self' data: https:; worker-src 'self' blob:;`,
          },
          ...(productionHttps ? [{
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          }] : []),
        ],
      },
    ];
  },
};

export default nextConfig;
