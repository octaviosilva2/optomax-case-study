// F2-A01: sanitização de PII em eventos enviados ao Sentry.
//
// Sentry é operador internacional (Política de Privacidade §8). Sem
// `beforeSend`, qualquer Error não-tratada que mencionasse CPF, email,
// whatsapp ou UUID de paciente vazaria PII pro Sentry mesmo após mascarar
// no app. Defesa em profundidade: log fica seguro mesmo com regressão.
//
// Cobertura:
//   - event.user → reduz a `{ id }`, descarta email/username/ip
//   - event.request.cookies → sempre redacted (podem ter sessão)
//   - event.message → regex mask
//   - event.exception.values[].value → regex mask
//   - event.breadcrumbs[].message + .data (valores string) → regex mask
//
// Padrões mascarados:
//   - CPF: dddd.ddd.ddd-dd (ou sem pontuação)
//   - Email
//   - WhatsApp BR: (dd) ddddd-dddd e variantes
//   - UUID v4 (defesa: IDs são pseudoanônimos sob LGPD)

import type { ErrorEvent } from '@sentry/nextjs'

const CPF_RE = /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
const PHONE_RE = /\(?\d{2}\)?\s?\d{4,5}-?\d{4}/g
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi

function mascarar(texto: string | undefined): string | undefined {
  if (!texto) return texto
  return texto
    .replace(CPF_RE, '[CPF_MASKED]')
    .replace(EMAIL_RE, '[EMAIL_MASKED]')
    .replace(PHONE_RE, '[PHONE_MASKED]')
    .replace(UUID_RE, '[UUID_MASKED]')
}

/**
 * Hook `beforeSend` do Sentry. Recebe o evento prestes a ser enviado e
 * devolve o evento sanitizado. Retornar `null` descartaria o evento;
 * sempre devolvemos o evento (para preservar visibilidade de erros) só
 * que mascarado.
 */
export function sanitizeEvent(event: ErrorEvent): ErrorEvent | null {
  // Remove dados pessoais do user (mantém só ID — útil pra debug sem PII)
  if (event.user) {
    event.user = { id: event.user.id }
  }

  // Cookies podem conter sessão Supabase + dados auth — sempre redacted.
  // Cast porque a tipagem oficial espera Record<string, string> | undefined.
  if (event.request?.cookies) {
    event.request.cookies = '[REDACTED]' as unknown as Record<string, string>
  }

  // Mascara messages
  if (event.message) {
    event.message = mascarar(event.message) ?? event.message
  }

  // Mascara exception values
  if (event.exception?.values) {
    for (const ex of event.exception.values) {
      if (ex.value) ex.value = mascarar(ex.value) ?? ex.value
    }
  }

  // Mascara breadcrumbs (mensagens + valores string em data)
  if (event.breadcrumbs) {
    for (const bc of event.breadcrumbs) {
      if (bc.message) bc.message = mascarar(bc.message) ?? bc.message
      if (bc.data) {
        for (const k of Object.keys(bc.data)) {
          const v = bc.data[k]
          if (typeof v === 'string') {
            bc.data[k] = mascarar(v) ?? v
          }
        }
      }
    }
  }

  return event
}
