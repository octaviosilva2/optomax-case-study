// Carregamento centralizado das métricas do painel /admin.
//
// Reúne em um único helper o que antes vivia dentro de /admin/page.tsx, agora
// reutilizado pelo Dashboard (/admin) e pela aba Usuários (/admin/usuarios):
//   1. Emails + created_at de auth.users (paginado via Auth Admin API).
//   2. Métricas agregadas por org/usuário via RPC `admin_user_metrics`
//      (SECURITY DEFINER, GRANT apenas a service_role).
//   3. plan + trial_ends_at lidos direto de `organizations` e mesclados por org —
//      mantém a RPC intacta (sem migration na função SECURITY DEFINER).

import { createAdminClient } from '@/lib/supabase/admin'
import { normalizePlan } from '@/lib/utils/status'

// Limiares do status de engajamento do usuário (baseado na última atividade).
const DIAS_VERDE = 3
const DIAS_AMARELO = 10
const PACIENTES_MIN_VERDE = 5

export type StatusEngajamento = 'engajado' | 'baixo_uso' | 'sem_uso'

/**
 * Status visual do usuário a partir da última atividade + nº de pacientes:
 *   🟢 engajado  → atividade ≤ 3d E ≥ 5 pacientes
 *   🟡 baixo_uso → atividade 4–10d OU < 5 pacientes
 *   🔴 sem_uso   → atividade > 10d OU nunca
 */
export function statusEngajamento(
  ultimaAtividadeIso: string | null,
  pacientes: number,
): StatusEngajamento {
  if (!ultimaAtividadeIso) return 'sem_uso'
  const diasDesdeAtividade =
    (Date.now() - new Date(ultimaAtividadeIso).getTime()) / (1000 * 60 * 60 * 24)
  if (diasDesdeAtividade > DIAS_AMARELO) return 'sem_uso'
  if (diasDesdeAtividade <= DIAS_VERDE && pacientes >= PACIENTES_MIN_VERDE) return 'engajado'
  return 'baixo_uso'
}

// Linha consolidada por usuário/org — consumida pelas telas do admin.
export type AdminMetricRow = {
  userId: string
  orgId: string
  orgNome: string
  // String livre vinda do banco (plan_status) — comparar via orgPodeAcessar.
  orgStatus: string
  // Plano da org já normalizado ('admin' | 'free' | 'pago'). O legado beta/base
  // é traduzido por normalizePlan na montagem da linha.
  plan: string
  nomeCompleto: string
  email: string
  // Última atividade = last_seen_at, fallback profile_created_at (legado).
  ultimaAtividade: string | null
  // Signup (auth.users.created_at) e 1º acesso ao app (profiles.first_seen_at).
  authCreatedAt: string | null
  firstSeenAt: string | null
  // Fim do período de teste (organizations.trial_ends_at).
  trialEndsAt: string | null
  pacientes: number
  fichasCompletas: number
  pdfsGerados: number
  fichasAbandonadas: number
  status: StatusEngajamento
}

/**
 * Carrega todas as linhas de métrica do painel admin, já mescladas e ordenadas.
 * Lança erro se a RPC de métricas falhar (o caller decide como exibir).
 */
export async function loadAdminMetrics(): Promise<AdminMetricRow[]> {
  const supabase = createAdminClient()

  // ---- 1. Emails + created_at dos auth.users (paginado) ----
  // listUsers tem teto por página; iteramos até a última vir incompleta.
  const emailById = new Map<string, string>()
  const authCreatedById = new Map<string, string>()
  const PER_PAGE = 200
  for (let page = 1; page <= 50; page++) {
    const { data: authPage } = await supabase.auth.admin.listUsers({ page, perPage: PER_PAGE })
    const users = authPage?.users ?? []
    for (const u of users) {
      if (u.email) emailById.set(u.id, u.email)
      if (u.created_at) authCreatedById.set(u.id, u.created_at)
    }
    if (users.length < PER_PAGE) break
  }

  // ---- 2. Métricas agregadas via RPC (1 query) ----
  const { data: metricsRows, error: metricsErr } = await supabase.rpc('admin_user_metrics')
  if (metricsErr) {
    throw new Error(`admin_user_metrics falhou: ${metricsErr.message}`)
  }

  // ---- 3. plan + trial_ends_at direto de organizations (merge por org_id) ----
  const planByOrg = new Map<string, { plan: string; trialEndsAt: string | null }>()
  const { data: orgs } = await supabase
    .from('organizations')
    .select('id, plan, trial_ends_at')
  for (const o of orgs ?? []) {
    // Normaliza o legado (beta→free, base→pago) já na origem.
    planByOrg.set(o.id, { plan: normalizePlan(o.plan), trialEndsAt: o.trial_ends_at })
  }

  const linhas: AdminMetricRow[] = (metricsRows ?? []).map((r) => {
    const ultimaAtividade = r.last_seen_at ?? r.profile_created_at ?? null
    const pacientes = r.pacientes_ativos ?? 0
    const orgPlan = planByOrg.get(r.org_id)
    return {
      userId: r.user_id,
      orgId: r.org_id,
      orgNome: r.org_nome ?? '—',
      orgStatus: r.org_status ?? 'trialing',
      plan: orgPlan?.plan ?? 'free',
      nomeCompleto: r.nome_completo ?? '—',
      email: emailById.get(r.user_id) ?? '—',
      ultimaAtividade,
      authCreatedAt: authCreatedById.get(r.user_id) ?? null,
      firstSeenAt: r.first_seen_at ?? null,
      trialEndsAt: orgPlan?.trialEndsAt ?? null,
      pacientes,
      fichasCompletas: r.fichas_finalizadas ?? 0,
      pdfsGerados: r.pdfs_gerados ?? 0,
      fichasAbandonadas: r.fichas_abandonadas ?? 0,
      status: statusEngajamento(ultimaAtividade, pacientes),
    }
  })

  return linhas
}
