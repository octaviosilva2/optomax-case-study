// Testes dos guards de request do paywall (assertActiveOrg vs assertReadableOrg).
// Regressão central do 3º modo: uma org 'expired' PODE ler/exportar (readable)
// mas NÃO pode mutar (active). Mockamos getSessionData (única dependência).

import { describe, it, expect, beforeEach, vi } from 'vitest'

const hoisted = vi.hoisted(() => ({ session: null as unknown }))
vi.mock('@/lib/auth/session', () => ({
  getSessionData: () => Promise.resolve(hoisted.session),
}))

import { assertActiveOrg, assertReadableOrg } from '@/lib/auth-guards'

// O _supabase é ignorado pelos guards (delegam a getSessionData). Dummy serve.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supa = {} as any

function sessionComStatus(plan_status: string) {
  return {
    user: { id: 'u-1', email: 'a@b.com' },
    profile: { org_id: 'org-1' },
    org: { id: 'org-1', plan_status },
  }
}

beforeEach(() => {
  hoisted.session = null
})

describe('assertActiveOrg (mutação)', () => {
  it('401 sem sessão', async () => {
    hoisted.session = null
    const r = await assertActiveOrg(supa)
    expect(r).toMatchObject({ ok: false, status: 401 })
  })

  it.each(['trialing', 'active', 'past_due'])('libera %s', async (s) => {
    hoisted.session = sessionComStatus(s)
    const r = await assertActiveOrg(supa)
    expect(r).toMatchObject({ ok: true, orgId: 'org-1' })
  })

  it.each(['expired', 'suspended', 'cancelled', 'inactive'])('barra %s com 403', async (s) => {
    hoisted.session = sessionComStatus(s)
    const r = await assertActiveOrg(supa)
    expect(r).toMatchObject({ ok: false, status: 403 })
  })
})

describe('assertReadableOrg (leitura/export)', () => {
  it('401 sem sessão', async () => {
    hoisted.session = null
    const r = await assertReadableOrg(supa)
    expect(r).toMatchObject({ ok: false, status: 401 })
  })

  it.each(['trialing', 'active', 'past_due', 'expired'])('libera %s (lê/exporta)', async (s) => {
    hoisted.session = sessionComStatus(s)
    const r = await assertReadableOrg(supa)
    expect(r).toMatchObject({ ok: true, orgId: 'org-1' })
  })

  it.each(['suspended', 'cancelled', 'inactive'])('barra %s com 403', async (s) => {
    hoisted.session = sessionComStatus(s)
    const r = await assertReadableOrg(supa)
    expect(r).toMatchObject({ ok: false, status: 403 })
  })
})

describe('paywall — expired: lê mas não muta (regressão do 3º modo)', () => {
  it('expired passa no guard de leitura e falha no de mutação', async () => {
    hoisted.session = sessionComStatus('expired')
    expect(await assertReadableOrg(supa)).toMatchObject({ ok: true })
    expect(await assertActiveOrg(supa)).toMatchObject({ ok: false, status: 403 })
  })
})
