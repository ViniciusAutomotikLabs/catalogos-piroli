import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Middleware no runtime Node.js (não-edge): o edge runtime falhava com o
  // Supabase SSR na Vercel (MIDDLEWARE_INVOCATION_FAILED). Ver PROJETO_HISTORICO.md § 12.
  // O flag funciona em runtime no 15.5.19, mas ainda não está tipado em ExperimentalConfig.
  experimental: {
    // @ts-expect-error nodeMiddleware é válido em runtime, mas ausente nos tipos do 15.5.19
    nodeMiddleware: true,
  },
  // Next na Vercel: NFT não inclui @swc/helpers/esm → MIDDLEWARE_INVOCATION_FAILED
  // https://github.com/vercel/next.js/issues/93850
  outputFileTracingIncludes: {
    "*": ["./node_modules/@swc/helpers/esm/**"],
  },
};

export default nextConfig;
