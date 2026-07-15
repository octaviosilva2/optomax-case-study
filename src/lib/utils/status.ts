// ── Status da organização (plan_status) ─────────────────────────────────────
// Status produzidos pelo Supabase + roadmap de billing futuro.
// CHECK constraint `organizations_plan_status_check` (Fase 11.2 / F6-A04)
// impõe os valores aqui declarados no banco.

/**
 * Conjunto canônico (superset) de plan_status aceitos pelo sistema.
 * Source of truth única — banco, código admin e código de billing
 * devem importar daqui (jamais inline).
 */
export const PLAN_STATUSES = [
  'trialing',
  'active',
  'past_due',
  'inactive',
  'suspended',
  'cancelled',
  'expired',
] as const

export type PlanStatus = (typeof PLAN_STATUSES)[number]

/**
 * Status em que a organização tem acesso ao app:
 *   - 'trialing' → conta nova ainda em período de teste (default na criação)
 *   - 'active'   → assinatura paga ativa
 *   - 'past_due' → fatura atrasada mas ainda em período de tolerância
 *
 * Status que bloqueiam acesso (em ORG_STATUS_SEM_ACESSO):
 *   - 'inactive', 'suspended', 'cancelled', 'expired'
 */
export const ORG_STATUS_COM_ACESSO: readonly PlanStatus[] = [
  'trialing',
  'active',
  'past_due',
] as const

/**
 * Status que bloqueiam acesso ao app — usado pelo /admin para escolher
 * em qual estado "suspender" uma org. A UX padrão do toggle usa
 * 'active' ↔ 'inactive', mas a action aceita qualquer valor do superset
 * (PLAN_STATUSES) para suportar cenários futuros de billing.
 */
export const ORG_STATUS_SEM_ACESSO: readonly PlanStatus[] = [
  'inactive',
  'suspended',
  'cancelled',
  'expired',
] as const

export function orgPodeAcessar(planStatus: string | null | undefined): boolean {
  if (!planStatus) return false
  return (ORG_STATUS_COM_ACESSO as readonly string[]).includes(planStatus)
}

/**
 * Status em que a organização pode LER e EXPORTAR os próprios dados, mesmo sem
 * poder mutar (3º modo de acesso — paywall Fase 2):
 *   - todos de ORG_STATUS_COM_ACESSO (acesso pleno) +
 *   - 'expired' → trial vencido e cortado pelo paywall: leitura/export liberados
 *     (LGPD), mas mutação barrada (orgPodeAcessar continua false).
 *
 * NÃO inclui 'inactive'/'suspended'/'cancelled' — ali há intenção de
 * desativar/apagar dados, então o acesso é bloqueado por completo.
 */
export const ORG_STATUS_PODE_LER: readonly PlanStatus[] = [
  ...ORG_STATUS_COM_ACESSO,
  'expired',
] as const

export function orgPodeLer(planStatus: string | null | undefined): boolean {
  if (!planStatus) return false
  return (ORG_STATUS_PODE_LER as readonly string[]).includes(planStatus)
}

/**
 * True quando a org está em modo read-only (paywall): pode ler/exportar mas
 * não mutar. Hoje só o estado 'expired' satisfaz isso (pode ler, não pode acessar).
 */
export function orgEhReadOnly(planStatus: string | null | undefined): boolean {
  return orgPodeLer(planStatus) && !orgPodeAcessar(planStatus)
}

