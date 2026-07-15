// Testes unitários do route handler do webhook ASAAS (POST /api/webhooks/asaas).
//
// Cobrem a lógica TS que os testes SQL (rodados no branch Supabase) NÃO alcançam:
// auth/401, parse tolerante, idempotência por event.id, lookup da org, mapa de
// eventos → transição de plan_status, paid_at, e "500 só em erro real".
//
// Estratégia (mocking-estrategico): mockamos a ÚNICA borda externa do handler —
// o admin client do Supabase (createAdminClient). Nada de rede nem banco. O
// provider ASAAS não é tocado aqui (o webhook não chama o ASAAS; ele só recebe).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// ── Mocks injetados via hoisting (vi.mock é içado) ───────────────────────────
// admin: o admin client do Supabase. subscription/subscriptionThrows: controlam
// o provider ASAAS mockado (o webhook faz UMA leitura ao ASAAS ao persistir a
// linha local de `subscriptions`).
const hoisted = vi.hoisted(() => ({
  admin: null as unknown,
  subscription: null as unknown, // SubscriptionDetails | null devolvido por getSubscription
  subscriptionThrows: false, // simula erro de rede/ASAAS no getSubscription
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => hoisted.admin,
}))
// Mock parcial: mantém PaymentProviderError real (o route usa instanceof) e só
// troca getPaymentProvider por um provider cujo getSubscription é controlável.
vi.mock('@/lib/payments', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/payments')>()
  return {
    ...actual,
    getPaymentProvider: () => ({
      getSubscription: async () => {
        if (hoisted.subscriptionThrows) throw new Error('falha ASAAS simulada')
        return hoisted.subscription
      },
    }),
  }
})

// Importado DEPOIS do vi.mock (que é içado): o route já enxerga o mock.
import { POST } from '@/app/api/webhooks/asaas/route'

// ── Fake do query builder PostgREST-like usado pelo route ────────────────────
// O handler encadeia, entre outros:
//   from('webhook_events').upsert(...).select('id')            -> await => {data,error}
//   from('webhook_events').select('processed_at').eq().single() -> {data,error}
//   from('organizations').select('id').eq().maybeSingle()       -> {data,error}
//   from('payments').upsert(...)                                -> await => {data,error}
//   from('organizations').update(...).eq()                      -> await => {data,error}
// Cada terminal resolve via resolve() e é registrado em `calls` para asserção.

type State = {
  table: string
  ops: string[]
  payload?: Record<string, unknown>
  filters: Record<string, unknown>
}

type MockOpts = {
  eventIsNew?: boolean // INSERT do webhook_events gravou linha nova? (false = duplicata)
  existingProcessedAt?: string | null // processed_at ao reler um evento já existente
  orgByRef?: string | null // org encontrada por externalReference
  orgByCustomer?: string | null // org encontrada por asaas_customer_id
  subscriptionId?: string | null // subscription local JÁ existente (select por asaas_subscription_id)
  subscriptionCreatedId?: string | null // id devolvido pelo upsert de criação da subscription
  planId?: string | null // plano casado por amount_cents (plan_id da subscription)
  errors?: {
    eventInsert?: unknown
    paymentUpsert?: unknown
    orgUpdate?: unknown
    subscriptionUpsert?: unknown
  }
}

