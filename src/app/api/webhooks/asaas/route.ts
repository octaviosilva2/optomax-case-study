// Webhook ASAAS → nós.  POST /api/webhooks/asaas
//
// Recebe eventos de pagamento do ASAAS (at least once → duplicatas esperadas).
// Molde `/p/[token]`: sem sessão, usa admin client (service_role). O middleware
// (proxy.ts) tem bypass explícito para /api/webhooks/* — senão um POST sem
// sessão cairia no redirect /login.
//
// Garantias (spec §2 / ASAAS-API.md §3):
//   - Auth: header `asaas-access-token` === ASAAS_WEBHOOK_TOKEN, senão 401 e
//     NADA é gravado (falha fechada).
//   - Idempotência: PK de webhook_events = event.id (estável entre reenvios).
//   - 200 rápido: a fila do ASAAS PARA após 15 falhas consecutivas — um 500 em
//     série derruba o recebimento. Por isso erros previsíveis viram 200.
//   - Entitlement: a decisão de acesso só transiciona organizations.plan_status —
//     nunca depende de consultar o ASAAS. (Exceção pontual: o webhook faz UMA
//     leitura best-effort ao ASAAS só para persistir metadados de `subscriptions`
//     — nunca para decidir entitlement. Ver ensureLocalSubscription.)

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPaymentProvider, PaymentProviderError } from '@/lib/payments'
import type { Json } from '@/types/database'
import type { PlanStatus } from '@/lib/utils/status'

export const dynamic = 'force-dynamic'

// Resposta de sucesso padrão — curta e rápida.
function ok() {
  return NextResponse.json({ received: true }, { status: 200 })
}

// Lê um campo string de um objeto desconhecido sem lançar.
function readStr(obj: unknown, key: string): string | null {
  if (obj && typeof obj === 'object' && key in obj) {
    const v = (obj as Record<string, unknown>)[key]
    if (typeof v === 'string') return v
    if (typeof v === 'number') return String(v)
  }
  return null
}

function readNum(obj: unknown, key: string): number | null {
  if (obj && typeof obj === 'object' && key in obj) {
    const v = (obj as Record<string, unknown>)[key]
    if (typeof v === 'number' && Number.isFinite(v)) return v
  }
  return null
}

// Reais (decimal) → centavos (inteiro). Null-safe.
function toCents(value: number | null): number | null {
  if (value === null) return null
  return Math.round(value * 100)
}

// Mapeia o tipo de evento ASAAS para a transição de plan_status (spec §2.3).
// Eventos fora deste mapa são apenas GRAVADOS (registro/auditoria), sem mudar
// o status — ligar mais tarde é só adicionar a entrada aqui.
const TRANSICAO_POR_EVENTO: Record<string, PlanStatus> = {
  PAYMENT_CONFIRMED: 'active',
  PAYMENT_RECEIVED: 'active',
  PAYMENT_OVERDUE: 'past_due',
}

// Statuses ASAAS que significam "pago" (definem paid_at).
const STATUS_PAGOS = new Set(['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'])

// Eventos de cartão que NÃO mudam plan_status mas merecem visibilidade. A
// recusa da 1ª cobrança volta síncrona pela action (HTTP 400); aqui chega a
// recusa de RENOVAÇÃO. Não cortamos acesso na hora (o ASAAS reententa e, se
// persistir, dispara PAYMENT_OVERDUE → past_due). Só registramos e logamos.
const EVENTOS_CARTAO_INFORMATIVOS = new Set(['PAYMENT_CREDIT_CARD_CAPTURE_REFUSED'])

// Valores aceitos pelos CHECKs da tabela `subscriptions` (migration
// 20260624_asaas_billing_expand). Guardam contra gravar algo que o banco rejeita.
const CYCLES_VALIDOS = new Set(['MONTHLY', 'QUARTERLY'])
const BILLING_TYPES_VALIDOS = new Set(['PIX', 'CREDIT_CARD'])

