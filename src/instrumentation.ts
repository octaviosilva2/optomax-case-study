import * as Sentry from '@sentry/nextjs'
import { sanitizeEvent } from '@/lib/sentry-sanitize'

/**
 * Inicialização do Sentry para os runtimes server-side do Next.js.
 *
 * Este arquivo é carregado automaticamente pelo Next.js (via convenção
 * `instrumentation.ts`) antes de qualquer Server Component / Server Action.
 * O `register()` é chamado uma vez no boot de cada runtime.
 *
 * F2-A01: `beforeSend` mascara CPF/email/WhatsApp/UUID e remove cookies
 * + email/IP do user antes do envio ao Sentry (operador internacional).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      // Sample rate: 100% pra fase de validação (10 testers, baixo volume).
      // Reduzir pra 0.1-0.2 quando escalar pra muitos usuários.
      tracesSampleRate: 1.0,
      // Em dev, não envia eventos pro Sentry — evita poluir o painel.
      enabled: process.env.NODE_ENV === 'production',
      beforeSend: sanitizeEvent,
    })
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 1.0,
      enabled: process.env.NODE_ENV === 'production',
      beforeSend: sanitizeEvent,
    })
  }
}

/**
 * Captura erros que escapam do React no servidor (Server Components,
 * Server Actions, route handlers). Usado pelo Next.js automaticamente.
 */
export const onRequestError = Sentry.captureRequestError
