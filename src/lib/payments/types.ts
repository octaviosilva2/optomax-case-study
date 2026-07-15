// Contrato da camada de pagamentos — isola o provedor (ASAAS) atrás de uma
// interface. Trocar de provedor (ex. Pagar.me, plano B) não reescreve o
// checkout nem o webhook: basta uma nova implementação de PaymentProvider.
//
// Shapes acordados na spec §3 (03-spec.md). Valores monetários trafegam para
// o provedor em REAIS (number, ex. 99.00) — o provedor ASAAS usa decimal.
// Internamente o nosso schema guarda centavos (integer); a conversão acontece
// na borda (checkout action), não aqui.

export type BillingType = 'PIX' | 'CREDIT_CARD'
export type Cycle = 'MONTHLY' | 'QUARTERLY'

export interface CreateCustomerInput {
  name: string
  email: string
  cpfCnpj?: string
}

/** Dados do cartão enviados na criação da assinatura CREDIT_CARD. NUNCA
 * persistidos no nosso banco — trafegam só para o ASAAS (escopo PCI). O ASAAS
 * guarda o cartão internamente e renova a assinatura sozinho a cada ciclo. */
export interface CreditCardData {
  number: string
  holderName: string
  /** 2 dígitos. */
  expiryMonth: string
  /** 4 dígitos. */
  expiryYear: string
  ccv: string
}

/** Dados do titular exigidos pelo ASAAS na cobrança de cartão (antifraude). */
export interface CreditCardHolderInfo {
  name: string
  email: string
  cpfCnpj: string
  postalCode: string
  addressNumber: string
  /** Opcional: puxado do cadastro da org quando houver. */
  phone?: string
  addressComplement?: string
}

export interface CreateSubscriptionInput {
  customerId: string
  billingType: BillingType
  /** Valor em reais (ex. 99.00), não em centavos. */
  value: number
  cycle: Cycle
  /** Data da 1ª cobrança no formato 'YYYY-MM-DD'. */
  nextDueDate: string
  description: string
  /** Liga o webhook de volta à org. Sempre = org_id. */
  externalReference: string
  /** Só usado no fluxo de cartão (atrás do flag). */
  creditCardToken?: string
  /** Dados do cartão (fluxo CREDIT_CARD sem token). Só server-side. */
  creditCard?: CreditCardData
  /** Dados do titular do cartão (obrigatório no fluxo CREDIT_CARD). */
  creditCardHolderInfo?: CreditCardHolderInfo
  /** IP do cliente final — exigido pelo ASAAS na captura de cartão. */
  remoteIp?: string
}

export interface CreateChargeInput {
  customerId: string
  billingType: 'PIX'
  /** Valor em reais (ex. 99.00), não em centavos. */
  value: number
  /** Vencimento no formato 'YYYY-MM-DD'. */
  dueDate: string
  externalReference: string
}

/** Metadados de uma assinatura lidos do provedor (GET /subscriptions/{id}).
 * Usado pelo webhook para persistir a linha local em `subscriptions` quando a
 * 1ª cobrança chega (o checkout, sendo Server Action fora de /api, não pode
 * escrever nessa tabela service_role-only). Valor em REAIS (o provedor usa
 * decimal); a conversão para centavos acontece na borda (webhook). */
export interface SubscriptionDetails {
  billingType: string
  cycle: string
  /** Valor em reais (ex. 59.97), não em centavos. */
  value: number
  status: string
}

export interface PixQrCode {
  /** Imagem do QR em base64 (sem o prefixo data:). */
  encodedImage: string
  /** Copia-e-cola do Pix. */
  payload: string
  /** Expiração do QR no formato date-time do ASAAS. */
  expirationDate: string
}

// ── Cartão tokenizado — atrás do flag PAYMENTS_CREDIT_CARD_ENABLED ───────────
// Não é chamado no MVP Pix. Campos reais da doc ASAAS (ASAAS-API.md §2.6).

export interface TokenizeCardInput {
  customerId: string
  remoteIp: string
  creditCard: {
    number: string
    holderName: string
    /** 2 dígitos. */
    expiryMonth: string
    /** 4 dígitos. */
    expiryYear: string
    ccv: string
  }
  holderInfo: {
    name: string
    email: string
    cpfCnpj: string
    postalCode: string
    addressNumber: string
    phone: string
  }
}

/**
 * Provedor de pagamentos. A implementação concreta (AsaasProvider) fala com a
 * API do provedor; o resto do app só conhece esta interface.
 *
 * Os métodos de cartão são opcionais — só existem quando o flag de habilitação
 * estiver ligado E o ASAAS tiver aprovado a tokenização em produção (ASAAS-API.md §4).
 */
export interface PaymentProvider {
  createCustomer(input: CreateCustomerInput): Promise<{ customerId: string }>
  /**
   * Atualiza um customer existente no provedor. Usado quando o customer já foi
   * criado sem cpfCnpj e precisamos preenchê-lo antes da cobrança Pix (o ASAAS
   * exige cpfCnpj na cobrança, não na criação do customer).
   */
  updateCustomer(customerId: string, input: { cpfCnpj?: string; name?: string; email?: string }): Promise<void>
  createSubscription(input: CreateSubscriptionInput): Promise<{ subscriptionId: string }>
  createCharge(input: CreateChargeInput): Promise<{ paymentId: string }>
  getPixQrCode(paymentId: string): Promise<PixQrCode>
  /** Primeira cobrança de uma assinatura (para gerar o QR). Null se ainda não houver. */
  getFirstSubscriptionPayment(subscriptionId: string): Promise<{ paymentId: string } | null>
  /** Metadados da assinatura (cycle/value/billingType/status). Usado pelo webhook
   * para persistir a linha local. Null se a assinatura não existe/for inacessível. */
  getSubscription(subscriptionId: string): Promise<SubscriptionDetails | null>

  // ── opcionais (cartão atrás do flag) ──
  tokenizeCard?(input: TokenizeCardInput): Promise<{ creditCardToken: string }>
  updateSubscriptionCard?(subscriptionId: string, token: string): Promise<void>
}