// Garante a linha local em `subscriptions` para uma assinatura ASAAS e devolve
// seu id. O checkout (Server Action fora de /api) não pode escrever nessa tabela
// service_role-only, então o WEBHOOK é o único writer: na 1ª cobrança que traz o
// campo `subscription`, cria a linha (buscando cycle/valor no ASAAS).
//
// Best-effort por princípio: qualquer falha degrada para null — o pagamento é
// gravado sem vínculo e a próxima cobrança (ou o backfill) tenta de novo. NUNCA
// lança/500, para não derrubar o recebimento (a fila do ASAAS para após 15
// falhas consecutivas).
async function ensureLocalSubscription(
  admin: ReturnType<typeof createAdminClient>,
  asaasSubscriptionId: string,
  orgId: string,
): Promise<string | null> {
  // 1. Já existe? Caminho quente das renovações — evita bater no ASAAS.
  const { data: existente } = await admin
    .from('subscriptions')
    .select('id')
    .eq('asaas_subscription_id', asaasSubscriptionId)
    .maybeSingle()
  if (existente?.id) return existente.id

  // 2. Não existe → lê os metadados no ASAAS (única leitura externa do webhook).
  let details
  try {
    details = await getPaymentProvider().getSubscription(asaasSubscriptionId)
  } catch (err) {
    console.error(
      `[webhook asaas] falha ao ler assinatura ${asaasSubscriptionId} no ASAAS:`,
      err instanceof PaymentProviderError ? err.code : err,
    )
    return null
  }
  if (!details) {
    console.warn(`[webhook asaas] assinatura ${asaasSubscriptionId} inacessível no ASAAS`)
    return null
  }

  // Guarda contra o CHECK da tabela (cycle/billing_type).
  if (!CYCLES_VALIDOS.has(details.cycle) || !BILLING_TYPES_VALIDOS.has(details.billingType)) {
    console.warn(
      `[webhook asaas] assinatura ${asaasSubscriptionId} com cycle/billingType fora do esperado (${details.cycle}/${details.billingType})`,
    )
    return null
  }

  const amountCents = toCents(details.value) ?? 0

  // 3. plan_id (informativo, nullable): casa pelo valor com um plano ativo.
  const { data: plano } = await admin
    .from('plans')
    .select('id')
    .eq('amount_cents', amountCents)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .limit(1)
    .maybeSingle()
  const planId = plano?.id ?? null

  // 4. Upsert por asaas_subscription_id: idempotente e cobre a corrida entre dois
  //    eventos da mesma assinatura chegando juntos. Devolve o id resultante.
  const { data: criada, error } = await admin
    .from('subscriptions')
    .upsert(
      {
        org_id: orgId,
        plan_id: planId,
        asaas_subscription_id: asaasSubscriptionId,
        status: details.status,
        billing_type: details.billingType,
        amount_cents: amountCents,
        cycle: details.cycle,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'asaas_subscription_id' },
    )
    .select('id')
    .single()

  if (error || !criada?.id) {
    console.error(
      `[webhook asaas] falha ao gravar subscription ${asaasSubscriptionId}:`,
      error?.message,
    )
    return null
  }
  return criada.id
}

