import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  modoManutencaoLigado,
  usuarioPassaManutencao,
  mensagemManutencao,
} from '@/lib/maintenance'

// Snapshot do env relevante para restaurar entre testes (evita vazar estado).
const ENV_KEYS = [
  'MAINTENANCE_MODE',
  'MAINTENANCE_BYPASS_EMAILS',
  'NEXT_PUBLIC_MAINTENANCE_MESSAGE',
] as const

describe('lib/maintenance', () => {
  let original: Record<string, string | undefined>

  beforeEach(() => {
    original = {}
    for (const k of ENV_KEYS) {
      original[k] = process.env[k]
      delete process.env[k]
    }
  })

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (original[k] === undefined) delete process.env[k]
      else process.env[k] = original[k]
    }
  })

  describe('modoManutencaoLigado', () => {
    it('só liga com exatamente "true"', () => {
      expect(modoManutencaoLigado()).toBe(false) // env ausente
      process.env.MAINTENANCE_MODE = 'false'
      expect(modoManutencaoLigado()).toBe(false)
      process.env.MAINTENANCE_MODE = '1'
      expect(modoManutencaoLigado()).toBe(false) // só 'true' liga (falha fechada)
      process.env.MAINTENANCE_MODE = 'true'
      expect(modoManutencaoLigado()).toBe(true)
    })
  })

  describe('usuarioPassaManutencao', () => {
    it('org admin sempre passa', () => {
      expect(usuarioPassaManutencao({ plan: 'admin', email: 'qualquer@x.com' })).toBe(true)
    })

    it('org beta é bloqueada quando não há bypass de e-mail', () => {
      expect(usuarioPassaManutencao({ plan: 'beta', email: 'cliente@x.com' })).toBe(false)
    })

    it('e-mail listado em MAINTENANCE_BYPASS_EMAILS passa (case-insensitive)', () => {
      process.env.MAINTENANCE_BYPASS_EMAILS = 'caio@optomax.com.br, outro@x.com'
      expect(usuarioPassaManutencao({ plan: 'beta', email: 'CAIO@optomax.com.br' })).toBe(true)
      expect(usuarioPassaManutencao({ plan: 'beta', email: 'naolistado@x.com' })).toBe(false)
    })

    it('e-mail nulo/ausente nunca passa por bypass de e-mail', () => {
      process.env.MAINTENANCE_BYPASS_EMAILS = 'caio@optomax.com.br'
      expect(usuarioPassaManutencao({ plan: 'beta', email: null })).toBe(false)
      expect(usuarioPassaManutencao({ plan: null, email: undefined })).toBe(false)
    })
  })

  describe('mensagemManutencao', () => {
    it('usa fallback quando a env não está definida', () => {
      expect(mensagemManutencao()).toMatch(/voltamos já/i)
    })
    it('usa a mensagem custom da env quando definida', () => {
      process.env.NEXT_PUBLIC_MAINTENANCE_MESSAGE = 'Mensagem específica'
      expect(mensagemManutencao()).toBe('Mensagem específica')
    })
  })
})