function createMockAdmin(opts: MockOpts) {
  const calls: State[] = []

  function resolve(state: State) {
    calls.push(state)
    const { table, ops, filters } = state
    if (table === 'webhook_events') {
      if (ops.includes('upsert')) {
        return { data: opts.eventIsNew ? [{ id: 'evt' }] : [], error: opts.errors?.eventInsert ?? null }
      }
      if (ops.includes('select')) {
        return { data: { processed_at: opts.existingProcessedAt ?? null }, error: null }
      }
      return { data: null, error: null } // update(processed_at)
    }
    if (table === 'organizations') {
      if (ops.includes('update')) return { data: null, error: opts.errors?.orgUpdate ?? null }
      if ('asaas_customer_id' in filters) {
        return { data: opts.orgByCustomer ? { id: opts.orgByCustomer } : null, error: null }
      }
      return { data: opts.orgByRef ? { id: opts.orgByRef } : null, error: null }
    }
    if (table === 'payments') return { data: null, error: opts.errors?.paymentUpsert ?? null }
    if (table === 'subscriptions') {
      // upsert = criação da linha; select = lookup da linha já existente.
      if (ops.includes('upsert')) {
        const err = opts.errors?.subscriptionUpsert ?? null
        const id = opts.subscriptionCreatedId ?? 'sub-new'
        return { data: err ? null : { id }, error: err }
      }
      return { data: opts.subscriptionId ? { id: opts.subscriptionId } : null, error: null }
    }
    if (table === 'plans') {
      return { data: opts.planId ? { id: opts.planId } : null, error: null }
    }
    return { data: null, error: null }
  }

  function makeBuilder(table: string) {
    const state: State = { table, ops: [], filters: {} }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: any = {
      upsert(payload: Record<string, unknown>) {
        state.ops.push('upsert')
        state.payload = payload
        return b
      },
      update(payload: Record<string, unknown>) {
        state.ops.push('update')
        state.payload = payload
        return b
      },
      select() {
        state.ops.push('select')
        return b
      },
      eq(col: string, val: unknown) {
        state.filters[col] = val
        return b
      },
      order() {
        state.ops.push('order')
        return b
      },
      limit() {
        state.ops.push('limit')
        return b
      },
      maybeSingle() {
        return Promise.resolve(resolve(state))
      },
      single() {
        return Promise.resolve(resolve(state))
      },
      // Torna o builder "awaitable" (terminal sem .single): upsert/update/select.
      then(onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) {
        return Promise.resolve(resolve(state)).then(onF, onR)
      },
    }
    return b
  }

  return { client: { from: (table: string) => makeBuilder(table) }, calls }
}

// ── Helpers de request/payload ────────────────────────────────────────────────
const VALID_TOKEN = 'segredo-webhook-teste'

