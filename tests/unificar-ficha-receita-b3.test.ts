// Testes do BLOCO 3 — "Unificar Ficha e Receita": ciclo de vida da receita
// AVULSA (rascunho → finalizada). Cobre SPEC §B3.2 (3 actions novas), §B3.4
// (guard de PDF de rascunho) e o plano de teste B3 (SPEC §3): regressão da
// receita VINCULADA a agendamento (criarReceitaRapida) que NÃO pode virar
// rascunho.
//
// Mapa critério → teste:
//   CA19  → criarRascunhoReceita nasce 'rascunho' (não finalizada direto).
//   CA20  → salvarRascunhoReceita é LENIENTE (salva dado fora do range).
//   CA21  → finalizarReceita seta 'finalizada' e valida o mínimo de grau.
//   CA23  → finalizarReceita idempotente (duplo-clique não re-executa).
//   CA24  → regressão: receita de agendamento (quick route) nasce finalizada.
//   edge 5 → receita vazia não finaliza.
//   edge 6 → duplo-clique/corrida não duplica nem re-flipa.
//   edge 7 → clinical_record_id sempre NULL no rascunho (não colide no índice único).
//   edge 8 → PDF de rascunho por URL direta é recusado (404).
//
// Estratégia (mocking-estrategico): mockamos só as bordas externas —
// getSessionData (usado por assertActiveOrg), createClient (client Supabase),
// Sentry (para observar o log de leniência), e as bordas PESADAS do endpoint de
// PDF (renderToStream, TemplatePDF, admin client, logEventServer), que não
// pertencem ao comportamento sob teste. Nenhuma rede/banco/PDF real.

import { describe, it, expect, beforeEach, vi } from 'vitest'

// ── Bordas externas mockadas ────────────────────────────────────────────────
const hoisted = vi.hoisted(() => ({ session: null as unknown }))
vi.mock('@/lib/auth/session', () => ({
  getSessionData: () => Promise.resolve(hoisted.session),
}))

const hoistedDb = vi.hoisted(() => ({ client: null as unknown }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => Promise.resolve(hoistedDb.client),
}))

// As actions chamam revalidatePath — fora de um request Next real (teste puro)
// isso lança "static generation store missing".
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

// Sentry: o auto-save leniente loga um warning quando o schema falha mas salva
// mesmo assim (CA20). Mockamos para observar essa chamada sem enviar nada.
const hoistedSentry = vi.hoisted(() => ({ captureMessage: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureMessage: hoistedSentry.captureMessage }))

// Bordas pesadas do endpoint de PDF (só usadas pelo guard, edge case 8) — o
// comportamento sob teste é o 404 do rascunho, ANTES da renderização; mockar
// evita carregar react-pdf/TemplatePDF/admin (que dependem de env/APIs de Node
// que não importam aqui).
const hoistedPdf = vi.hoisted(() => ({ renderToStream: vi.fn() }))
vi.mock('@react-pdf/renderer', () => ({ renderToStream: hoistedPdf.renderToStream }))
vi.mock('@/lib/pdf/TemplatePDF', () => ({ TemplatePDF: () => null }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn(() => ({})) }))
vi.mock('@/lib/events', () => ({ logEventServer: vi.fn() }))

import {
  criarRascunhoReceita,
  salvarRascunhoReceita,
  finalizarReceita,
} from '@/app/(app)/receitas/actions'
import { POST as postReceitaRapida } from '@/app/api/prescriptions/quick/route'
import { GET as getPrescricaoPdf } from '@/app/api/prescricao/[id]/route'
import { NextRequest } from 'next/server'
import type { NovaPrescricao } from '@/types/clinical'

// zod 4 valida UUID conforme RFC 4122 — gera um UUID v4-like válido a partir de
// um sufixo hex curto (para os campos validados por z.string().uuid()).
function uuid(sufixo: string): string {
  return `00000000-0000-4000-a000-${sufixo.padStart(12, '0')}`
}

function sessionAtiva(orgId = 'org-1', userId = 'user-1') {
  return {
    user: { id: userId, email: 'a@b.com' },
    profile: { org_id: orgId },
    org: { id: orgId, plan_status: 'active' },
  }
}

