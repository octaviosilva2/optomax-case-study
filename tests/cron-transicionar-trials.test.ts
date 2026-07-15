// Testes do route handler do cron de paywall (GET /api/cron/[job]).
//
// Cobrem: auth por Bearer CRON_SECRET (401 falha fechada), job desconhecido (404),
// o GATE de ativação (PAYWALL_ENABLED off → NO-OP, nenhuma org tocada), e o corte
// real (filtros corretos: só trialing + trial vencido + plan<>'admin').
//
// Estratégia: mockamos a única borda externa (createAdminClient). Nada de banco.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const hoisted = vi.hoisted(() => ({ admin: null as unknown }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => hoisted.admin,
}))

import { GET } from '@/app/api/cron/[job]/route'

// ── Fake do query builder para organizations.update(...).eq().lt().neq().select() ──
type UpdateCall = {
  payload: Record<string, unknown>
  filters: Record<string, { op: string; value: unknown }>
}

function createMockAdmin(opts: { affected?: string[]; error?: unknown } = {}) {
  const updates: UpdateCall[] = []

  function makeBuilder() {
    const call: UpdateCall = { payload: {}, filters: {} }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: any = {
      update(payload: Record<string, unknown>) {
        call.payload = payload
        updates.push(call)
        return b
      },
      eq(col: string, value: unknown) {
        call.filters[col] = { op: 'eq', value }
        return b
      },
      lt(col: string, value: unknown) {
        call.filters[col] = { op: 'lt', value }
        return b
      },
      neq(col: string, value: unknown) {
        call.filters[col] = { op: 'neq', value }
        return b
      },
      select() {
        return b
      },
      then(onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) {
        const result = {
          data: opts.error ? null : (opts.affected ?? []).map((id) => ({ id })),
          error: opts.error ?? null,
        }
        return Promise.resolve(result).then(onF, onR)
      },
    }
    return b
  }

  return { client: { from: () => makeBuilder() }, updates }
}

const SECRET = 'cron-secret-teste'

function makeReq(headers: Record<string, string> = { authorization: `Bearer ${SECRET}` }) {
  return new Request('http://localhost/api/cron/transicionar-trials', {
    method: 'GET',
    headers,
  })
}

function params(job = 'transicionar-trials') {
  return { params: Promise.resolve({ job }) }
}

beforeEach(() => {
  process.env.CRON_SECRET = SECRET
  delete process.env.PAYWALL_ENABLED
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('cron — auth (falha fechada)', () => {
  it('401 quando o header Authorization está ausente', async () => {
    const m = createMockAdmin()
    hoisted.admin = m.client
    const res = await GET(makeReq({}), params())
    expect(res.status).toBe(401)
    expect(m.updates).toHaveLength(0)
  })

  it('401 quando o Bearer não bate', async () => {
    const m = createMockAdmin()
    hoisted.admin = m.client
    const res = await GET(makeReq({ authorization: 'Bearer errado' }), params())
    expect(res.status).toBe(401)
    expect(m.updates).toHaveLength(0)
  })

  it('401 quando CRON_SECRET não está configurado', async () => {
    delete process.env.CRON_SECRET
    const m = createMockAdmin()
    hoisted.admin = m.client
    const res = await GET(makeReq(), params())
    expect(res.status).toBe(401)
    expect(m.updates).toHaveLength(0)
  })
})

describe('cron — job desconhecido', () => {
  it('404 para job inexistente (mesmo autenticado)', async () => {
    const m = createMockAdmin()
    hoisted.admin = m.client
    const res = await GET(makeReq(), params('job-que-nao-existe'))
    expect(res.status).toBe(404)
    expect(m.updates).toHaveLength(0)
  })
})

describe('cron — transicionar-trials: gate de ativação (D1)', () => {
  it('PAYWALL_ENABLED ausente → NO-OP, nenhuma org tocada', async () => {
    const m = createMockAdmin({ affected: ['org-1', 'org-2'] })
    hoisted.admin = m.client
    const res = await GET(makeReq(), params())
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, enabled: false, transitioned: 0 })
    expect(m.updates).toHaveLength(0) // não rodou o UPDATE
  })

  it("PAYWALL_ENABLED != 'true' (ex.: 'false') → NO-OP", async () => {
    process.env.PAYWALL_ENABLED = 'false'
    const m = createMockAdmin({ affected: ['org-1'] })
    hoisted.admin = m.client
    const res = await GET(makeReq(), params())
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ enabled: false, transitioned: 0 })
    expect(m.updates).toHaveLength(0)
  })
})

describe('cron — transicionar-trials: corte ativo (PAYWALL_ENABLED=true)', () => {
  it('transiciona trials vencidos para expired com os filtros corretos', async () => {
    process.env.PAYWALL_ENABLED = 'true'
    const m = createMockAdmin({ affected: ['org-1', 'org-2'] })
    hoisted.admin = m.client
    const res = await GET(makeReq(), params())
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, enabled: true, transitioned: 2 })

    expect(m.updates).toHaveLength(1)
    const call = m.updates[0]
    // seta plan_status = expired
    expect(call.payload).toMatchObject({ plan_status: 'expired' })
    // só trialing
    expect(call.filters['plan_status']).toEqual({ op: 'eq', value: 'trialing' })
    // trial vencido (trial_ends_at < now)
    expect(call.filters['trial_ends_at']?.op).toBe('lt')
    // admin nunca é cortado
    expect(call.filters['plan']).toEqual({ op: 'neq', value: 'admin' })
  })

  it('idempotente na contagem: zero elegíveis → transitioned 0', async () => {
    process.env.PAYWALL_ENABLED = 'true'
    const m = createMockAdmin({ affected: [] })
    hoisted.admin = m.client
    const res = await GET(makeReq(), params())
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ enabled: true, transitioned: 0 })
  })

  it('erro no UPDATE → 500', async () => {
    process.env.PAYWALL_ENABLED = 'true'
    const m = createMockAdmin({ error: { message: 'boom' } })
    hoisted.admin = m.client
    const res = await GET(makeReq(), params())
    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({ ok: false })
  })
})
