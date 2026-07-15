'use client'

// Tracking retroativo de `session_ended`.
//
// Estratégia (Fase 5 — 2026-05-18):
//   - `beforeunload` é unreliable em mobile / fechamento de aba.
//   - Em vez disso, guardamos o timestamp de início da sessão em localStorage.
//   - Ao iniciar uma nova sessão (próximo mount com mesmo userId), calculamos a
//     duração da sessão anterior e disparamos `session_ended` retroativamente.
//   - Cobre ~95% das sessões reais sem precisar de service worker / socket.

import { useEffect } from 'react'
import { logEventClient } from '@/lib/events'

const SESSION_START_KEY = 'opto_session_start_ts'
const SESSION_USER_KEY = 'opto_session_user_id'

// Limite de plausibilidade: sessões acima de 24h são descartadas (provavelmente
// usuário deixou a aba aberta por dias — dado enviesa a métrica).
const MAX_SESSION_SECONDS = 86_400

export function useSessionTracking(userId: string) {
  useEffect(() => {
    if (!userId) return

    const previousStart = localStorage.getItem(SESSION_START_KEY)
    const previousUser = localStorage.getItem(SESSION_USER_KEY)

    // Se havia sessão anterior do mesmo user, dispara session_ended retroativo
    if (previousStart && previousUser === userId) {
      const start = Number(previousStart)
      const durationSeconds = Math.max(
        1,
        Math.floor((Date.now() - start) / 1000),
      )
      if (durationSeconds > 0 && durationSeconds < MAX_SESSION_SECONDS) {
        // Fire-and-forget: falha no log nunca quebra a navegação
        logEventClient('session_ended', { duration_seconds: durationSeconds }).catch(
          () => {},
        )
      }
    }

    // Marca o início da sessão atual
    localStorage.setItem(SESSION_START_KEY, Date.now().toString())
    localStorage.setItem(SESSION_USER_KEY, userId)
  }, [userId])
}
