import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const gatewayUrl = process.env.GATEWAY_INTERNAL_URL ?? 'http://localhost:3001';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(dirname, '../..'),
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${gatewayUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
