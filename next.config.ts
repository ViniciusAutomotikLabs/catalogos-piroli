import type { NextConfig } from "next";

/**
 * Cabeçalhos de segurança (ERP 2.0).
 *
 * - HSTS: força HTTPS por 2 anos (inclui subdomínios e preload).
 * - X-Frame-Options + frame-ancestors: anti-clickjacking.
 * - X-Content-Type-Options: bloqueia MIME sniffing.
 * - Referrer-Policy / Permissions-Policy: minimiza vazamento e superfície.
 * - CSP: base restritiva. `connect-src` permite o Supabase; ajuste ao trocar de
 *   domínio no self-host. Câmera liberada (getUserMedia da captura de foto).
 *
 * Obs.: mantemos 'unsafe-inline'/'unsafe-eval' em scripts por ora (Next injeta
 * inline runtime); endurecer com nonce é um passo P1.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob:",
  "connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Content-Security-Policy", value: CSP },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Middleware no runtime Node.js (não-edge): o edge runtime falhava com o
  // Supabase SSR na Vercel (MIDDLEWARE_INVOCATION_FAILED). Ver PROJETO_HISTORICO.md § 12.
  // O flag funciona em runtime no 15.5.19, mas ainda não está tipado em ExperimentalConfig.
  experimental: {
    // @ts-expect-error nodeMiddleware é válido em runtime, mas ausente nos tipos do 15.5.19
    nodeMiddleware: true,
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
  // Next na Vercel: NFT não inclui @swc/helpers/esm → MIDDLEWARE_INVOCATION_FAILED
  // https://github.com/vercel/next.js/issues/93850
  outputFileTracingIncludes: {
    "*": ["./node_modules/@swc/helpers/esm/**"],
  },
};

export default nextConfig;
