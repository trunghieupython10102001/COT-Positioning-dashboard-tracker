import type { NextConfig } from "next";

// Set ONLY in the Vercel project (e.g. http://ec2-...:8081) so Vercel proxies
// every route to the EC2 origin. Unset on EC2, so the app serves normally there
// (no self-proxy loop). beforeFiles runs ahead of the filesystem, so it overrides
// the app's own pages — unlike vercel.json rewrites, which run after routes.
const proxyOrigin = process.env.PROXY_ORIGIN;

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: ["yahoo-finance2"],
  async rewrites() {
    if (!proxyOrigin) return [];
    return {
      beforeFiles: [{ source: "/:path*", destination: `${proxyOrigin}/:path*` }],
    };
  },
};

export default nextConfig;
