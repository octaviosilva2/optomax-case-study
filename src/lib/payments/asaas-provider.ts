// Implementação ASAAS do PaymentProvider.
//
// Fala com a API v3 do ASAAS via fetch. Segredos SÓ server-side (este módulo
// nunca pode ser importado no client). A base (sandbox/prod) e a API key vêm
// de env — estratégia "sandbox primeiro" (ASAAS-API.md §1).
//
// Contratos confirmados na doc (ASAAS-API.md §2 / spec §2.4):
//   POST /customers                     → { id: 'cus_...' }
//   POST /subscriptions                 → { id: 'sub_...' }
//   POST /payments                      → { id: 'pay_...' }
//   GET  /payments/{id}/pixQrCode       → { encodedImage, payload, expirationDate }
//   GET  /subscriptions/{id}/payments   → { data: [ { id: 'pay_...' }, ... ] }
//   GET  /subscriptions/{id}             → { id, billingType, cycle, value, status, ... }

import type {
  PaymentProvider,
  CreateCustomerInput,
  CreateSubscriptionInput,
  CreateChargeInput,
  PixQrCode,
  SubscriptionDetails,
} from './types'
import { PaymentProviderError } from './errors'

// User-Agent é obrigatório nas requisições ao ASAAS (ASAAS-API.md §1).
const USER_AGENT = 'OptoMax/1.0 (+https://optomax.com.br)'
// Timeout mínimo de 60s nas cobranças evita duplicatas (ASAAS-API.md §1).
const REQUEST_TIMEOUT_MS = 60_000

type AsaasConfig = { baseUrl: string; apiKey: string }

/**
 * Resolve base URL + API key a partir do env. A base seleciona o ambiente
 * (sandbox/prod); a key correspondente é escolhida pela própria base — assim
 * não há risco de usar a key de produção contra o sandbox e vice-versa.
 */
function resolveConfig(): AsaasConfig {
  const baseUrl = (process.env.ASAAS_BASE_URL ?? '').replace(/\/+$/, '')
  if (!baseUrl) {
    throw new PaymentProviderError('ASAAS_CONFIG', 'ASAAS_BASE_URL ausente no ambiente.')
  }

  const isSandbox = baseUrl.includes('sandbox')
  const apiKey = isSandbox
    ? process.env.ASAAS_API_KEY_SANDBOX
    : process.env.ASAAS_API_KEY

  if (!apiKey) {
    throw new PaymentProviderError(
      'ASAAS_CONFIG',
      `API key ASAAS ausente (${isSandbox ? 'ASAAS_API_KEY_SANDBOX' : 'ASAAS_API_KEY'}).`,
    )
  }

  return { baseUrl, apiKey }
}

async function asaasRequest<T>(
  path: string,
  init: { method: 'GET' | 'POST'; body?: unknown },
): Promise<T> {
  const { baseUrl, apiKey } = resolveConfig()

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let res: Response
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method: init.method,
      headers: {
        access_token: apiKey,
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
      // Pagamento nunca pode ser cacheado por engano.
      cache: 'no-store',
    })
  } catch (err) {
    // Erro de rede / timeout (abort). Não vaza nada sensível.
    throw new PaymentProviderError('ASAAS_NETWORK', 'Falha de rede ao contatar o ASAAS.', {
      detail: err,
    })
  } finally {
    clearTimeout(timeout)
  }

  // Corpo lido como texto e parseado com tolerância (resposta de erro do ASAAS
  // vem como { errors: [{ code, description }] }).
  const text = await res.text()
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }

  if (!res.ok) {
    throw new PaymentProviderError(
      `ASAAS_HTTP_${res.status}`,
      `ASAAS respondeu ${res.status} em ${init.method} ${path}.`,
      { httpStatus: res.status, detail: json ?? text },
    )
  }

  return json as T
}

export class AsaasProvider implements PaymentProvider {
  async createCustomer(input: CreateCustomerInput): Promise<{ customerId: string }> {
    const data = await asaasRequest<{ id: string }>('/customers', {
      method: 'POST',
      body: {
        name: input.name,
        email: input.email,
        ...(input.cpfCnpj ? { cpfCnpj: input.cpfCnpj } : {}),
      },
    })
    if (!data?.id) {
      throw new PaymentProviderError('ASAAS_BAD_RESPONSE', 'Resposta sem id ao criar cliente.', {
        detail: data,
      })
    }
    return { customerId: data.id }
  }