// ── Plano da organização (plan) ─────────────────────────────────────────────
// Modelo revisado (decisão Octavio, 26/06/2026 — Fase 5):
//   - 'admin' → INTERNO (só o fundador). Acesso ilimitado, sem prazo. Não vendável.
//   - 'free'  → gratuito, em DOIS modos controlados por trial_ends_at:
//                 • cortesia permanente → trial_ends_at = NULL (nunca cobra/expira);
//                 • grátis por prazo    → trial_ends_at definido (todo signup nasce
//                   aqui, trial padrão); ao expirar, o paywall corta (plan_status
//                   = 'expired') e a org passa a precisar pagar.
//   - 'pago'  → assinatura mensal ativa (R$ 59,97). Setado quando um pagamento é
//               confirmado (webhook). O acesso é regido por plan_status.
//
// LEGADO: até a migration de rename rodar em produção, o banco ainda guarda os
// valores antigos 'beta' (→ free) e 'base' (→ pago). `normalizePlan` traduz na
// borda de leitura para o código novo funcionar antes e depois da migration.
// CHECK constraint `organizations_plan_check` impõe os valores no banco.
export const PLANS = ['admin', 'free', 'pago'] as const

export type Plan = (typeof PLANS)[number]

// Rótulos para exibição na UI do admin.
export const PLAN_LABELS: Record<Plan, string> = {
  admin: 'Admin (interno)',
  free: 'Free (grátis/cortesia)',
  pago: 'Pago (assinatura)',
}

// Mapa de valores legados → canônicos. Source of truth do rename beta→free,
// base→pago, usado tanto por normalizePlan quanto pela migration.
const LEGACY_PLAN_MAP: Record<string, Plan> = {
  beta: 'free',
  base: 'pago',
}

/**
 * Normaliza um valor cru de `plan` (possivelmente legado) para o canônico atual.
 * Desconhecido → 'free' (modo gratuito, o estado mais conservador: não concede
 * acesso ilimitado nem trata como pagante).
 */
export function normalizePlan(plan: string | null | undefined): Plan {
  if (!plan) return 'free'
  if ((PLANS as readonly string[]).includes(plan)) return plan as Plan
  return LEGACY_PLAN_MAP[plan] ?? 'free'
}

/** True quando o plano não tem prazo de expiração (acesso permanente) — só admin. */
export function planoEhIlimitado(plan: string | null | undefined): boolean {
  return normalizePlan(plan) === 'admin'
}

/** True quando a org é uma assinante paga (plano 'pago'). */
export function planoEhPago(plan: string | null | undefined): boolean {
  return normalizePlan(plan) === 'pago'
}

/** True quando a org está no plano gratuito ('free' — trial ou cortesia). */
export function planoEhFree(plan: string | null | undefined): boolean {
  return normalizePlan(plan) === 'free'
}

/**
 * True quando a org é uma cortesia: plano 'free' SEM prazo de trial
 * (trial_ends_at nulo). Distingue "cortesia permanente" de "trial por prazo".
 */
export function planoEhCortesia(
  plan: string | null | undefined,
  trialEndsAt: string | null | undefined,
): boolean {
  return planoEhFree(plan) && !trialEndsAt
}

/**
 * Dias restantes do trial, arredondado pra cima.
 *   - Retorna null para plano ilimitado (admin) ou quando não há trial_ends_at.
 *   - Valor <= 0 significa trial expirado.
 */
