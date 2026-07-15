'use client'

// Wrapper client mínimo para acionar o hook useSessionTracking dentro do
// (app)/layout.tsx — server component não pode chamar hooks diretamente.
//
// Não renderiza nada (retorna null). Único trabalho é disparar o tracking
// retroativo de `session_ended` ao montar com o userId resolvido.

import { useSessionTracking } from '@/hooks/useSessionTracking'

export function SessionTracker({ userId }: { userId: string }) {
  useSessionTracking(userId)
  return null
}
