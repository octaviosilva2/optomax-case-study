// Garante um customer ASAAS válido no ambiente atual antes da cobrança.
//
// Problema que resolve: o asaas_customer_id salvo na org pode apontar para um
// customer que NÃO existe no ambiente ASAAS atual — porque foi criado em outro
// ambiente (troca sandbox↔prod) ou porque foi deletado no painel. Nesse caso o
// ASAAS responde 404 em POST /customers/{id} e o checkout inteiro abortava.
//
// Estratégia (auto-recuperação): se o ID salvo dá 404, ele é órfão — recriamos
// o customer no ambiente atual e devolvemos o novo ID. O caller persiste o ID
// retornado em organizations.asaas_customer_id. Qualquer outro erro propaga.

import type { PaymentProvider } from './types'
import { PaymentProviderError } from './errors'

export interface GarantirCustomerArgs {
  /** ID atualmente salvo na org (ou null se nunca houve). */
  customerId: string | null
  name: string
  email: string
  cpfCnpj: string
}

/**
 * Devolve um customerId ASAAS garantidamente válido no ambiente atual.
 * - Sem ID salvo → cria.
 * - Com ID salvo → garante o cpfCnpj via updateCustomer. Em 404 (ID órfão),
 *   recria e devolve o novo ID.
 */
export async function garantirCustomerAsaas(
  provider: PaymentProvider,
  { customerId, name, email, cpfCnpj }: GarantirCustomerArgs,
): Promise<string> {
  if (!customerId) {
    // Novo customer já nasce com o cpfCnpj (o Pix exige na cobrança).
    const created = await provider.createCustomer({ name, email, cpfCnpj })
    return created.customerId
  }

  try {
    // Customer já existe — garante o cpfCnpj nele antes da cobrança.
    // Idempotente: reenviar o mesmo dado é ok.
    await provider.updateCustomer(customerId, { cpfCnpj })
    return customerId
  } catch (err) {
    // 404 = o ID salvo não existe no ambiente ASAAS atual (criado em outro
    // ambiente, ou deletado). Recria e segue, em vez de quebrar o checkout.
    if (err instanceof PaymentProviderError && err.httpStatus === 404) {
      console.warn(
        `[checkout] asaas_customer_id órfão (${customerId}): 404 no ambiente atual — recriando customer.`,
      )
      const created = await provider.createCustomer({ name, email, cpfCnpj })
      return created.customerId
    }
    throw err
  }
}