// NovaPrescricao completa e válida (grau vazio) — base para variações.
const grauVazio: NovaPrescricao = {
  od: { esf: '', cil: '', eixo: '', add: '' },
  oe: { esf: '', cil: '', eixo: '', add: '' },
  tipo_lente: null,
  tratamentos: [],
  observacoes: '',
  validade_meses: null,
}

// NovaPrescricao com dados de grau reais (finaliza / salva).
const grauPreenchido: NovaPrescricao = {
  od: { esf: '-1.50', cil: '-0.75', eixo: '180', add: '+1.00' },
  oe: { esf: '-1.25', cil: '-0.50', eixo: '170', add: '+1.00' },
  tipo_lente: 'multifocal',
  tratamentos: ['antirreflexo'],
  observacoes: 'uso integral',
  validade_meses: 12,
}

beforeEach(() => {
  hoisted.session = sessionAtiva()
  hoistedDb.client = null
  hoistedSentry.captureMessage.mockClear()
  hoistedPdf.renderToStream.mockReset()
})

// ─────────────────────────────────────────────────────────────────────────
// Builder genérico do client Supabase mockado. `rowFor(state)` decide o que a
// query terminal devolve a partir da tabela + ops + filtros acumulados. Cada
// terminal (maybeSingle/single/await) registra a chamada em `calls` para
// inspeção (payload de insert/update, filtros aplicados).
// ─────────────────────────────────────────────────────────────────────────
type Call = {
  table: string
  ops: string[]
  payload?: Record<string, unknown>
  filters: Record<string, unknown>
}

function buildClient(rowFor: (state: Call) => { data: unknown; error: unknown }) {
  const calls: Call[] = []
  function resolve(state: Call) {
    calls.push(state)
    return rowFor(state)
  }
  function from(table: string) {
    const state: Call = { table, ops: [], filters: {} }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: any = {
      select() {
        state.ops.push('select')
        return b
      },
      insert(p: Record<string, unknown>) {
        state.ops.push('insert')
        state.payload = p
        return b
      },
      update(p: Record<string, unknown>) {
        state.ops.push('update')
        state.payload = p
        return b
      },
      eq(col: string, val: unknown) {
        state.filters[col] = val
        return b
      },
      is(col: string, val: unknown) {
        state.filters[col] = { is: val }
        return b
      },
      in(col: string, vals: unknown[]) {
        state.filters[col] = { in: vals }
        return b
      },
      not(col: string, _op: string, val: unknown) {
        state.filters[col] = { not: val }
        return b
      },
      maybeSingle() {
        return Promise.resolve(resolve(state))
      },
      single() {
        return Promise.resolve(resolve(state))
      },
      then(onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) {
        return Promise.resolve(resolve(state)).then(onF, onR)
      },
    }
    return b
  }
  return { client: { from }, calls }
}

