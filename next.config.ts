import type { NextConfig } from "next"
import { withSentryConfig } from "@sentry/nextjs"

const nextConfig: NextConfig = {
  // Indicador de desenvolvimento do Next (o "N" flutuante) — desligado pra não
  // se sobrepor à navegação inferior no mobile. Só afeta o dev; em produção
  // esse overlay nunca aparece.
  devIndicators: false,
  // Garante que os .ttf das fontes (Fraunces/Inter) entrem no bundle serverless
  // das rotas de PDF. O react-pdf lê esses arquivos do filesystem via
  // process.cwd(); sem o tracing explícito, Font.register falha em produção
  // (Vercel) porque os arquivos não são copiados para a função.
  outputFileTracingIncludes: {
    '/api/prescricao/**': ['./src/lib/pdf/fonts/**'],
    '/api/ficha/**': ['./src/lib/pdf/fonts/**'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'uabqgeygrtnwyltqmfxw.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  // Headers de segurança aplicados a TODAS as rotas. Dados de saúde (LGPD
  // categoria sensível) — defesa contra clickjacking, sniffing e downgrade.
  async headers() {
    // CSP montada para NÃO quebrar o app atual:
    //  - script/style com 'unsafe-inline' porque o Next injeta scripts/estilos
    //    inline sem nonce nesta config. Próximo passo de hardening: migrar para
    //    nonce (middleware) e remover 'unsafe-inline' de script-src.
    //  - connect/img liberam o projeto Supabase (REST + Realtime wss + storage).
    //  - frame-ancestors 'none' é a trava anti-clickjacking robusta (substitui
    //    e reforça o X-Frame-Options abaixo, mantido para browsers antigos).
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      'upgrade-insecure-requests',
    ].join('; ')

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
        ],
      },
    ]
  },
}

// Wrapper do Sentry: instrumenta build pra subir source maps (quando
// SENTRY_AUTH_TOKEN estiver setado no Vercel) e configura tunnel pra
// burlar bloqueadores de ad/tracking.
export default withSentryConfig(nextConfig, {
  org: 'optomax',
  project: 'optomax-app',
  // Source maps só sobem se SENTRY_AUTH_TOKEN estiver configurado.
  // Sem token, o build não falha — apenas stack traces vão minificadas.
  silent: !process.env.CI,
  // Tunnel: rotas em /monitoring evitam ad blockers no client.
  tunnelRoute: '/monitoring',
})
