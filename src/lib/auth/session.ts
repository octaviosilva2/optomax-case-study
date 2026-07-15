import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Sessão completa do usuário logado (auth + profile + organization).
 *
 * Combina 3 round-trips ao Supabase em apenas 2:
 *  - 1× auth.getUser() (Auth API, inevitável)
 *  - 1× SELECT profiles JOIN organizations (FK org_id)
 *
 * Envolto em React.cache() — quando layout e page chamam na MESMA request
 * HTTP (toda navegação), só uma execução real acontece. Sem isso, cada
 * page filha repetia auth+profiles após o layout já ter feito tudo.
 *
 * Retorna null se não autenticado/sem profile.
 */
export const getSessionData = cache(async () => {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // REFATORADO: intervalo_consulta removido do select (nao mais usado)
  const { data: profile } = await supabase
    .from('profiles')
    .select(`
      id,
      org_id,
      nome_completo,
      onboarded,
      cro_cboo,
      formacoes,
      signature_url,
      created_at,
      organizations (
        id,
        nome_clinica,
        plan,
        plan_status,
        endereco,
        telefone,
        horario_funcionamento,
        trial_ends_at,
        deletion_requested_at,
        deletion_scheduled_for
      )
    `)
    .eq('id', user.id)
    .single()

  if (!profile) return null

  // O typegen do Supabase pode tipar a relação como array — normaliza.
  const org = (Array.isArray(profile.organizations)
    ? profile.organizations[0]
    : profile.organizations) ?? null

  return { user, profile, org }
})

/**
 * Versão "exigente": redireciona pra /login se não houver sessão.
 * Use em todas as pages dentro de (app) — o layout já garante auth,
 * mas chamar aqui é barato (cache hit) e elimina null-checks repetidos.
 */
export const requireSession = cache(async () => {
  const session = await getSessionData()
  if (!session) redirect('/login')
  return session
})

/**
 * Marca presença do usuário em `profiles.last_seen_at` (Fase 5) +
 * `profiles.first_seen_at` no primeiro toque (Fase 6.5).
 *
 * - Usado pelo painel /admin como "Última atividade" + badge "Online agora"
 *   (substitui a métrica anterior baseada em `session_started`, que só
 *   atualizava no login efetivo).
 * - Chamado em `(app)/layout.tsx` — cobre toda request autenticada.
 * - Throttle de 60s direto no WHERE do UPDATE 1: o UPDATE só efetiva
 *   1x/minuto/user, mesmo navegando rápido. Custo ~10ms por request (uma
 *   UPDATE rápida com índice na PK).
 * - UPDATE 2 seta `first_seen_at` apenas se ainda NULL (`.is('first_seen_at', null)`)
 *   — idempotente: do segundo touch em diante o WHERE não casa e o UPDATE é no-op.
 *   Esse campo alimenta a coluna "Uso real" no /admin (dias desde o primeiro acesso).
 * - Usa SERVICE_ROLE pra contornar RLS — atualizar campo do próprio profile
 *   funciona via policy normal, mas mantemos admin client por consistência
 *   com outras métricas server-side e pra evitar dependência da RLS.
 * - Fire-and-forget: qualquer erro é engolido silenciosamente, render
 *   nunca quebra por causa de tracking.
 */
export async function touchLastSeen(userId: string): Promise<void> {
  try {
    const supabase = createAdminClient()
    const now = new Date().toISOString()
    const cutoff = new Date(Date.now() - 60_000).toISOString()

    // Update 1: last_seen_at com throttle de 60s (Fase 5).
    await supabase
      .from('profiles')
      .update({ last_seen_at: now })
      .eq('id', userId)
      .or(`last_seen_at.is.null,last_seen_at.lt.${cutoff}`)

    // Update 2: first_seen_at apenas no primeiro touch (idempotente).
    // `.is('first_seen_at', null)` garante que do 2º touch em diante o
    // WHERE não casa nada — UPDATE vira no-op, sem race condition.
    await supabase
      .from('profiles')
      .update({ first_seen_at: now })
      .eq('id', userId)
      .is('first_seen_at', null)
  } catch (err) {
    console.warn('[touchLastSeen] falhou:', err)
  }
}
