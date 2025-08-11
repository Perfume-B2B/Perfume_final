// Debug check voor DATABASE_URL in production
if (process.env.NODE_ENV === "production") {
  console.log("✅ DATABASE_URL in production:", process.env.DATABASE_URL ?? "⛔ NIET GEDEFINIEERD");
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Optimized for cPanel memory constraints
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Optimize for production
  compress: true,
  // Configure image domains for Supabase storage
  images: {
    domains: ['gosxpyyqspopthbsfdnv.supabase.co'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'gosxpyyqspopthbsfdnv.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  // Add security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;