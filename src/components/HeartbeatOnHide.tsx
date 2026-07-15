'use client'

// Fase 6.5 — Heartbeat fora-de-banda para atualizar `last_seen_at` na
// hora em que o tester fecha/esconde a aba.
//
// Sem isso, "Última atividade" no /admin fica defasada até ~60s (throttle do
// touchLastSeen no SSR) ou pior, fica congelada no último SSR render.
//
// Por que `navigator.sendBeacon` em vez de `fetch`:
//   - sendBeacon é projetado pra disparar no unload/hidden — o browser
//     garante entrega mesmo se a página fechar logo em seguida.
//   - fetch normal é cancelado quando a aba é destruída.
//
// Por que `visibilitychange` em vez de `beforeunload`:
//   - beforeunload não dispara em fechar aba em mobile, nem em troca de aba.
//   - visibilitychange dispara em todos esses casos.

import { useEffect } from 'react'

export function HeartbeatOnHide() {
  useEffect(() => {
    function ping() {
      if (document.visibilityState === 'hidden') {
        // POST vazio — o endpoint só usa o cookie de sessão pra identificar o user.
        navigator.sendBeacon('/api/heartbeat')
      }
    }
    document.addEventListener('visibilitychange', ping)
    return () => document.removeEventListener('visibilitychange', ping)
  }, [])

  return null
}