export async function POST(req: Request) {
  // ── 1. Auth (falha fechada) ────────────────────────────────────────────────
  const tokenRecebido = req.headers.get('asaas-access-token')
  const tokenEsperado = process.env.ASAAS_WEBHOOK_TOKEN
  // Sem env configurado → rejeita tudo (nunca aceitar webhook sem segredo).
  if (!tokenEsperado || tokenRecebido !== tokenEsperado) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  // ── 2. Parse tolerante ──────────────────────────────────────────────────────
  const raw = await req.text()
  let parsed: Json
  try {
    parsed = (raw ? JSON.parse(raw) : null) as Json
  } catch {
    // JSON quebrado — não há o que reprocessar. 200 para não reenfileirar lixo.
    console.warn('[webhook asaas] payload não-JSON ignorado')
    return ok()
  }

  const eventId = readStr(parsed, 'id')
  const eventType = readStr(parsed, 'event')
  const payment =
    parsed && typeof parsed === 'object' && 'payment' in parsed
      ? (parsed as Record<string, unknown>).payment
      : null
  const paymentId = readStr(payment, 'id')

  // Sem id de evento ou tipo → não dá para idempotência nem ação. 200 + log.
  if (!eventId || !eventType) {
    console.warn('[webhook asaas] evento sem id/event ignorado')
    return ok()
  }

  // Fallback defensivo da chave idempotente (a doc garante event.id estável,
  // mas se faltar usamos a composição evento:cobrança).
  const idempotencyKey = eventId || (paymentId ? `${eventType}:${paymentId}` : null)
  if (!idempotencyKey) {
    console.warn('[webhook asaas] sem chave idempotente possível')
    return ok()
  }

  const admin = createAdminClient()

  try {
    // ── 3+4. Idempotência: INSERT ON CONFLICT DO NOTHING ─────────────────────
    const { data: inserido, error: insErr } = await admin
      .from('webhook_events')
      .upsert(
        {
          id: idempotencyKey,
          event_type: eventType,
          asaas_payment_id: paymentId,
          payload: parsed,
        },
        { onConflict: 'id', ignoreDuplicates: true },
      )
      .select('id')

    if (insErr) {
      // Falha ao gravar o evento → deixa o ASAAS reenviar (500). Ainda não
      // tocamos em nada, então é seguro.
      console.error('[webhook asaas] erro ao gravar evento:', insErr.message)
      return new NextResponse('Internal error', { status: 500 })
    }

    const eraNovo = !!inserido && inserido.length > 0
    if (!eraNovo) {
      // Já existia. Se já foi processado → idempotência pura (200 sem reefeito).
      // Se ficou pela metade (processed_at null) → segue e reprocessa: os passos
      // abaixo são determinísticos (UPSERT + UPDATE), reprocessar é seguro.
      const { data: existente } = await admin
        .from('webhook_events')
        .select('processed_at')
        .eq('id', idempotencyKey)
        .single()
      if (existente?.processed_at) return ok()
    }

    // ── 5. Lookup da org (externalReference = org_id, ou asaas_customer_id) ───
    const externalReference = readStr(payment, 'externalReference')
    const customerId = readStr(payment, 'customer')

    let orgId: string | null = null
    if (externalReference) {
      const { data: orgByRef } = await admin
        .from('organizations')
        .select('id')
        .eq('id', externalReference)
        .maybeSingle()
      orgId = orgByRef?.id ?? null
    }
    if (!orgId && customerId) {
      const { data: orgByCustomer } = await admin
        .from('organizations')
        .select('id')
        .eq('asaas_customer_id', customerId)
        .maybeSingle()
      orgId = orgByCustomer?.id ?? null
    }

    // Org não encontrada → grava o evento como processado (não reenfileira) e
    // loga para investigação. Não muda nenhuma org.
    if (!orgId) {
      await admin
        .from('webhook_events')
        .update({ processed_at: new Date().toISOString() })
        .eq('id', idempotencyKey)
      console.warn(
        `[webhook asaas] org não encontrada (ref=${externalReference}, customer=${customerId}, event=${eventType})`,
      )
      return ok()
    }

    // ── 6. UPSERT do payment (se o evento carrega uma cobrança) ──────────────
    if (paymentId) {
      const paymentStatus = readStr(payment, 'status') ?? eventType
      const billingType = readStr(payment, 'billingType')
      const amountCents = toCents(readNum(payment, 'value'))
      const netCents = toCents(readNum(payment, 'netValue'))
      const dueDate = readStr(payment, 'dueDate')
      const subscriptionAsaasId = readStr(payment, 'subscription')

      // Liga ao subscription local, CRIANDO a linha se ainda não existir (o
      // webhook é o único writer dessa tabela — ver ensureLocalSubscription).
      let subscriptionId: string | null = null
      if (subscriptionAsaasId) {
        subscriptionId = await ensureLocalSubscription(admin, subscriptionAsaasId, orgId)
      }

      const pago = STATUS_PAGOS.has(paymentStatus)

      const { error: payErr } = await admin.from('payments').upsert(
        {
          org_id: orgId,
          subscription_id: subscriptionId,
          asaas_payment_id: paymentId,
          status: paymentStatus,
          billing_type: billingType,
          amount_cents: amountCents ?? 0,
          net_amount_cents: netCents,
          due_date: dueDate,
          paid_at: pago ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'asaas_payment_id' },
      )
      if (payErr) {
        console.error('[webhook asaas] erro ao gravar payment:', payErr.message)
        return new NextResponse('Internal error', { status: 500 })
      }
    }

    // ── 6.1 Recusa de cartão (renovação) — registro + alerta, sem corte ──────
    if (EVENTOS_CARTAO_INFORMATIVOS.has(eventType)) {
      console.warn(
        `[webhook asaas] recusa de cartão (org=${orgId}, payment=${paymentId}, event=${eventType}) — registrado; corte fica a cargo de PAYMENT_OVERDUE`,
      )
    }

    // ── 7. Transição de plan_status (só para eventos do mapa) ────────────────
    const novoStatus = TRANSICAO_POR_EVENTO[eventType]
    if (novoStatus) {
      // Pagamento confirmado promove a org ao plano 'pago' (além de ativar o
      // status). É o que distingue um assinante pagante de uma cortesia ('free'
      // com plan_status='active'). PAYMENT_OVERDUE só mexe no status — a org já
      // é 'pago' e continua sendo (só fica past_due).
      const update: { plan_status: PlanStatus; plan?: string } = { plan_status: novoStatus }
      if (novoStatus === 'active') update.plan = 'pago'

      const { error: orgErr } = await admin
        .from('organizations')
        .update(update)
        .eq('id', orgId)
      if (orgErr) {
        console.error('[webhook asaas] erro ao transicionar org:', orgErr.message)
        return new NextResponse('Internal error', { status: 500 })
      }
    }

    // ── 8. Marca processado ──────────────────────────────────────────────────
    await admin
      .from('webhook_events')
      .update({ processed_at: new Date().toISOString() })
      .eq('id', idempotencyKey)

    // ── 9. 200 ───────────────────────────────────────────────────────────────
    return ok()
  } catch (err) {
    // Erro inesperado: 500 genérico (sem vazar stack). Evento fica sem
    // processed_at → ASAAS reenvia, e o passo 4 detecta a duplicata.
    console.error('[webhook asaas] erro inesperado:', err)
    return new NextResponse('Internal error', { status: 500 })
  }
}
