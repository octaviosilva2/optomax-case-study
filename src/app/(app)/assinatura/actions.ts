'use server'

// Checkout Pix server-side (Fatia B — MVP).
//
// iniciarCheckout(planId): cria/reusa o customer ASAAS da org, cria a assinatura
// Pix e devolve o QR (imagem base64 + copia-e-cola) para a tela "aguardando
// pagamento". A ATIVAÇÃO é exclusivamente do webhook (PAYMENT_CONFIRMED/RECEIVED)
// — esta action NUNCA seta plan_status=active (evita divergência "achei que paguei"
// × "ASAAS confirmou"). Ver spec §4.
//
// Decisões de implementação (conflito entre regras do projeto, resolvido aqui):
//   - Regra #4 (sempre Server Action p/ mutação) + Regra #1 (nunca importar
//     admin.ts fora de /api) ⇒ esta action usa o CLIENTE DE SESSÃO. O único
//     write é organizations.asaas_customer_id, permitido pela policy `org_update`.
//   - As tabelas de billing (subscriptions/payments) são service_role-only
//     (spec §1.2) → NÃO são escritas aqui. O webhook registra o pagamento por
//     externalReference=org_id; o vínculo local de `subscriptions` fica deferido
//     (follow-up sinalizado no handoff). O MVP "paga e ativa" funciona sem ele.
//   - assertActiveOrg NÃO é usado: titular em trial/expirado PODE pagar. Só
//     exigimos sessão válida para obter o org_id (nunca do body).

import { z } from 'zod'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getSessionData } from '@/lib/auth/session'
import { apenasDigitos, validarCpfCnpj } from '@/lib/utils/cpf-cnpj'
import { cartaoSchema } from '@/lib/validations/checkout'
import { normalizarTelefone } from '@/lib/validations/onboarding'
import {
  getPaymentProvider,
  garantirCustomerAsaas,
  cartaoHabilitado,
  PaymentProviderError,
  MENSAGEM_FALHA_PAGAMENTO,
  type Cycle,
} from '@/lib/payments'

const checkoutSchema = z.object({
  planId: z.string().uuid(),
  // O ASAAS exige CPF/CNPJ do titular para gerar a cobrança Pix. Validamos os
  // dígitos verificadores aqui (o cliente já valida; defesa em profundidade).
  cpfCnpj: z.string().refine(validarCpfCnpj, 'CPF/CNPJ inválido.'),
})

export type CheckoutResult =
  | {
      ok: true
      subscriptionId: string
      pix: { encodedImage: string; payload: string; expirationDate: string }
    }
  | { ok: false; error: string }