  async updateCustomer(
    customerId: string,
    input: { cpfCnpj?: string; name?: string; email?: string },
  ): Promise<void> {
    // ASAAS atualiza customer via POST /customers/{id} (não PUT).
    await asaasRequest<{ id: string }>(`/customers/${encodeURIComponent(customerId)}`, {
      method: 'POST',
      body: {
        ...(input.cpfCnpj ? { cpfCnpj: input.cpfCnpj } : {}),
        ...(input.name ? { name: input.name } : {}),
        ...(input.email ? { email: input.email } : {}),
      },
    })
  }

  async createSubscription(
    input: CreateSubscriptionInput,
  ): Promise<{ subscriptionId: string }> {
    // No fluxo CREDIT_CARD enviamos os dados do cartão na criação da assinatura:
    // o ASAAS captura a 1ª cobrança na hora, guarda o cartão e renova sozinho a
    // cada ciclo (sem nossa tokenização). remoteIp é exigido na captura. Se já
    // houver token (reuso futuro), ele tem prioridade sobre os dados crus.
    const dadosCartao =
      input.billingType === 'CREDIT_CARD'
        ? {
            ...(input.creditCardToken
              ? { creditCardToken: input.creditCardToken }
              : input.creditCard
                ? {
                    creditCard: {
                      number: input.creditCard.number,
                      holderName: input.creditCard.holderName,
                      expiryMonth: input.creditCard.expiryMonth,
                      expiryYear: input.creditCard.expiryYear,
                      ccv: input.creditCard.ccv,
                    },
                  }
                : {}),
            ...(input.creditCardHolderInfo
              ? { creditCardHolderInfo: input.creditCardHolderInfo }
              : {}),
            ...(input.remoteIp ? { remoteIp: input.remoteIp } : {}),
          }
        : {}

    const data = await asaasRequest<{ id: string }>('/subscriptions', {
      method: 'POST',
      body: {
        customer: input.customerId,
        billingType: input.billingType,
        value: input.value,
        cycle: input.cycle,
        nextDueDate: input.nextDueDate,
        description: input.description,
        externalReference: input.externalReference,
        ...dadosCartao,
      },
    })
    if (!data?.id) {
      throw new PaymentProviderError('ASAAS_BAD_RESPONSE', 'Resposta sem id ao criar assinatura.', {
        detail: data,
      })
    }
    return { subscriptionId: data.id }
  }

  async createCharge(input: CreateChargeInput): Promise<{ paymentId: string }> {
    const data = await asaasRequest<{ id: string }>('/payments', {
      method: 'POST',
      body: {
        customer: input.customerId,
        billingType: input.billingType,
        value: input.value,
        dueDate: input.dueDate,
        externalReference: input.externalReference,
      },
    })
    if (!data?.id) {
      throw new PaymentProviderError('ASAAS_BAD_RESPONSE', 'Resposta sem id ao criar cobrança.', {
        detail: data,
      })
    }
    return { paymentId: data.id }
  }

  async getPixQrCode(paymentId: string): Promise<PixQrCode> {
    const data = await asaasRequest<{
      encodedImage?: string
      payload?: string
      expirationDate?: string
    }>(`/payments/${encodeURIComponent(paymentId)}/pixQrCode`, { method: 'GET' })

    if (!data?.encodedImage || !data?.payload) {
      throw new PaymentProviderError('ASAAS_BAD_RESPONSE', 'QR Pix incompleto na resposta.', {
        detail: data,
      })
    }
    return {
      encodedImage: data.encodedImage,
      payload: data.payload,
      expirationDate: data.expirationDate ?? '',
    }
  }

  async getFirstSubscriptionPayment(
    subscriptionId: string,
  ): Promise<{ paymentId: string } | null> {
    const data = await asaasRequest<{ data?: Array<{ id: string }> }>(
      `/subscriptions/${encodeURIComponent(subscriptionId)}/payments?limit=1`,
      { method: 'GET' },
    )
    const first = data?.data?.[0]
    return first?.id ? { paymentId: first.id } : null
  }

  async getSubscription(subscriptionId: string): Promise<SubscriptionDetails | null> {
    // 404 = assinatura inexistente/inacessível → null (caller degrada). Demais
    // erros (rede/5xx) sobem como PaymentProviderError para o caller decidir.
    let data: {
      billingType?: string
      cycle?: string
      value?: number
      status?: string
    } | null
    try {
      data = await asaasRequest(`/subscriptions/${encodeURIComponent(subscriptionId)}`, {
        method: 'GET',
      })
    } catch (err) {
      if (err instanceof PaymentProviderError && err.httpStatus === 404) return null
      throw err
    }
    // Campos essenciais ausentes → trata como indisponível (não inventa dado).
    if (!data || !data.billingType || !data.cycle || typeof data.value !== 'number') {
      return null
    }
    return {
      billingType: data.billingType,
      cycle: data.cycle,
      value: data.value,
      status: data.status ?? 'ACTIVE',
    }
  }
}