function makeReq(
  body: string | Record<string, unknown>,
  headers: Record<string, string> = { 'asaas-access-token': VALID_TOKEN },
) {
  return new Request('http://localhost/api/webhooks/asaas', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

// Evento ASAAS canônico (campos que o handler lê). `id` raiz = id do EVENTO.
function evt(
  event: string,
  payment: Record<string, unknown> = {},
  id = 'evt_1',
) {
  return {
    id,
    event,
    dateCreated: '2026-07-01 12:00:00',
    payment: {
      id: 'pay_1',
      customer: 'cus_1',
      subscription: 'sub_1',
      value: 99,
      netValue: 96.5,
      billingType: 'PIX',
      status: 'CONFIRMED',
      dueDate: '2026-07-01',
      externalReference: 'org-1',
      ...payment,
    },
  }
}

// Atalhos de asserção sobre os `calls` registrados pelo mock.
const orgUpdate = (calls: State[]) =>
  calls.find((c) => c.table === 'organizations' && c.ops.includes('update'))
const paymentUpsert = (calls: State[]) =>
  calls.find((c) => c.table === 'payments' && c.ops.includes('upsert'))
const subscriptionUpsert = (calls: State[]) =>
  calls.find((c) => c.table === 'subscriptions' && c.ops.includes('upsert'))

beforeEach(() => {
  process.env.ASAAS_WEBHOOK_TOKEN = VALID_TOKEN
  // Provider ASAAS mockado no estado neutro (getSubscription → null → degrada).
  // Testes que exercem a criação da subscription sobrescrevem hoisted.subscription.
  hoisted.subscription = null
  hoisted.subscriptionThrows = false
  // Silencia logs esperados (warn de payload inválido / org não encontrada).
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('webhook ASAAS — auth (falha fechada)', () => {
  it('401 quando o header de token está ausente', async () => {
    const m = createMockAdmin({})
    hoisted.admin = m.client
    const res = await POST(makeReq(evt('PAYMENT_CONFIRMED'), {}))
    expect(res.status).toBe(401)
    expect(m.calls).toHaveLength(0) // nada tocado no banco
  })

  it('401 quando o token não bate', async () => {
    const m = createMockAdmin({})
    hoisted.admin = m.client
    const res = await POST(makeReq(evt('PAYMENT_CONFIRMED'), { 'asaas-access-token': 'errado' }))
    expect(res.status).toBe(401)
    expect(m.calls).toHaveLength(0)
  })

  it('401 quando a env ASAAS_WEBHOOK_TOKEN não está configurada', async () => {
    delete process.env.ASAAS_WEBHOOK_TOKEN
    const m = createMockAdmin({})
    hoisted.admin = m.client
    const res = await POST(makeReq(evt('PAYMENT_CONFIRMED')))
    expect(res.status).toBe(401)
    expect(m.calls).toHaveLength(0)
  })
})

describe('webhook ASAAS — parse tolerante (não reenfileira lixo)', () => {
  it('200 e nada tocado quando o corpo não é JSON', async () => {
    const m = createMockAdmin({})
    hoisted.admin = m.client
    const res = await POST(makeReq('isto nao e json'))
    expect(res.status).toBe(200)
    expect(m.calls).toHaveLength(0)
  })

  it('200 e nada tocado quando falta id/event', async () => {
    const m = createMockAdmin({})
    hoisted.admin = m.client
    const res = await POST(makeReq({ foo: 'bar' }))
    expect(res.status).toBe(200)
    expect(m.calls).toHaveLength(0)
  })
})

describe('webhook ASAAS — transições de plan_status', () => {
  it('PAYMENT_CONFIRMED → active, payment com paid_at, 200', async () => {
    const m = createMockAdmin({ eventIsNew: true, orgByRef: 'org-1' })
    hoisted.admin = m.client
    const res = await POST(makeReq(evt('PAYMENT_CONFIRMED', { status: 'CONFIRMED' })))
    expect(res.status).toBe(200)
    expect(orgUpdate(m.calls)?.payload).toMatchObject({ plan_status: 'active' })
    expect(paymentUpsert(m.calls)?.payload?.paid_at).not.toBeNull()
  })

  it('PAYMENT_RECEIVED → active', async () => {
    const m = createMockAdmin({ eventIsNew: true, orgByRef: 'org-1' })
    hoisted.admin = m.client
    const res = await POST(makeReq(evt('PAYMENT_RECEIVED', { status: 'RECEIVED' })))
    expect(res.status).toBe(200)
    expect(orgUpdate(m.calls)?.payload).toMatchObject({ plan_status: 'active' })
  })

  it('PAYMENT_OVERDUE → past_due, payment sem paid_at', async () => {
    const m = createMockAdmin({ eventIsNew: true, orgByRef: 'org-1' })
    hoisted.admin = m.client
    const res = await POST(makeReq(evt('PAYMENT_OVERDUE', { status: 'OVERDUE' })))
    expect(res.status).toBe(200)
    expect(orgUpdate(m.calls)?.payload).toMatchObject({ plan_status: 'past_due' })
    expect(paymentUpsert(m.calls)?.payload?.paid_at).toBeNull()
  })

  it('evento fora do mapa (PAYMENT_CREATED) grava payment mas NÃO transiciona', async () => {
    const m = createMockAdmin({ eventIsNew: true, orgByRef: 'org-1' })
    hoisted.admin = m.client
    const res = await POST(makeReq(evt('PAYMENT_CREATED', { status: 'PENDING' })))
    expect(res.status).toBe(200)
    expect(paymentUpsert(m.calls)).toBeDefined()
    expect(orgUpdate(m.calls)).toBeUndefined()
  })
})

describe('webhook ASAAS — idempotência (at least once → duplicatas esperadas)', () => {
  it('evento duplicado já processado: 200 sem reefeito (sem transição)', async () => {
    const m = createMockAdmin({ eventIsNew: false, existingProcessedAt: '2026-07-01T12:00:00Z', orgByRef: 'org-1' })
    hoisted.admin = m.client
    const res = await POST(makeReq(evt('PAYMENT_CONFIRMED')))
    expect(res.status).toBe(200)
    expect(orgUpdate(m.calls)).toBeUndefined() // não transiciona de novo
  })

  it('evento duplicado meio-processado (processed_at null): reprocessa e transiciona', async () => {
    const m = createMockAdmin({ eventIsNew: false, existingProcessedAt: null, orgByRef: 'org-1' })
    hoisted.admin = m.client
    const res = await POST(makeReq(evt('PAYMENT_CONFIRMED')))
    expect(res.status).toBe(200)
    expect(orgUpdate(m.calls)?.payload).toMatchObject({ plan_status: 'active' })
  })
})

describe('webhook ASAAS — lookup da org', () => {
  it('acha a org por asaas_customer_id quando não há externalReference', async () => {
    const m = createMockAdmin({ eventIsNew: true, orgByRef: null, orgByCustomer: 'org-2' })
    hoisted.admin = m.client
    const res = await POST(makeReq(evt('PAYMENT_CONFIRMED', { externalReference: null })))
    expect(res.status).toBe(200)
    expect(orgUpdate(m.calls)?.payload).toMatchObject({ plan_status: 'active' })
  })

  it('org inexistente: 200, marca processado e NÃO altera org', async () => {
    const m = createMockAdmin({ eventIsNew: true, orgByRef: null, orgByCustomer: null })
    hoisted.admin = m.client
    const res = await POST(makeReq(evt('PAYMENT_CONFIRMED')))
    expect(res.status).toBe(200)
    expect(orgUpdate(m.calls)).toBeUndefined()
    // marcou o evento como processado (não reenfileira)
    const marcouProcessado = m.calls.some(
      (c) => c.table === 'webhook_events' && c.ops.includes('update') && 'processed_at' in (c.payload ?? {}),
    )
    expect(marcouProcessado).toBe(true)
  })
})

describe('webhook ASAAS — persistência de subscriptions (R5)', () => {
  it('cria a subscription e liga o payment quando a linha ainda não existe', async () => {
    const m = createMockAdmin({
      eventIsNew: true,
      orgByRef: 'org-1',
      subscriptionId: null, // não existe local ainda
      subscriptionCreatedId: 'sub-new',
      planId: 'plan-1',
    })
    hoisted.admin = m.client
    hoisted.subscription = { billingType: 'PIX', cycle: 'MONTHLY', value: 59.97, status: 'ACTIVE' }

    const res = await POST(makeReq(evt('PAYMENT_CONFIRMED', { subscription: 'sub_1' })))
    expect(res.status).toBe(200)

    // Gravou a subscription com os dados do ASAAS + plan casado + valor em centavos.
    const sub = subscriptionUpsert(m.calls)
    expect(sub?.payload).toMatchObject({
      org_id: 'org-1',
      asaas_subscription_id: 'sub_1',
      plan_id: 'plan-1',
      billing_type: 'PIX',
      cycle: 'MONTHLY',
      amount_cents: 5997,
    })
    // E ligou o payment à linha recém-criada.
    expect(paymentUpsert(m.calls)?.payload?.subscription_id).toBe('sub-new')
  })

  it('reusa a subscription existente (não bate no ASAAS, não recria)', async () => {
    const m = createMockAdmin({ eventIsNew: true, orgByRef: 'org-1', subscriptionId: 'sub-existing' })
    hoisted.admin = m.client
    // Se o provider fosse chamado e devolvesse isto, o valor seria outro — prova
    // que o caminho quente NÃO consultou o ASAAS.
    hoisted.subscription = { billingType: 'PIX', cycle: 'MONTHLY', value: 1, status: 'ACTIVE' }

    const res = await POST(makeReq(evt('PAYMENT_CONFIRMED', { subscription: 'sub_1' })))
    expect(res.status).toBe(200)
    expect(subscriptionUpsert(m.calls)).toBeUndefined() // não recriou
    expect(paymentUpsert(m.calls)?.payload?.subscription_id).toBe('sub-existing')
  })

  it('falha ao ler a assinatura no ASAAS: degrada (payment sem vínculo), 200', async () => {
    const m = createMockAdmin({ eventIsNew: true, orgByRef: 'org-1', subscriptionId: null })
    hoisted.admin = m.client
    hoisted.subscriptionThrows = true

    const res = await POST(makeReq(evt('PAYMENT_CONFIRMED', { subscription: 'sub_1' })))
    expect(res.status).toBe(200) // NUNCA 500 — não derruba o recebimento
    expect(subscriptionUpsert(m.calls)).toBeUndefined()
    expect(paymentUpsert(m.calls)?.payload?.subscription_id).toBeNull()
  })

  it('cycle fora do CHECK da tabela não grava subscription (degrada)', async () => {
    const m = createMockAdmin({ eventIsNew: true, orgByRef: 'org-1', subscriptionId: null })
    hoisted.admin = m.client
    hoisted.subscription = { billingType: 'PIX', cycle: 'YEARLY', value: 59.97, status: 'ACTIVE' }

    const res = await POST(makeReq(evt('PAYMENT_CONFIRMED', { subscription: 'sub_1' })))
    expect(res.status).toBe(200)
    expect(subscriptionUpsert(m.calls)).toBeUndefined()
    expect(paymentUpsert(m.calls)?.payload?.subscription_id).toBeNull()
  })

  it('erro ao gravar a subscription degrada para null (não 500)', async () => {
    const m = createMockAdmin({
      eventIsNew: true,
      orgByRef: 'org-1',
      subscriptionId: null,
      errors: { subscriptionUpsert: { message: 'boom' } },
    })
    hoisted.admin = m.client
    hoisted.subscription = { billingType: 'PIX', cycle: 'MONTHLY', value: 59.97, status: 'ACTIVE' }

    const res = await POST(makeReq(evt('PAYMENT_CONFIRMED', { subscription: 'sub_1' })))
    expect(res.status).toBe(200)
    expect(paymentUpsert(m.calls)?.payload?.subscription_id).toBeNull()
  })

  it('pagamento sem campo subscription não cria linha nem consulta o ASAAS', async () => {
    const m = createMockAdmin({ eventIsNew: true, orgByRef: 'org-1' })
    hoisted.admin = m.client

    const res = await POST(makeReq(evt('PAYMENT_CONFIRMED', { subscription: null })))
    expect(res.status).toBe(200)
    expect(subscriptionUpsert(m.calls)).toBeUndefined()
    expect(paymentUpsert(m.calls)?.payload?.subscription_id).toBeNull()
  })
})

describe('webhook ASAAS — 500 só em erro real (deixa o ASAAS reenviar)', () => {
  it('erro ao gravar o evento → 500', async () => {
    const m = createMockAdmin({ eventIsNew: true, errors: { eventInsert: { message: 'boom' } } })
    hoisted.admin = m.client
    const res = await POST(makeReq(evt('PAYMENT_CONFIRMED')))
    expect(res.status).toBe(500)
  })

  it('erro ao gravar o payment → 500', async () => {
    const m = createMockAdmin({ eventIsNew: true, orgByRef: 'org-1', errors: { paymentUpsert: { message: 'boom' } } })
    hoisted.admin = m.client
    const res = await POST(makeReq(evt('PAYMENT_CONFIRMED')))
    expect(res.status).toBe(500)
  })

  it('erro ao transicionar a org → 500', async () => {
    const m = createMockAdmin({ eventIsNew: true, orgByRef: 'org-1', errors: { orgUpdate: { message: 'boom' } } })
    hoisted.admin = m.client
    const res = await POST(makeReq(evt('PAYMENT_CONFIRMED')))
    expect(res.status).toBe(500)
  })
})
