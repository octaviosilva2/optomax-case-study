// Métricas financeiras do painel /admin/billing.
//
// Decisão (Octavio, 26/06/2026): MRR/assinantes derivam de `organizations`
// (plan='pago' + plan_status) × preço do plano pago; pagamentos/atrasos/receita
// vêm de `payments`. Churn fica simplificado (orgs canceladas/expiradas) — churn
// real por assinatura depende de persistir `subscriptions` (débito da Fase 1).
//
// Tudo via service_role (createAdminClient) — uso interno do fundador.

import { createAdminClient } from '@/lib/supabase/admin'
import { normalizePlan } from '@/lib/utils/status'

// Status ASAAS que contam como "pago" (espelha o webhook).
const STATUS_PAGOS = new Set(['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'])
// Status ASAAS de cobrança vencida.
const STATUS_ATRASADO = new Set(['OVERDUE'])

// Uma linha de pagamento já enxuta para a UI.
export type BillingPaymentRow = {
  id: string
  orgId: string
  orgNome: string
  amountCents: number
  netAmountCents: number | null
  billingType: string | null
  status: string
  dueDate: string | null
  paidAt: string | null
  createdAt: string
}

// Uma assinante paga, para a lista de assinantes.
export type BillingSubscriberRow = {
  orgId: string
  orgNome: string
  planStatus: string
  // Vencimento mais recente conhecido (de payments), se houver.
  proximoVencimento: string | null
}

export type BillingMetrics = {
  // Preço mensal do plano pago (centavos) — base do cálculo de MRR.
  precoMensalCents: number
  // Nº de orgs pagantes com acesso pleno (plan=pago, plan_status=active).
  assinantesAtivos: number
  // Nº de orgs pagantes com fatura atrasada (plan=pago, plan_status=past_due).
  emAtraso: number
  // MRR = assinantesAtivos × preço mensal (centavos).
  mrrCents: number
  // Receita total já recebida (soma de payments pagos — net quando disponível).
  receitaRecebidaCents: number
  // Cortesias ativas (free sem prazo de trial).
  cortesias: number
  // Orgs em teste grátis vigente (free, trialing, trial no futuro).
  emTrial: number
  // Churn simplificado: orgs canceladas/expiradas no momento.
  canceladasOuExpiradas: number
  // Pagamentos recentes (mais novos primeiro).
  pagamentosRecentes: BillingPaymentRow[]
  // Assinantes pagos (active/past_due).
  assinantes: BillingSubscriberRow[]
}

/**
 * Carrega todas as métricas de billing num único helper. Lança em erro de query
 * (o caller decide como exibir).
 */