// ═════════════════════════════════════════════════════════════════════════
// criarRascunhoReceita (CA19, edge case 7)
// ═════════════════════════════════════════════════════════════════════════
describe('criarRascunhoReceita (CA19 — cria rascunho, não finaliza direto)', () => {
  const patientId = uuid('a1')

  // Client com paciente encontrado + insert que devolve um id.
  function client(opts: { patient?: { id: string } | null; insertId?: string | null } = {}) {
    return buildClient((state) => {
      if (state.table === 'patients') {
        return { data: opts.patient === undefined ? { id: patientId } : opts.patient, error: null }
      }
      if (state.table === 'prescriptions' && state.ops.includes('insert')) {
        const id = opts.insertId === undefined ? 'presc-nova' : opts.insertId
        return { data: id ? { id } : null, error: id ? null : { message: 'insert falhou' } }
      }
      return { data: null, error: null }
    })
  }

  it('CA19 — insere a receita com status "rascunho" (não "finalizada"), avulsa, e devolve o id', async () => {
    const { client: c, calls } = client({ insertId: 'presc-nova' })
    hoistedDb.client = c

    const r = await criarRascunhoReceita(patientId)
    expect(r).toEqual({ error: null, id: 'presc-nova' })

    const insert = calls.find((cc) => cc.table === 'prescriptions' && cc.ops.includes('insert'))
    expect(insert?.payload?.status).toBe('rascunho')
    // Reforço explícito de CA19: NÃO nasce finalizada.
    expect(insert?.payload?.status).not.toBe('finalizada')
    // org_id vem da sessão (nunca do input).
    expect(insert?.payload?.org_id).toBe('org-1')
    expect(insert?.payload?.patient_id).toBe(patientId)
    expect(insert?.payload?.tipo).toBe('oculos')
    expect(insert?.payload?.prescription_type).toBe('quick')
    expect(insert?.payload?.dados_prescricao).toEqual({})
  })

  it('edge case 7 — rascunho nasce com clinical_record_id NULL (NULLs não colidem no índice único)', async () => {
    const { client: c, calls } = client({ insertId: 'presc-nova' })
    hoistedDb.client = c

    await criarRascunhoReceita(patientId)

    const insert = calls.find((cc) => cc.table === 'prescriptions' && cc.ops.includes('insert'))
    // O índice prescriptions_record_tipo_unique é (clinical_record_id, tipo);
    // com clinical_record_id NULL, o Postgres não considera colisão — vários
    // rascunhos avulsos coexistem. Aqui garantimos que a action sempre insere NULL.
    expect(insert?.payload?.clinical_record_id).toBeNull()
  })

  it('rejeita patientId inválido (não-uuid) sem tocar no banco', async () => {
    const { client: c, calls } = client()
    hoistedDb.client = c

    const r = await criarRascunhoReceita('nao-uuid')
    expect(r).toEqual({ error: 'Paciente inválido', id: null })
    expect(calls.length).toBe(0)
  })

  it('paciente de outro org (cross-tenant) → "Paciente não encontrado", sem insert', async () => {
    // Client org-aware: o paciente pertence a org-2; a sessão é org-1. O filtro
    // .eq('org_id', ctx.orgId) não casa → a query volta vazia (efeito do RLS).
    const { client: c, calls } = buildClient((state) => {
      if (state.table === 'patients') {
        if (state.filters['org_id'] !== 'org-2') return { data: null, error: null }
        return { data: { id: patientId }, error: null }
      }
      return { data: null, error: null }
    })
    hoistedDb.client = c

    const r = await criarRascunhoReceita(patientId)
    expect(r).toEqual({ error: 'Paciente não encontrado', id: null })
    expect(calls.some((cc) => cc.table === 'prescriptions')).toBe(false)
  })

  it('sem sessão → erro, sem insert', async () => {
    hoisted.session = null
    const { client: c, calls } = client()
    hoistedDb.client = c

    const r = await criarRascunhoReceita(patientId)
    expect(r.id).toBeNull()
    expect(r.error).toBeTruthy()
    expect(calls.some((cc) => cc.table === 'prescriptions')).toBe(false)
  })
})