export function diasRestantesTrial(
  trialEndsAt: string | null | undefined,
  plan?: string | null,
): number | null {
  if (planoEhIlimitado(plan)) return null
  if (!trialEndsAt) return null
  return Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

// ── Status de agendamento ───────────────────────────────────────────────────
// Utilitários de status de agendamento — fonte única de verdade.
// Toda outra parte do código (hooks, actions, grades) deve importar daqui.
// CHECK constraint `appointments_status_check` (Fase 11.2 / F6-A02) impõe
// no banco. Legado 'atendido' foi normalizado para 'concluido' na migration.

/**
 * Conjunto canônico de status de appointment.
 * 'atendido' (legacy) e 'finalizado' (que nunca foi de appointment — era
 * confusão com clinical_records.status) foram removidos na Fase 11.2.
 */
export const APPOINTMENT_STATUSES = [
  'agendado',
  'confirmado',
  'em_andamento',
  'concluido',
  'cancelado',
  'faltou',
] as const

export type StatusAgendamento = (typeof APPOINTMENT_STATUSES)[number]

/**
 * Máquina de estados: transições válidas a partir de cada status.
 * 'concluido' e 'cancelado' são terminais (nenhuma transição saindo deles).
 * 'faltou' permite reagendar (volta a 'agendado').
 *
 * 'concluido' é destino direto a partir de 'agendado' e 'confirmado' porque
 * as grades (AgendaHoje, GradeSemanal, GradeDiaria) têm botão "Registrar
 * atendimento" que pula a etapa 'em_andamento' (decisão UX da Fase 9).
 */
const APPOINTMENT_TRANSITIONS: Record<StatusAgendamento, StatusAgendamento[]> = {
  agendado: ['confirmado', 'em_andamento', 'concluido', 'cancelado', 'faltou'],
  confirmado: ['em_andamento', 'concluido', 'cancelado', 'faltou'],
  em_andamento: ['concluido', 'cancelado'],
  concluido: [], // terminal
  cancelado: [], // terminal
  faltou: ['agendado'], // permite reagendar
}

/**
 * Retorna true se a transição de `de` para `para` é permitida.
 * Usado pelas server actions de agenda/atendimento para impedir mudanças
 * inválidas (cancelado → agendado, concluido → cancelado etc.).
 */
export function podeTransicionarAppointment(
  de: StatusAgendamento,
  para: StatusAgendamento,
): boolean {
  return APPOINTMENT_TRANSITIONS[de]?.includes(para) ?? false
}

// STATUS_CONFIG tokenizado — usa tokens semanticos de agenda definidos em globals.css.
// As classes bg-agenda-* e text-agenda-* sao geradas via @theme inline.
export const STATUS_CONFIG: Record<
  StatusAgendamento,
  { label: string; badgeClass: string; dotClass: string }
> = {
  agendado: {
    label: 'Agendado',
    badgeClass: 'bg-agenda-agendado/10 dark:bg-agenda-agendado/20 text-agenda-agendado',
    dotClass: 'bg-agenda-agendado',
  },
  confirmado: {
    label: 'Confirmado',
    badgeClass: 'bg-agenda-confirmado/10 dark:bg-agenda-confirmado/20 text-agenda-confirmado',
    dotClass: 'bg-agenda-confirmado',
  },
  em_andamento: {
    label: 'Em andamento',
    badgeClass: 'bg-agenda-em-andamento/10 dark:bg-agenda-em-andamento/20 text-agenda-em-andamento',
    dotClass: 'bg-agenda-em-andamento',
  },
  concluido: {
    label: 'Concluído',
    badgeClass: 'bg-agenda-concluido/10 dark:bg-agenda-concluido/20 text-agenda-concluido',
    dotClass: 'bg-agenda-concluido',
  },
  faltou: {
    label: 'Faltou',
    badgeClass: 'bg-agenda-faltou/10 dark:bg-agenda-faltou/20 text-agenda-faltou',
    dotClass: 'bg-agenda-faltou',
  },
  cancelado: {
    label: 'Cancelado',
    badgeClass: 'bg-agenda-cancelado/10 dark:bg-agenda-cancelado/20 text-agenda-cancelado',
    dotClass: 'bg-agenda-cancelado',
  },
}

// Fallback de exibição para o status legacy 'atendido' — qualquer ficha antiga
// que ainda não tenha sido normalizada pela migration cai aqui. Após o UPDATE
// da Fase 11.2, este caminho fica como segurança em camadas.
const STATUS_LEGACY_CONFIG: Record<string, { label: string; badgeClass: string; dotClass: string }> = {
  atendido: {
    label: 'Atendido',
    badgeClass: 'bg-agenda-concluido/10 dark:bg-agenda-concluido/20 text-agenda-concluido',
    dotClass: 'bg-agenda-concluido',
  },
}

export function getStatusConfig(status: string) {
  return (
    STATUS_CONFIG[status as StatusAgendamento] ??
    STATUS_LEGACY_CONFIG[status] ?? {
      label: status,
      badgeClass: 'bg-muted/50 dark:bg-muted/70 text-muted-foreground',
      dotClass: 'bg-muted-foreground',
    }
  )
}