export async function loadBillingMetrics(): Promise<BillingMetrics> {
  const supabase = createAdminClient()

  // ---- 1. Preço do plano pago (menor sort_order entre os ativos) ----
  const { data: planos } = await supabase
    .from('plans')
    .select('amount_cents, is_active, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  const precoMensalCents = planos?.[0]?.amount_cents ?? 0

  // ---- 2. Organizations: tier + status + trial ----
  const { data: orgs, error: orgsErr } = await supabase
    .from('organizations')
    .select('id, nome_clinica, plan, plan_status, trial_ends_at')
  if (orgsErr) throw new Error(`organizations falhou: ${orgsErr.message}`)

  const agora = Date.now()
  let assinantesAtivos = 0
  let emAtraso = 0
  let cortesias = 0
  let emTrial = 0
  let canceladasOuExpiradas = 0

  // Mapa org_id → nome, para enriquecer payments/assinantes.
  const nomePorOrg = new Map<string, string>()
  // Orgs pagantes (active/past_due) → entram na lista de assinantes.
  const assinanteBase: { orgId: string; orgNome: string; planStatus: string }[] = []

  for (const o of orgs ?? []) {
    nomePorOrg.set(o.id, o.nome_clinica ?? '—')
    const plan = normalizePlan(o.plan)
    const status = o.plan_status ?? 'trialing'

    if (plan === 'pago') {
      if (status === 'active') {
        assinantesAtivos++
        assinanteBase.push({ orgId: o.id, orgNome: o.nome_clinica ?? '—', planStatus: status })
      } else if (status === 'past_due') {
        emAtraso++
        assinanteBase.push({ orgId: o.id, orgNome: o.nome_clinica ?? '—', planStatus: status })
      }
    } else if (plan === 'free') {
      const temPrazo = !!o.trial_ends_at
      const noFuturo = o.trial_ends_at ? new Date(o.trial_ends_at).getTime() > agora : false
      if (!temPrazo && status === 'active') cortesias++
      else if (status === 'trialing' && noFuturo) emTrial++
    }

    if (status === 'cancelled' || status === 'expired') canceladasOuExpiradas++
  }

  const mrrCents = assinantesAtivos * precoMensalCents

  // ---- 3. Payments: receita recebida + recentes + vencimento por org ----
  const { data: pays, error: payErr } = await supabase
    .from('payments')
    .select(
      'id, org_id, amount_cents, net_amount_cents, billing_type, status, due_date, paid_at, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(50)
  if (payErr) throw new Error(`payments falhou: ${payErr.message}`)

  let receitaRecebidaCents = 0
  const pagamentosRecentes: BillingPaymentRow[] = []
  // Vencimento mais recente por org (para a lista de assinantes).
  const vencimentoPorOrg = new Map<string, string>()

  for (const p of pays ?? []) {
    if (STATUS_PAGOS.has(p.status)) {
      receitaRecebidaCents += p.net_amount_cents ?? p.amount_cents ?? 0
    }
    if (p.due_date && !vencimentoPorOrg.has(p.org_id)) {
      vencimentoPorOrg.set(p.org_id, p.due_date)
    }
    pagamentosRecentes.push({
      id: p.id,
      orgId: p.org_id,
      orgNome: nomePorOrg.get(p.org_id) ?? '—',
      amountCents: p.amount_cents ?? 0,
      netAmountCents: p.net_amount_cents,
      billingType: p.billing_type,
      status: p.status,
      dueDate: p.due_date,
      paidAt: p.paid_at,
      createdAt: p.created_at,
    })
  }

  const assinantes: BillingSubscriberRow[] = assinanteBase.map((a) => ({
    ...a,
    proximoVencimento: vencimentoPorOrg.get(a.orgId) ?? null,
  }))

  return {
    precoMensalCents,
    assinantesAtivos,
    emAtraso,
    mrrCents,
    receitaRecebidaCents,
    cortesias,
    emTrial,
    canceladasOuExpiradas,
    pagamentosRecentes,
    assinantes,
  }
}

// Helpers de formatação compartilhados pela UI de billing.

/** Centavos → "R$ 1.234,56". */
export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Rótulo + tom para o status ASAAS de um pagamento.
export function statusPagamentoLabel(status: string): { label: string; tom: 'ok' | 'warning' | 'destructive' | 'muted' } {
  if (STATUS_PAGOS.has(status)) return { label: 'Recebido', tom: 'ok' }
  if (STATUS_ATRASADO.has(status)) return { label: 'Atrasado', tom: 'destructive' }
  if (status === 'PENDING' || status === 'AWAITING_RISK_ANALYSIS') return { label: 'Pendente', tom: 'warning' }
  if (status === 'REFUNDED') return { label: 'Estornado', tom: 'muted' }
  return { label: status, tom: 'muted' }
}

// Rótulo amigável do meio de pagamento ASAAS.
export function billingTypeLabel(billingType: string | null): string {
  switch (billingType) {
    case 'PIX':
      return 'Pix'
    case 'CREDIT_CARD':
      return 'Cartão'
    case 'BOLETO':
      return 'Boleto'
    default:
      return billingType ?? '—'
  }
}
