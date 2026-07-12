/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  compress: true,
  swcMinify: true,
  productionBrowserSourceMaps: false,
  optimizeFonts: true,
  reactStrictMode: true,
  headers: async () => {
    return [
      {
        source: '/api/argos/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate'
          }
        ]
      }
    ];
  }
};

module.exports = nextConfig;
