// Ponto de entrada da camada de pagamentos.
//
// getPaymentProvider() seleciona o provedor por ambiente. Hoje só existe ASAAS;
// trocar/adicionar provedor (plano B) é uma nova implementação de PaymentProvider
// retornada aqui — o checkout e o webhook não mudam.

import type { PaymentProvider } from './types'
import { AsaasProvider } from './asaas-provider'

export function getPaymentProvider(): PaymentProvider {
  return new AsaasProvider()
}

/**
 * Flag do cartão tokenizado. Pix funciona independente disto. A UI de cartão e
 * os métodos opcionais (tokenizeCard/updateSubscriptionCard) só ativam com o
 * flag ligado E habilitação ASAAS aprovada em produção (ASAAS-API.md §4).
 */
export function cartaoHabilitado(): boolean {
  return process.env.PAYMENTS_CREDIT_CARD_ENABLED === 'true'
}

export type {
  PaymentProvider,
  BillingType,
  Cycle,
  CreateCustomerInput,
  CreateSubscriptionInput,
  CreateChargeInput,
  PixQrCode,
} from './types'
export { PaymentProviderError, MENSAGEM_FALHA_PAGAMENTO } from './errors'
export { garantirCustomerAsaas } from './ensure-customer'
