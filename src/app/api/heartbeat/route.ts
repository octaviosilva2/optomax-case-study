// Endpoint POST /api/heartbeat (Fase 6.5).
//
// Propósito: garantir que `profiles.last_seen_at` seja atualizado quando o
// usuário FECHA a aba (ou troca de aba), não só no próximo SSR render.
// Chamado pelo componente client `HeartbeatOnHide` via `navigator.sendBeacon`
// no evento `visibilitychange` → estado 'hidden'.
//
// Diferenças vs `touchLastSeen` em (app)/layout.tsx:
//   - SEM throttle: o gatilho é raro (aba escondida), não vale a pena economizar.
//     Custo: 1 UPDATE quando o tester sai do app.
//   - NÃO usa SERVICE_ROLE — basta o cliente normal de sessão (cookie + RLS).
//     Atualizar o próprio profile é permitido pela policy.
//   - NÃO toca first_seen_at: se chegou no heartbeat o usuário já passou pelo
//     (app)/layout.tsx pelo menos uma vez (a aba só fica hidden depois do load).
//
// Retorna sempre 204 (No Content) — `sendBeacon` ignora corpo de resposta,
// então não há nada útil a retornar.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { assertActiveOrg } from '@/lib/auth-guards'

export async function POST() {
  try {
    const supabase = await createClient()
    // F3-A03: heartbeat so atualiza last_seen_at para orgs com acesso.
    // Org suspensa/cancelada/inactive nao deve poluir "Online agora" no /admin.
    const ctx = await assertActiveOrg(supabase)
    if (!ctx.ok) return new NextResponse(null, { status: 204 })

    await supabase
      .from('profiles')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', ctx.userId)
  } catch (err) {
    // Fire-and-forget: nunca quebra. Cliente nem lê resposta.
    console.warn('[heartbeat] falhou:', err)
  }

  return new NextResponse(null, { status: 204 })
}