// ═════════════════════════════════════════════════════════════════════════
// salvarRascunhoReceita (CA20 — auto-save LENIENTE)
// ═════════════════════════════════════════════════════════════════════════
describe('salvarRascunhoReceita (CA20 — auto-save leniente, não trava)', () => {
  const id = uuid('b1')

  // Client cujo SELECT de prescriptions devolve `prescricao` e cujo UPDATE
  // devolve sucesso (ou erro configurável).
  function client(prescricao: Record<string, unknown> | null) {
    return buildClient((state) => {
      if (state.table === 'prescriptions') {
        if (state.ops.includes('update')) return { data: null, error: null }
        return { data: prescricao, error: null }
      }
      return { data: null, error: null }
    })
  }

  const rascunhoAtivo = { id, status: 'rascunho', clinical_record_id: null }

  it('salva progresso parcial válido → sucesso, grava dados_prescricao e guarda a corrida (status=rascunho)', async () => {
    const { client: c, calls } = client(rascunhoAtivo)
    hoistedDb.client = c

    // Só um campo preenchido — auto-save não exige receita completa.
    const parcial: NovaPrescricao = { ...grauVazio, od: { esf: '-2.00', cil: '', eixo: '', add: '' } }
    const r = await salvarRascunhoReceita(id, parcial)
    expect(r).toEqual({ error: null })

    const update = calls.find((cc) => cc.table === 'prescriptions' && cc.ops.includes('update'))
    expect(update?.payload).toHaveProperty('dados_prescricao')
    // Guard de corrida: o UPDATE só reescreve se ainda é rascunho.
    expect(update?.filters['status']).toBe('rascunho')
    // Escopo por org da sessão.
    expect(update?.filters['org_id']).toBe('org-1')
    // Não loga Sentry quando o schema passa.
    expect(hoistedSentry.captureMessage).not.toHaveBeenCalled()
  })

  it('LENIENTE — dado fora do range (validade_meses=999) NÃO trava: salva mesmo assim e loga no Sentry', async () => {
    const { client: c, calls } = client(rascunhoAtivo)
    hoistedDb.client = c

    // validade_meses fora de 1..60 faz o novaPrescricaoSchema FALHAR — a action
    // não pode bloquear o auto-save por isso (o optometrista preenche aos poucos).
    const foraDoRange: NovaPrescricao = { ...grauPreenchido, validade_meses: 999 }
    const r = await salvarRascunhoReceita(id, foraDoRange)

    // Comportamento observável: salvou (não travou).
    expect(r).toEqual({ error: null })
    const update = calls.find((cc) => cc.table === 'prescriptions' && cc.ops.includes('update'))
    expect(update).toBeTruthy()
    // E registrou o desvio no Sentry (leniência auditável, não silenciosa).
    expect(hoistedSentry.captureMessage).toHaveBeenCalledTimes(1)
    expect(hoistedSentry.captureMessage).toHaveBeenCalledWith(
      expect.stringContaining('salvarRascunhoReceita'),
      expect.objectContaining({ level: 'warning' }),
    )
  })

  it('guard — não sobrescreve receita já FINALIZADA (status != rascunho) → "não encontrado", sem update', async () => {
    const { client: c, calls } = client({ id, status: 'finalizada', clinical_record_id: null })
    hoistedDb.client = c

    const r = await salvarRascunhoReceita(id, grauPreenchido)
    expect(r).toEqual({ error: 'Rascunho de receita não encontrado' })
    expect(calls.some((cc) => cc.table === 'prescriptions' && cc.ops.includes('update'))).toBe(false)
  })

  it('guard — não age em receita VINCULADA (clinical_record_id != null) → "não encontrado", sem update', async () => {
    const { client: c, calls } = client({ id, status: 'rascunho', clinical_record_id: 'record-x' })
    hoistedDb.client = c

    const r = await salvarRascunhoReceita(id, grauPreenchido)
    expect(r).toEqual({ error: 'Rascunho de receita não encontrado' })
    expect(calls.some((cc) => cc.table === 'prescriptions' && cc.ops.includes('update'))).toBe(false)
  })

  it('rascunho não encontrado → erro, sem update', async () => {
    const { client: c, calls } = client(null)
    hoistedDb.client = c

    const r = await salvarRascunhoReceita(id, grauPreenchido)
    expect(r).toEqual({ error: 'Rascunho de receita não encontrado' })
    expect(calls.some((cc) => cc.table === 'prescriptions' && cc.ops.includes('update'))).toBe(false)
  })

  it('id inválido → "ID inválido", sem tocar no banco', async () => {
    const { client: c, calls } = client(rascunhoAtivo)
    hoistedDb.client = c

    const r = await salvarRascunhoReceita('nao-uuid', grauPreenchido)
    expect(r).toEqual({ error: 'ID inválido' })
    expect(calls.length).toBe(0)
  })

  it('guard de tamanho — payload gigante é recusado antes de tocar o banco', async () => {
    const { client: c, calls } = client(rascunhoAtivo)
    hoistedDb.client = c

    // observacoes > 2000 falha o schema → cai na leniência (mantém o bruto) →
    // o JSON bruto (60k) estoura o teto de 50KB do auto-save.
    const gigante = { ...grauPreenchido, observacoes: 'x'.repeat(60_000) } as NovaPrescricao
    const r = await salvarRascunhoReceita(id, gigante)
    expect(r).toEqual({ error: 'Receita muito grande para salvar.' })
    // Recusa acontece antes de qualquer query.
    expect(calls.length).toBe(0)
  })
})

