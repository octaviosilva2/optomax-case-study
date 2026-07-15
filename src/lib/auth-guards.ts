// Guards reutilizáveis para autenticação + autorização em rotas server-side.
// Centraliza a "validação em camadas" (auth → profile → org_status) que
// antes ficava duplicada em cada API route e server action.

import type { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { orgPodeAcessar, orgPodeLer } from '@/lib/utils/status'
import { getSessionData } from '@/lib/auth/session'

type SuccessContext = {
  ok: true
  userId: string
  orgId: string
}

type FailureContext = {
  ok: false
  // Mensagem amigável e código HTTP recomendado para a resposta.
  status: 401 | 403
  message: string
}

/**
 * Resolve o contexto autenticado de uma request:
 * 1. Confirma sessão (auth.getUser)
 * 2. Lê profile + org_id
 * 3. Valida que a organização está ativa (plan_status='active'/'trialing'/'past_due')
 *
 * Internamente delega para `getSessionData()` (envolto em `React.cache`),
 * de forma que server actions e route handlers chamados na mesma request
 * que o layout `(app)` reaproveitam o resultado — economiza 2 round-trips
 * Supabase por action (auth.getUser + JOIN profiles/organizations).
 *
 * O parâmetro `_supabase` é mantido para retrocompatibilidade com os
 * call-sites existentes; não é utilizado internamente. Caso, no futuro,
 * `assertActiveOrg` precise rodar fora de contexto Next request (cron,
 * worker, queue), o parâmetro pode servir de fallback.
 *
 * Retorna `{ ok: true, userId, orgId }` em sucesso ou `{ ok: false, status, message }`.
 */
export async function assertActiveOrg(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _supabase: SupabaseClient<Database>,
): Promise<SuccessContext | FailureContext> {
  const session = await getSessionData()

  if (!session) {
    return { ok: false, status: 401, message: 'Não autenticado' }
  }

  if (!session.org || !orgPodeAcessar(session.org.plan_status)) {
    return {
      ok: false,
      status: 403,
      message: 'Acesso suspenso. Contate a administração.',
    }
  }

  return {
    ok: true,
    userId: session.user.id,
    orgId: session.profile.org_id,
  }
}

/**
 * Variante de `assertActiveOrg` para rotas de LEITURA/EXPORT no modo read-only
 * (paywall Fase 2). Diferença única: valida com `orgPodeLer` em vez de
 * `orgPodeAcessar`, de forma que uma org `expired` (trial cortado) ainda
 * consegue ler e exportar os próprios dados (LGPD), mas continua barrada nas
 * mutações (que seguem usando `assertActiveOrg`).
 *
 * Use SOMENTE em GET/export. Para qualquer mutação, continue com `assertActiveOrg`.
 */
export async function assertReadableOrg(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _supabase: SupabaseClient<Database>,
): Promise<SuccessContext | FailureContext> {
  const session = await getSessionData()

  if (!session) {
    return { ok: false, status: 401, message: 'Não autenticado' }
  }

  if (!session.org || !orgPodeLer(session.org.plan_status)) {
    return {
      ok: false,
      status: 403,
      message: 'Acesso suspenso. Contate a administração.',
    }
  }

  return {
    ok: true,
    userId: session.user.id,
    orgId: session.profile.org_id,
  }
}

/**
 * Helper para route handlers: converte FailureContext em NextResponse.
 * Reduz boilerplate em cada handler.
 */
export function unauthorizedResponse(
  ctx: FailureContext,
  NextResponseCtor: typeof NextResponse,
): NextResponse {
  return new NextResponseCtor(ctx.message, { status: ctx.status })
}
