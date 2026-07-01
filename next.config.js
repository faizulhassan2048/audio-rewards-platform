/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
  reactStrictMode: true,
  compress: true,
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },
};

module.exports = nextConfig;