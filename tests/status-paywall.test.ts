// Testes unitários dos guards de acesso do paywall (Fase 2).
// Cobrem a matriz dos 3 modos: acesso pleno (orgPodeAcessar), leitura/export
// (orgPodeLer) e read-only (orgEhReadOnly). Funções puras — sem mock.

import { describe, it, expect } from 'vitest'
import {
  PLANS,
  PLAN_LABELS,
  normalizePlan,
  planoEhIlimitado,
  planoEhPago,
  planoEhFree,
  planoEhCortesia,
  orgPodeAcessar,
  orgPodeLer,
  orgEhReadOnly,
  PLAN_STATUSES,
} from '@/lib/utils/status'

describe('planos — modelo admin/free/pago (Fase 5)', () => {
  it('PLANS é exatamente admin/free/pago', () => {
    expect([...PLANS].sort()).toEqual(['admin', 'free', 'pago'])
  })
  it('PLAN_LABELS cobre todos os PLANS', () => {
    for (const p of PLANS) {
      expect(PLAN_LABELS[p]).toBeTruthy()
    }
  })
  it('normalizePlan traduz o legado beta→free e base→pago', () => {
    expect(normalizePlan('beta')).toBe('free')
    expect(normalizePlan('base')).toBe('pago')
    expect(normalizePlan('admin')).toBe('admin')
    expect(normalizePlan('free')).toBe('free')
    expect(normalizePlan('pago')).toBe('pago')
    // Desconhecido/nulo → free (estado conservador).
    expect(normalizePlan(null)).toBe('free')
    expect(normalizePlan('qualquer')).toBe('free')
  })
  it('helpers de plano respeitam a normalização do legado', () => {
    expect(planoEhIlimitado('admin')).toBe(true)
    expect(planoEhPago('base')).toBe(true) // legado base → pago
    expect(planoEhFree('beta')).toBe(true) // legado beta → free
    expect(planoEhPago('beta')).toBe(false)
  })
  it('planoEhCortesia = free sem prazo de trial', () => {
    expect(planoEhCortesia('free', null)).toBe(true)
    expect(planoEhCortesia('beta', null)).toBe(true) // legado
    expect(planoEhCortesia('free', '2026-12-01')).toBe(false) // tem prazo
    expect(planoEhCortesia('pago', null)).toBe(false)
  })
})

describe('paywall — orgPodeAcessar (mutação: só trialing/active/past_due)', () => {
  it.each(['trialing', 'active', 'past_due'])('libera %s', (s) => {
    expect(orgPodeAcessar(s)).toBe(true)
  })
  it.each(['inactive', 'suspended', 'cancelled', 'expired'])('barra %s', (s) => {
    expect(orgPodeAcessar(s)).toBe(false)
  })
  it('barra null/undefined/desconhecido', () => {
    expect(orgPodeAcessar(null)).toBe(false)
    expect(orgPodeAcessar(undefined)).toBe(false)
    expect(orgPodeAcessar('qualquer')).toBe(false)
  })
})

describe('paywall — orgPodeLer (leitura/export: + expired)', () => {
  it.each(['trialing', 'active', 'past_due', 'expired'])('libera %s', (s) => {
    expect(orgPodeLer(s)).toBe(true)
  })
  it.each(['inactive', 'suspended', 'cancelled'])('barra %s (intenção de apagar dados)', (s) => {
    expect(orgPodeLer(s)).toBe(false)
  })
  it('barra null/undefined', () => {
    expect(orgPodeLer(null)).toBe(false)
    expect(orgPodeLer(undefined)).toBe(false)
  })
})

describe('paywall — orgEhReadOnly (pode ler mas não mutar)', () => {
  it("só 'expired' é read-only hoje", () => {
    expect(orgEhReadOnly('expired')).toBe(true)
  })
  it.each(['trialing', 'active', 'past_due'])('%s NÃO é read-only (acesso pleno)', (s) => {
    expect(orgEhReadOnly(s)).toBe(false)
  })
  it.each(['inactive', 'suspended', 'cancelled'])('%s NÃO é read-only (bloqueio total)', (s) => {
    expect(orgEhReadOnly(s)).toBe(false)
  })
})

describe('paywall — coerência entre os 3 modos', () => {
  it('todo status com acesso pleno também pode ler', () => {
    for (const s of PLAN_STATUSES) {
      if (orgPodeAcessar(s)) expect(orgPodeLer(s)).toBe(true)
    }
  })
  it('read-only ⇔ (pode ler E não pode acessar)', () => {
    for (const s of PLAN_STATUSES) {
      expect(orgEhReadOnly(s)).toBe(orgPodeLer(s) && !orgPodeAcessar(s))
    }
  })
})
