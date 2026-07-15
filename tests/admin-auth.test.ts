// Testes do 2FA (TOTP) no login do /admin — R6 do plano CTO.
//
// Cobre o caminho positivo (código válido passa) e, principalmente, os NEGATIVOS
// obrigatórios (PAPEL-DO-CTO §6): código errado, ausente e expirado são barrados;
// o rate limit por e-mail continua valendo; e o fallback do segredo (falha fechada
// em produção, desligado em dev) se comporta como especificado.
//
// Mockamos só as bordas: o admin client do Supabase (rate limit + auditoria) e o
// cookie store do Next. O TOTP real é gerado com a própria lib otpauth.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { TOTP, Secret } from 'otpauth'

// Estado controlável dos mocks entre testes.
const hoisted = vi.hoisted(() => ({
  failCount: 0, // quantas falhas o podeTentar "enxerga" na janela
  cookieSet: null as null | { name: string; value: string },
}))

// Mock do admin client: uma query builder thenable que serve tanto o SELECT count
// (podeTentar) quanto o INSERT (registrarTentativa).
vi.mock('@/lib/supabase/admin', () => {
  function makeChain() {
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: () => chain,
      gte: () => chain,
      insert: () => Promise.resolve({ error: null }),
      // Awaitar a cadeia .select().eq().eq().gte() resolve o count controlável.
      then: (resolve: (v: { count: number }) => unknown) => resolve({ count: hoisted.failCount }),
    }
    return chain
  }
  return { createAdminClient: () => ({ from: () => makeChain() }) }
})

// Mock do cookie store do Next — captura o set pra provar que a sessão foi criada.
vi.mock('next/headers', () => ({
  cookies: () =>
    Promise.resolve({
      set: (name: string, value: string) => {
        hoisted.cookieSet = { name, value }
      },
      get: () => undefined,
      delete: () => {},
    }),
}))

import { loginAdmin } from '@/lib/admin-auth'

// Segredo base32 fixo pros testes (não é o de produção).
const TEST_SECRET = 'JBSWY3DPEHPK3PXP'
const EMAIL = 'admin@optomax.com.br'
const SENHA = 'senha-super-secreta'

// Gera um código TOTP válido pro segredo de teste, opcionalmente deslocado no tempo.
function gerarCodigo(offsetMs = 0): string {
  const totp = new TOTP({
    issuer: 'OptoMax',
    label: 'admin',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(TEST_SECRET),
  })
  return totp.generate({ timestamp: Date.now() + offsetMs })
}

describe('loginAdmin — 2FA (TOTP)', () => {
  beforeEach(() => {
    hoisted.failCount = 0
    hoisted.cookieSet = null
    vi.stubEnv('ADMIN_EMAIL', EMAIL)
    vi.stubEnv('ADMIN_PASSWORD', SENHA)
    vi.stubEnv('ADMIN_TOTP_SECRET', TEST_SECRET)
    vi.stubEnv('NODE_ENV', 'production') // padrão: exige TOTP (falha fechada)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('código correto + credenciais corretas: passa e seta o cookie', async () => {
    await expect(loginAdmin(EMAIL, SENHA, gerarCodigo(), '1.1.1.1', null)).resolves.toBeUndefined()
    expect(hoisted.cookieSet?.name).toBe('optomax_admin')
  })

  it('código errado: barrado (não seta cookie)', async () => {
    await expect(loginAdmin(EMAIL, SENHA, '000000', '1.1.1.1', null)).rejects.toThrow(
      'Credenciais inválidas',
    )
    expect(hoisted.cookieSet).toBeNull()
  })

  it('código ausente (vazio): barrado', async () => {
    await expect(loginAdmin(EMAIL, SENHA, '', '1.1.1.1', null)).rejects.toThrow(
      'Credenciais inválidas',
    )
    expect(hoisted.cookieSet).toBeNull()
  })

  it('código expirado (90s atrás, fora da janela): barrado', async () => {
    // 90s = 3 períodos atrás; window=1 tolera só ±30s → rejeitado.
    await expect(loginAdmin(EMAIL, SENHA, gerarCodigo(-90_000), '1.1.1.1', null)).rejects.toThrow(
      'Credenciais inválidas',
    )
    expect(hoisted.cookieSet).toBeNull()
  })

  it('senha errada mesmo com TOTP válido: barrado (folha os 3 fatores)', async () => {
    await expect(loginAdmin(EMAIL, 'senha-errada', gerarCodigo(), '1.1.1.1', null)).rejects.toThrow(
      'Credenciais inválidas',
    )
    expect(hoisted.cookieSet).toBeNull()
  })

  it('rate limit continua valendo: 5 falhas na janela bloqueia antes de checar', async () => {
    hoisted.failCount = 5
    await expect(loginAdmin(EMAIL, SENHA, gerarCodigo(), '1.1.1.1', null)).rejects.toThrow(
      'Muitas tentativas',
    )
    expect(hoisted.cookieSet).toBeNull()
  })

  it('fallback produção sem ADMIN_TOTP_SECRET: falha FECHADA (login bloqueado)', async () => {
    vi.stubEnv('ADMIN_TOTP_SECRET', '')
    await expect(loginAdmin(EMAIL, SENHA, gerarCodigo(), '1.1.1.1', null)).rejects.toThrow(
      'ADMIN_TOTP_SECRET não configurada',
    )
    expect(hoisted.cookieSet).toBeNull()
  })

  it('fallback dev sem ADMIN_TOTP_SECRET: TOTP desligado, passa só com email+senha', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('ADMIN_TOTP_SECRET', '')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    // Código irrelevante em dev sem segredo — email+senha corretos bastam.
    await expect(loginAdmin(EMAIL, SENHA, '', '1.1.1.1', null)).resolves.toBeUndefined()
    expect(hoisted.cookieSet?.name).toBe('optomax_admin')
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})
