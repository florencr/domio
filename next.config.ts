import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfkit"],
  productionBrowserSourceMaps: false,
  experimental: {
    webpackMemoryOptimizations: true,
  },
  async redirects() {
    return [
      { source: "/dashboard/owner", destination: "/dashboard/resident", permanent: false },
      { source: "/dashboard/owner/:path*", destination: "/dashboard/resident/:path*", permanent: false },
      { source: "/dashboard/tenant/preferences", destination: "/dashboard/resident/preferences", permanent: false },
      { source: "/dashboard/tenant/account", destination: "/dashboard/resident/account", permanent: false },
      { source: "/dashboard/tenant", destination: "/dashboard/resident/billing", permanent: false },
    ];
  },
};

export default nextConfig;