// Data de hoje (YYYY-MM-DD) no fuso de Brasília — base do nextDueDate da assinatura.
function dataHojeBrasilia(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export async function iniciarCheckout(input: {
  planId: string
  cpfCnpj: string
}): Promise<CheckoutResult> {
  // org_id SEMPRE da sessão autenticada, nunca do body (regra do projeto).
  const session = await getSessionData()
  if (!session || !session.org) {
    return { ok: false, error: 'Sessão expirada. Faça login novamente.' }
  }

  let planId: string
  let cpfCnpj: string
  try {
    const parsed = checkoutSchema.parse(input)
    planId = parsed.planId
    // Persistimos e enviamos ao ASAAS só os dígitos (sem máscara).
    cpfCnpj = apenasDigitos(parsed.cpfCnpj)
  } catch {
    return { ok: false, error: 'CPF/CNPJ inválido. Confira e tente de novo.' }
  }

  const supabase = await createClient()
  const orgId = session.org.id

  // 1. Lê o plano escolhido (plans tem SELECT público de ativos).
  const { data: plan, error: planErr } = await supabase
    .from('plans')
    .select('id, name, amount_cents, cycle, billing_type, is_active')
    .eq('id', planId)
    .maybeSingle()

  if (planErr || !plan || !plan.is_active) {
    return { ok: false, error: 'Plano indisponível no momento.' }
  }
  // MVP: só Pix está ligado (cartão atrás do flag — ASAAS-API.md §4).
  if (plan.billing_type !== 'PIX') {
    return { ok: false, error: 'Pagamento por cartão indisponível no momento.' }
  }

  // asaas_customer_id não vem no getSessionData — busca direta (org_select policy).
  const { data: org } = await supabase
    .from('organizations')
    .select('asaas_customer_id, nome_clinica')
    .eq('id', orgId)
    .single()

  const provider = getPaymentProvider()

  try {
    // 2. Garante o customer ASAAS COM cpfCnpj (o Pix exige na cobrança). Resolve
    //    também o caso de ID órfão (404): recria o customer no ambiente atual.
    const customerId = await garantirCustomerAsaas(provider, {
      customerId: org?.asaas_customer_id ?? null,
      name: org?.nome_clinica ?? 'Cliente OptoMax',
      email: session.user.email ?? '',
      cpfCnpj,
    })

    // Persiste customer + cpf_cnpj na org (só dígitos). Falha aqui aborta: sem
    // gravar o customer, a próxima tentativa criaria um duplicado no ASAAS.
    const { error: upErr } = await supabase
      .from('organizations')
      .update({ asaas_customer_id: customerId, cpf_cnpj: cpfCnpj })
      .eq('id', orgId)
    if (upErr) {
      console.error('[checkout] falha ao gravar customer/cpf_cnpj:', upErr.message)
      return { ok: false, error: MENSAGEM_FALHA_PAGAMENTO }
    }

    // 3. Cria a assinatura Pix no ASAAS. externalReference = org_id liga o webhook
    //    de volta à org (fonte da ativação).
    const { subscriptionId } = await provider.createSubscription({
      customerId,
      billingType: 'PIX',
      value: plan.amount_cents / 100, // centavos → reais
      cycle: plan.cycle as Cycle,
      nextDueDate: dataHojeBrasilia(),
      description: `Assinatura ${plan.name} — OptoMax`,
      externalReference: orgId,
    })

    // 4. Recupera o QR Pix da 1ª cobrança da assinatura.
    const first = await provider.getFirstSubscriptionPayment(subscriptionId)
    if (!first) {
      // Assinatura criada, cobrança ainda não materializada. A tela instrui aguardar.
      return { ok: false, error: 'Cobrança em processamento. Atualize em instantes.' }
    }
    const pix = await provider.getPixQrCode(first.paymentId)

    return { ok: true, subscriptionId, pix }
  } catch (err) {
    // Não vaza segredo/stack — log técnico fica server-side; UI recebe genérico.
    if (err instanceof PaymentProviderError) {
      console.error('[checkout]', err.code, err.httpStatus ?? '', err.detail ?? err.message)
    } else {
      console.error('[checkout] erro inesperado:', err)
    }
    return { ok: false, error: MENSAGEM_FALHA_PAGAMENTO }
  }
}

// ── Checkout via CARTÃO DE CRÉDITO (Fase 4 — atrás do flag) ──────────────────
//
// Diferente do Pix (assíncrono, QR + espera): no cartão a 1ª cobrança da
// assinatura é capturada na hora pelo ASAAS. Se aprovada, o ASAAS guarda o
// cartão e renova sozinho a cada ciclo (sem nossa tokenização). A ATIVAÇÃO
// continua vindo só do webhook (PAYMENT_CONFIRMED/RECEIVED) — esta action não
// seta plan_status. Se o cartão é recusado, o ASAAS responde 400 e devolvemos
// `recusado: true` para a tela oferecer nova tentativa / Pix.
//
// PCI: os dados do cartão trafegam só para o ASAAS e NUNCA são persistidos nem
// logados. O catch loga apenas code/status/detail do erro (sem o body enviado).

const MSG_CARTAO_RECUSADO =
  'Não foi possível aprovar o cartão. Confira os dados, tente outro cartão ou pague via Pix.'

// Extrai a 1ª mensagem de validação do erro do ASAAS (formato
// { errors: [{ code, description }] }). É seguro mostrar ao usuário: são
// mensagens de validação em PT (ex. "O CEP informado é inválido."), não vazam
// dado sensível. Retorna null quando não há description utilizável → cai no
// texto genérico.
function descricaoErroAsaas(detail: unknown): string | null {
  if (!detail || typeof detail !== 'object' || !('errors' in detail)) return null
  const errs = (detail as { errors?: unknown }).errors
  if (!Array.isArray(errs) || errs.length === 0) return null
  const first = errs[0]
  if (first && typeof first === 'object' && 'description' in first) {
    const d = (first as { description?: unknown }).description
    if (typeof d === 'string' && d.trim()) return d.trim()
  }
  return null
}

export type CheckoutCartaoResult =
  | { ok: true; subscriptionId: string }
  | { ok: false; error: string; recusado?: boolean }

export async function iniciarCheckoutCartao(
  input: { planId: string } & z.input<typeof cartaoSchema>,
): Promise<CheckoutCartaoResult> {
  // Flag de habilitação: cartão só responde quando ligado (ASAAS-API.md §4).
  if (!cartaoHabilitado()) {
    return { ok: false, error: 'Pagamento por cartão indisponível no momento.' }
  }

  // org_id SEMPRE da sessão autenticada, nunca do body (regra do projeto).
  const session = await getSessionData()
  if (!session || !session.org) {
    return { ok: false, error: 'Sessão expirada. Faça login novamente.' }
  }

  // Valida o planId e os dados do cartão (mesmo schema do form — defesa em
  // profundidade). O schema normaliza número/validade/CEP e roda Luhn.
  let planId: string
  let cartao: z.infer<typeof cartaoSchema>
  try {
    planId = z.string().uuid().parse(input.planId)
    cartao = cartaoSchema.parse(input)
  } catch {
    return { ok: false, error: 'Confira os dados do cartão e tente de novo.' }
  }

  const supabase = await createClient()
  const orgId = session.org.id

  // Lê o plano (value/cycle/name). Cartão usa o MESMO plano do Pix — a forma de
  // pagamento é escolha da UI, não do plano; por isso não checamos billing_type.
  const { data: plan, error: planErr } = await supabase
    .from('plans')
    .select('id, name, amount_cents, cycle, is_active')
    .eq('id', planId)
    .maybeSingle()

  if (planErr || !plan || !plan.is_active) {
    return { ok: false, error: 'Plano indisponível no momento.' }
  }

  // IP do cliente final — o ASAAS exige na captura do cartão (antifraude).
  const hdrs = await headers()
  const remoteIp =
    hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    hdrs.get('x-real-ip')?.trim() ||
    undefined

  const cpfCnpj = apenasDigitos(cartao.cpfCnpj)
  const provider = getPaymentProvider()

  try {
    // Garante o customer ASAAS com cpfCnpj (igual ao fluxo Pix). O telefone do
    // titular não é pedido na tela — puxamos do cadastro da clínica.
    const { data: org } = await supabase
      .from('organizations')
      .select('asaas_customer_id, nome_clinica, telefone')
      .eq('id', orgId)
      .single()

    // E-mail vem sempre da sessão (login é por e-mail); telefone do cadastro da
    // org (se houver). Ambos enviados ao ASAAS sem o usuário redigitar.
    const email = session.user.email ?? ''
    const phone = normalizarTelefone(org?.telefone ?? '')

    // Mesmo padrão do Pix: garante o customer e auto-recupera ID órfão (404).
    const customerId = await garantirCustomerAsaas(provider, {
      customerId: org?.asaas_customer_id ?? null,
      name: org?.nome_clinica ?? 'Cliente OptoMax',
      email,
      cpfCnpj,
    })

    const { error: upErr } = await supabase
      .from('organizations')
      .update({ asaas_customer_id: customerId, cpf_cnpj: cpfCnpj })
      .eq('id', orgId)
    if (upErr) {
      console.error('[checkout cartão] falha ao gravar customer/cpf_cnpj:', upErr.message)
      return { ok: false, error: MENSAGEM_FALHA_PAGAMENTO }
    }

    // Cria a assinatura CREDIT_CARD: o ASAAS captura a 1ª cobrança agora e
    // guarda o cartão para renovar sozinho. externalReference = org_id liga o
    // webhook de volta à org (fonte da ativação).
    const { subscriptionId } = await provider.createSubscription({
      customerId,
      billingType: 'CREDIT_CARD',
      value: plan.amount_cents / 100, // centavos → reais
      cycle: plan.cycle as Cycle,
      nextDueDate: dataHojeBrasilia(),
      description: `Assinatura ${plan.name} — OptoMax`,
      externalReference: orgId,
      creditCard: {
        number: cartao.number,
        holderName: cartao.holderName,
        expiryMonth: cartao.expiryMonth,
        expiryYear: cartao.expiryYear,
        ccv: cartao.ccv,
      },
      creditCardHolderInfo: {
        name: cartao.holderInfoName,
        email,
        cpfCnpj,
        postalCode: cartao.postalCode,
        // Só o CEP é coletado na tela; o ASAAS exige um número → enviamos "S/N".
        addressNumber: 'S/N',
        // Telefone puxado do cadastro da org — enviado só se válido (o ASAAS
        // pode exigir; se reclamar, voltamos o campo na tela).
        ...(phone ? { phone } : {}),
      },
      remoteIp,
    })

    return { ok: true, subscriptionId }
  } catch (err) {
    if (err instanceof PaymentProviderError) {
      console.error('[checkout cartão]', err.code, err.httpStatus ?? '', err.detail ?? err.message)
      // 400 do ASAAS na captura = cartão recusado/dados inválidos. Mostra a
      // mensagem específica do ASAAS quando houver (ex. "CEP inválido"); senão
      // o texto genérico. recusado=true mantém o form para nova tentativa.
      if (err.httpStatus === 400) {
        return {
          ok: false,
          error: descricaoErroAsaas(err.detail) ?? MSG_CARTAO_RECUSADO,
          recusado: true,
        }
      }
    } else {
      console.error('[checkout cartão] erro inesperado:', err)
    }
    return { ok: false, error: MENSAGEM_FALHA_PAGAMENTO }
  }
}

// Polling leve do estado de entitlement para a tela "aguardando pagamento".
// A ativação é do webhook (PAYMENT_CONFIRMED/RECEIVED → plan_status='active');
// o checkout só consulta. Lê SEMPRE da sessão (org_id nunca do client) e busca
// fresco no banco a cada chamada (a org lê o próprio plan_status via RLS).
export async function checarStatusPlano(): Promise<{ planStatus: string | null }> {
  const session = await getSessionData()
  if (!session || !session.org) return { planStatus: null }

  const supabase = await createClient()
  const { data } = await supabase
    .from('organizations')
    .select('plan_status')
    .eq('id', session.org.id)
    .single()

  return { planStatus: data?.plan_status ?? null }
}
