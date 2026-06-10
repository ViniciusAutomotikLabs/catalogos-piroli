import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next 16.2.x na Vercel: NFT não inclui @swc/helpers/esm → MIDDLEWARE_INVOCATION_FAILED
  // https://github.com/vercel/next.js/issues/93850
  outputFileTracingIncludes: {
    "*": ["./node_modules/@swc/helpers/esm/**"],
  },
};

export default nextConfig;