// ═════════════════════════════════════════════════════════════════════════
// finalizarReceita (CA21, edge case 5)
// ═════════════════════════════════════════════════════════════════════════
describe('finalizarReceita (CA21 — finaliza e valida o mínimo de grau)', () => {
  const id = uuid('c1')

  function client(prescricao: Record<string, unknown> | null) {
    return buildClient((state) => {
      if (state.table === 'prescriptions') {
        if (state.ops.includes('update')) return { data: null, error: null }
        return { data: prescricao, error: null }
      }
      return { data: null, error: null }
    })
  }

  it('CA21 — com dado de grau: seta status "finalizada" + finalizada_em, com guard de corrida', async () => {
    const { client: c, calls } = client({
      id,
      status: 'rascunho',
      clinical_record_id: null,
      dados_prescricao: grauPreenchido,
    })
    hoistedDb.client = c

    const r = await finalizarReceita(id)
    expect(r).toEqual({ error: null })

    const update = calls.find((cc) => cc.table === 'prescriptions' && cc.ops.includes('update'))
    expect(update?.payload?.status).toBe('finalizada')
    expect(typeof update?.payload?.finalizada_em).toBe('string')
    // Guard de corrida (edge case 6): só finaliza se ainda é rascunho.
    expect(update?.filters['status']).toBe('rascunho')
    expect(update?.filters['org_id']).toBe('org-1')
  })

  it('CA21 — só tipo_lente preenchido já satisfaz o mínimo (finaliza)', async () => {
    const { client: c, calls } = client({
      id,
      status: 'rascunho',
      clinical_record_id: null,
      dados_prescricao: { ...grauVazio, tipo_lente: 'monofocal' },
    })
    hoistedDb.client = c

    const r = await finalizarReceita(id)
    expect(r).toEqual({ error: null })
    expect(calls.some((cc) => cc.table === 'prescriptions' && cc.ops.includes('update'))).toBe(true)
  })

  it('CA21 — só tratamentos preenchidos já satisfaz o mínimo (finaliza)', async () => {
    const { client: c, calls } = client({
      id,
      status: 'rascunho',
      clinical_record_id: null,
      dados_prescricao: { ...grauVazio, tratamentos: ['antirreflexo'] },
    })
    hoistedDb.client = c

    const r = await finalizarReceita(id)
    expect(r).toEqual({ error: null })
    expect(calls.some((cc) => cc.table === 'prescriptions' && cc.ops.includes('update'))).toBe(true)
  })

  it('edge case 5 — receita VAZIA ({}) não finaliza: erro de validação mínima, sem update', async () => {
    const { client: c, calls } = client({
      id,
      status: 'rascunho',
      clinical_record_id: null,
      dados_prescricao: {},
    })
    hoistedDb.client = c

    const r = await finalizarReceita(id)
    expect(r).toEqual({ error: 'Preencha ao menos um dado de grau antes de finalizar.' })
    expect(calls.some((cc) => cc.table === 'prescriptions' && cc.ops.includes('update'))).toBe(false)
  })

  it('edge case 5 — grau todo em branco (od/oe vazios, sem tipo_lente nem tratamentos) também bloqueia', async () => {
    const { client: c, calls } = client({
      id,
      status: 'rascunho',
      clinical_record_id: null,
      dados_prescricao: grauVazio,
    })
    hoistedDb.client = c

    const r = await finalizarReceita(id)
    expect(r).toEqual({ error: 'Preencha ao menos um dado de grau antes de finalizar.' })
    expect(calls.some((cc) => cc.table === 'prescriptions' && cc.ops.includes('update'))).toBe(false)
  })

  it('id inválido → "ID inválido", sem tocar no banco', async () => {
    const { client: c, calls } = client(null)
    hoistedDb.client = c

    const r = await finalizarReceita('nao-uuid')
    expect(r).toEqual({ error: 'ID inválido' })
    expect(calls.length).toBe(0)
  })

  it('receita não encontrada → "Receita não encontrada"', async () => {
    const { client: c } = client(null)
    hoistedDb.client = c

    const r = await finalizarReceita(id)
    expect(r).toEqual({ error: 'Receita não encontrada' })
  })
})

