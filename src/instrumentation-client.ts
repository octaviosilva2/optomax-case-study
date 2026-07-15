import * as Sentry from '@sentry/nextjs'
import { sanitizeEvent } from '@/lib/sentry-sanitize'

/**
 * Inicialização do Sentry no cliente (browser).
 *
 * Carregado automaticamente pelo Next.js antes da hidratação. Pega erros
 * em Client Components, event handlers e qualquer JS rodando no browser.
 *
 * F2-A01: `beforeSend` mascara CPF/email/WhatsApp/UUID — mesma sanitização
 * usada no server (instrumentation.ts) pra garantir cobertura simétrica.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Sample rate de tracing — 100% durante validação.
  tracesSampleRate: 1.0,
  // Em dev, não envia pro Sentry (evita poluir o painel).
  enabled: process.env.NODE_ENV === 'production',
  // Replay desabilitado por padrão — economiza quota do plano Free.
  replaysOnErrorSampleRate: 0,
  replaysSessionSampleRate: 0,
  beforeSend: sanitizeEvent,
})

/**
 * Captura erros de navegação (Next.js App Router). Usado internamente
 * pelo Next.js — não chamar diretamente.
 */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
