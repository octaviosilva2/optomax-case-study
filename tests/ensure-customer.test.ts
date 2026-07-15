// Testes do garantirCustomerAsaas — a auto-recuperação de customer ASAAS órfão.
//
// Cobre os 3 caminhos: sem ID salvo (cria), ID válido (atualiza e reusa),
// ID órfão/404 (recria). Mockamos só o PaymentProvider — nada de rede.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { garantirCustomerAsaas } from '@/lib/payments/ensure-customer'
import { PaymentProviderError } from '@/lib/payments/errors'
import type { PaymentProvider } from '@/lib/payments/types'

// Provider fake: só os métodos usados pelo helper. Os demais são stubs que
// falham se forem chamados (o helper não deve tocá-los).
function makeProvider(overrides: Partial<PaymentProvider> = {}): PaymentProvider {
  return {
    createCustomer: vi.fn(async () => ({ customerId: 'cus_NEW' })),
    updateCustomer: vi.fn(async () => undefined),
    createSubscription: vi.fn(async () => {
      throw new Error('não deve ser chamado')
    }),
    createCharge: vi.fn(async () => {
      throw new Error('não deve ser chamado')
    }),
    getPixQrCode: vi.fn(async () => {
      throw new Error('não deve ser chamado')
    }),
    getFirstSubscriptionPayment: vi.fn(async () => null),
    getSubscription: vi.fn(async () => {
      throw new Error('não deve ser chamado')
    }),
    ...overrides,
  }
}

const baseArgs = {
  name: 'Clínica Teste',
  email: 'teste@optomax.com.br',
  cpfCnpj: '12345678909',
}

describe('garantirCustomerAsaas', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('cria um novo customer quando não há ID salvo', async () => {
    const provider = makeProvider()
    const id = await garantirCustomerAsaas(provider, { customerId: null, ...baseArgs })

    expect(id).toBe('cus_NEW')
    expect(provider.createCustomer).toHaveBeenCalledWith({
      name: baseArgs.name,
      email: baseArgs.email,
      cpfCnpj: baseArgs.cpfCnpj,
    })
    expect(provider.updateCustomer).not.toHaveBeenCalled()
  })

  it('reusa o ID existente e atualiza o cpfCnpj', async () => {
    const provider = makeProvider()
    const id = await garantirCustomerAsaas(provider, { customerId: 'cus_OLD', ...baseArgs })

    expect(id).toBe('cus_OLD')
    expect(provider.updateCustomer).toHaveBeenCalledWith('cus_OLD', { cpfCnpj: baseArgs.cpfCnpj })
    expect(provider.createCustomer).not.toHaveBeenCalled()
  })

  it('recria o customer quando o ID salvo é órfão (404)', async () => {
    const provider = makeProvider({
      updateCustomer: vi.fn(async () => {
        throw new PaymentProviderError('ASAAS_HTTP_404', 'not found', { httpStatus: 404 })
      }),
    })

    const id = await garantirCustomerAsaas(provider, { customerId: 'cus_ORPHAN', ...baseArgs })

    expect(id).toBe('cus_NEW')
    expect(provider.updateCustomer).toHaveBeenCalledOnce()
    expect(provider.createCustomer).toHaveBeenCalledWith({
      name: baseArgs.name,
      email: baseArgs.email,
      cpfCnpj: baseArgs.cpfCnpj,
    })
  })

  it('propaga erros que não são 404 (não mascara falha real)', async () => {
    const provider = makeProvider({
      updateCustomer: vi.fn(async () => {
        throw new PaymentProviderError('ASAAS_HTTP_500', 'boom', { httpStatus: 500 })
      }),
    })

    await expect(
      garantirCustomerAsaas(provider, { customerId: 'cus_OLD', ...baseArgs }),
    ).rejects.toBeInstanceOf(PaymentProviderError)
    expect(provider.createCustomer).not.toHaveBeenCalled()
  })
})