// ═════════════════════════════════════════════════════════════════════════
// finalizarReceita — idempotência (CA23, edge case 6)
// ═════════════════════════════════════════════════════════════════════════
describe('finalizarReceita — idempotência de duplo-clique (CA23, edge case 6)', () => {
  const id = uuid('c2')

  function client(prescricao: Record<string, unknown> | null) {
    return buildClient((state) => {
      if (state.table === 'prescriptions') {
        if (state.ops.includes('update')) return { data: null, error: null }
        return { data: prescricao, error: null }
      }
      return { data: null, error: null }
    })
  }

  it('já FINALIZADA → no-op bem-sucedido, SEM re-executar o update (não duplica finalizada_em)', async () => {
    const { client: c, calls } = client({
      id,
      status: 'finalizada',
      clinical_record_id: null,
      dados_prescricao: grauPreenchido,
    })
    hoistedDb.client = c

    const r = await finalizarReceita(id)
    expect(r).toEqual({ error: null })
    // O 2º clique não gera outro UPDATE de status/finalizada_em.
    expect(calls.some((cc) => cc.table === 'prescriptions' && cc.ops.includes('update'))).toBe(false)
  })

  it('corrida — o UPDATE de finalização é guardado por status=rascunho (não faz duplo flip)', async () => {
    // Mesmo que dois requests passem pelo SELECT antes de qualquer UPDATE, o
    // .eq('status','rascunho') no UPDATE garante que só um efetivamente flipa.
    const { client: c, calls } = client({
      id,
      status: 'rascunho',
      clinical_record_id: null,
      dados_prescricao: grauPreenchido,
    })
    hoistedDb.client = c

    await finalizarReceita(id)
    const update = calls.find((cc) => cc.table === 'prescriptions' && cc.ops.includes('update'))
    expect(update?.filters['status']).toBe('rascunho')
  })
})

// ═════════════════════════════════════════════════════════════════════════
// finalizarReceita — receita vinculada NÃO passa por esta rota (fronteira CA24)
// ═════════════════════════════════════════════════════════════════════════
describe('finalizarReceita — vinculada a ficha é rejeitada aqui (fronteira CA24)', () => {
  const id = uuid('c3')

  it('rascunho anômalo com clinical_record_id → recusa (a via correta é a finalização da ficha)', async () => {
    const { client: c, calls } = buildClient((state) => {
      if (state.table === 'prescriptions') {
        if (state.ops.includes('update')) return { data: null, error: null }
        return {
          data: { id, status: 'rascunho', clinical_record_id: 'record-x', dados_prescricao: grauPreenchido },
          error: null,
        }
      }
      return { data: null, error: null }
    })
    hoistedDb.client = c

    const r = await finalizarReceita(id)
    expect(r).toEqual({ error: 'Receita vinculada a ficha não é finalizada por aqui.' })
    expect(calls.some((cc) => cc.table === 'prescriptions' && cc.ops.includes('update'))).toBe(false)
  })
})

// ═════════════════════════════════════════════════════════════════════════
// Regressão CA24 — receita VINCULADA a agendamento (criarReceitaRapida / quick
// route) continua nascendo FINALIZADA. O B3 não pode ter injetado 'rascunho'
// nesse fluxo: a receita de agendamento não seta status → cai no DEFAULT
// 'finalizada' da migration.
// ═════════════════════════════════════════════════════════════════════════
describe('Regressão CA24 — receita de agendamento não vira rascunho (quick route)', () => {
  function client(opts: { existingPrescriptionId?: string | null } = {}) {
    return buildClient((state) => {
      if (state.table === 'patients') return { data: { id: state.filters['id'] ?? 'pac-1' }, error: null }
      if (state.table === 'appointments') {
        if (state.ops.includes('update')) return { data: null, error: null }
        return { data: { id: state.filters['id'] ?? 'appt-1' }, error: null }
      }
      if (state.table === 'prescriptions') {
        if (state.ops.includes('insert')) return { data: { id: 'presc-new', ...state.payload }, error: null }
        if (state.ops.includes('update')) return { data: { id: opts.existingPrescriptionId, ...state.payload }, error: null }
        return {
          data: opts.existingPrescriptionId ? { id: opts.existingPrescriptionId } : null,
          error: null,
        }
      }
      return { data: null, error: null }
    })
  }

  function req(body: Record<string, unknown>) {
    return new NextRequest('http://localhost/api/prescriptions/quick', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  const bodyBase = { patient_id: uuid('d1'), tipo: 'oculos', dados_prescricao: grauVazio }

  it('com appointmentId (1ª emissão): o INSERT NÃO seta status "rascunho" (deixa o DEFAULT finalizada)', async () => {
    const { client: c, calls } = client({ existingPrescriptionId: null })
    hoistedDb.client = c

    const res = await postReceitaRapida(req({ ...bodyBase, appointmentId: uuid('d2') }))
    expect(res.status).toBe(201)

    const insert = calls.find((cc) => cc.table === 'prescriptions' && cc.ops.includes('insert'))
    expect(insert).toBeTruthy()
    // Não vira rascunho — a receita vinculada a agendamento nasce finalizada (CA24).
    expect(insert?.payload?.status).not.toBe('rascunho')
    expect(insert?.payload).not.toHaveProperty('status')
  })

  it('sem appointmentId (receita rápida direta): o INSERT também não injeta status "rascunho"', async () => {
    const { client: c, calls } = client()
    hoistedDb.client = c

    const res = await postReceitaRapida(req(bodyBase))
    expect(res.status).toBe(201)

    const insert = calls.find((cc) => cc.table === 'prescriptions' && cc.ops.includes('insert'))
    expect(insert?.payload).not.toHaveProperty('status')
  })
})

// ═════════════════════════════════════════════════════════════════════════
// Guard de PDF de rascunho (edge case 8) — GET /api/prescricao/[id]
// ═════════════════════════════════════════════════════════════════════════
describe('GET /api/prescricao/[id] — guard de PDF de rascunho (edge case 8)', () => {
  const profile = {
    id: 'user-1',
    org_id: 'org-1',
    nome_completo: 'Dra. Ana',
    cro_cboo: 'CRO-123',
    formacoes: '',
    signature_url: null,
  }

  // Client do endpoint: roteia profiles / prescriptions / organizations.
  function client(prescricao: Record<string, unknown> | null) {
    return buildClient((state) => {
      if (state.table === 'profiles') return { data: profile, error: null }
      if (state.table === 'prescriptions') {
        return {
          data: prescricao,
          error: prescricao ? null : { code: 'PGRST116', message: 'not found' },
        }
      }
      if (state.table === 'organizations') {
        return { data: { id: 'org-1', nome_clinica: 'Clínica', endereco: null, telefone: null }, error: null }
      }
      return { data: null, error: null }
    })
  }

  function reqGet(id: string) {
    return new NextRequest(`http://localhost/api/prescricao/${id}`)
  }

  it('rascunho → 404 "Prescrição não encontrada" e NÃO renderiza PDF (não vaza existência do rascunho)', async () => {
    const c = client({
      id: 'presc-r',
      org_id: 'org-1',
      patient_id: 'pac-1',
      clinical_record_id: null,
      prescription_type: 'quick',
      status: 'rascunho',
      dados_prescricao: {},
      created_at: '2026-07-13T10:00:00.000Z',
      updated_at: '2026-07-13T10:00:00.000Z',
      patients: { id: 'pac-1', nome: 'Maria', cpf: null, data_nascimento: null, deleted_at: null },
      clinical_records: null,
    })
    hoistedDb.client = c.client

    const res = await getPrescricaoPdf(reqGet('presc-r'), { params: Promise.resolve({ id: 'presc-r' }) })

    expect(res.status).toBe(404)
    expect(await res.text()).toBe('Prescrição não encontrada')
    // O guard barra ANTES de renderizar — nenhum PDF é gerado para rascunho.
    expect(hoistedPdf.renderToStream).not.toHaveBeenCalled()
  })

  it('finalizada → NÃO é barrada pelo guard: prossegue para a renderização (o guard é específico do rascunho)', async () => {
    // renderToStream falha de propósito: o teste só quer provar que o guard
    // DEIXOU passar a finalizada (chegou na etapa de render, resultando em 500,
    // não no 404 do rascunho).
    hoistedPdf.renderToStream.mockImplementation(() => {
      throw new Error('render-stub')
    })

    const c = client({
      id: 'presc-f',
      org_id: 'org-1',
      patient_id: 'pac-1',
      clinical_record_id: null,
      prescription_type: 'quick',
      status: 'finalizada',
      dados_prescricao: {},
      created_at: '2026-07-13T10:00:00.000Z',
      updated_at: '2026-07-13T10:00:00.000Z',
      patients: { id: 'pac-1', nome: 'Maria', cpf: null, data_nascimento: null, deleted_at: null },
      clinical_records: null,
    })
    hoistedDb.client = c.client

    const res = await getPrescricaoPdf(reqGet('presc-f'), { params: Promise.resolve({ id: 'presc-f' }) })

    // Passou do guard (não é 404); parou só na renderização mockada (500).
    expect(res.status).not.toBe(404)
    expect(res.status).toBe(500)
  })
})
