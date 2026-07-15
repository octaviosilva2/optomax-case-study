// Testes da SESSÃO 1 (backend/schema) do bloco "Reorganização Novo Atendimento".
// Cobre o plano de teste da SPEC §8: flips de status (só 1ª emissão), idempotência
// por appointment_id (Q2), receita sem appointment intacta, verificarFichaEmAndamento
// (CA5, escopo Q1=(a)) e a invariante de status de atualizarReceitaRapida (CA4b).
//
// Estratégia (mocking-estrategico): mockamos as duas bordas externas — getSessionData
// (usado por assertActiveOrg) e createClient (o client Supabase). Nenhuma rede/banco real.

import { describe, it, expect, beforeEach, vi } from 'vitest'

const hoisted = vi.hoisted(() => ({ session: null as unknown }))
vi.mock('@/lib/auth/session', () => ({
  getSessionData: () => Promise.resolve(hoisted.session),
}))

const hoistedDb = vi.hoisted(() => ({ client: null as unknown }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => Promise.resolve(hoistedDb.client),
}))

// As actions chamam revalidatePath — fora de um request Next real (como aqui,
// em teste unitário puro) isso lança "static generation store missing".
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { verificarFichaEmAndamento, iniciarReceitaDeAgendamento } from '@/app/(app)/agenda/actions'
import { atualizarReceitaRapida } from '@/app/(app)/receitas/actions'
import { POST as postReceitaRapida } from '@/app/api/prescriptions/quick/route'
import { NextRequest } from 'next/server'

// zod 4 valida UUID conforme RFC 4122 (nibble de versão/variante) — não aceita
// qualquer string "parecida" com UUID. Gera um UUID v4-like válido a partir de
// um sufixo hex curto, para os campos validados por z.string().uuid().
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

// Payload válido de dados_prescricao (novaPrescricaoSchema) — explícito em vez de
// depender de defaults do zod, para não acoplar o teste a detalhes do preprocess.
const dadosPrescricaoValidos = {
  od: { esf: '', cil: '', eixo: '', add: '' },
  oe: { esf: '', cil: '', eixo: '', add: '' },
  tipo_lente: null,
  tratamentos: [] as string[],
  observacoes: '',
  validade_meses: null,
}

beforeEach(() => {
  hoisted.session = sessionAtiva()
  hoistedDb.client = null
})

// ─────────────────────────────────────────────────────────────────────────
// verificarFichaEmAndamento (CA5, escopo Q1=(a): só por appointmentId)
// ─────────────────────────────────────────────────────────────────────────
describe('verificarFichaEmAndamento', () => {
  function client(recordId: string | null) {
    return {
      from: () => {
        const b = {
          select: () => b,
          eq: () => b,
          is: () => b,
          maybeSingle: () => Promise.resolve({ data: recordId ? { id: recordId } : null, error: null }),
        }
        return b
      },
    }
  }

  it('retorna null sem sessão', async () => {
    hoisted.session = null
    hoistedDb.client = client('record-x')
    const r = await verificarFichaEmAndamento({ appointmentId: 'appt-1' })
    expect(r).toEqual({ recordId: null })
  })

  it('retorna null quando não há appointmentId (walk-in/perfil sempre começam do zero)', async () => {
    hoistedDb.client = client('record-x')
    const r = await verificarFichaEmAndamento({ patientId: 'pac-1' })
    expect(r).toEqual({ recordId: null })
  })

  it('retorna o recordId quando há ficha em_andamento vinculada ao agendamento', async () => {
    hoistedDb.client = client('record-123')
    const r = await verificarFichaEmAndamento({ appointmentId: 'appt-1' })
    expect(r).toEqual({ recordId: 'record-123' })
  })

  it('retorna null quando não há ficha em_andamento para o agendamento', async () => {
    hoistedDb.client = client(null)
    const r = await verificarFichaEmAndamento({ appointmentId: 'appt-1' })
    expect(r).toEqual({ recordId: null })
  })
})

// ─────────────────────────────────────────────────────────────────────────
// iniciarReceitaDeAgendamento
// ─────────────────────────────────────────────────────────────────────────
describe('iniciarReceitaDeAgendamento', () => {
  type Call = { table: string; ops: string[]; payload?: Record<string, unknown>; filters: Record<string, unknown> }

  function client(appointment: { id: string; patients: unknown } | null) {
    const calls: Call[] = []
    const from = (table: string) => {
      const state: Call = { table, ops: [], filters: {} }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const b: any = {
        select() {
          state.ops.push('select')
          return b
        },
        update(payload: Record<string, unknown>) {
          state.ops.push('update')
          state.payload = payload
          return b
        },
        eq(col: string, val: unknown) {
          state.filters[col] = val
          return b
        },
        in(col: string, vals: unknown[]) {
          state.filters[col] = { in: vals }
          return b
        },
        single() {
          calls.push(state)
          return Promise.resolve({ data: appointment, error: null })
        },
        then(onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) {
          calls.push(state)
          return Promise.resolve({ data: null, error: null }).then(onF, onR)
        },
      }
      return b
    }
    return { client: { from }, calls }
  }

  it('sem sessão retorna erro e paciente null', async () => {
    hoisted.session = null
    const { client: c } = client(null)
    hoistedDb.client = c
    const r = await iniciarReceitaDeAgendamento('appt-1')
    expect(r.patient).toBeNull()
    expect(r.error).toBeTruthy()
  })

  it('agendamento não encontrado retorna erro', async () => {
    const { client: c } = client(null)
    hoistedDb.client = c
    const r = await iniciarReceitaDeAgendamento('appt-404')
    expect(r).toEqual({ error: 'Agendamento não encontrado', patient: null, appointmentId: 'appt-404' })
  })

  it('flipa o agendamento para em_andamento (só a partir de agendado/confirmado) e retorna o paciente (join como objeto)', async () => {
    const { client: c, calls } = client({ id: 'appt-1', patients: { id: 'pac-1', nome: 'Maria' } })
    hoistedDb.client = c
    const r = await iniciarReceitaDeAgendamento('appt-1')
    expect(r).toEqual({ error: null, patient: { id: 'pac-1', nome: 'Maria' }, appointmentId: 'appt-1' })

    const updateCall = calls.find((cc) => cc.table === 'appointments' && cc.ops.includes('update'))
    expect(updateCall?.payload?.status).toBe('em_andamento')
    expect(updateCall?.filters.status).toEqual({ in: ['agendado', 'confirmado'] })
  })

  it('normaliza join de patients quando o Supabase devolve array', async () => {
    const { client: c } = client({ id: 'appt-1', patients: [{ id: 'pac-2', nome: 'João' }] })
    hoistedDb.client = c
    const r = await iniciarReceitaDeAgendamento('appt-1')
    expect(r.patient).toEqual({ id: 'pac-2', nome: 'João' })
  })

  it('paciente ausente no agendamento retorna erro', async () => {
    const { client: c } = client({ id: 'appt-1', patients: null })
    hoistedDb.client = c
    const r = await iniciarReceitaDeAgendamento('appt-1')
    expect(r.error).toBe('Paciente não encontrado')
    expect(r.patient).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────
// POST /api/prescriptions/quick — extensão com appointmentId (flip + idempotência)
// ─────────────────────────────────────────────────────────────────────────
describe('POST /api/prescriptions/quick (criarReceitaRapida estendida)', () => {
  type Call = { table: string; ops: string[]; payload?: Record<string, unknown>; filters: Record<string, unknown> }

  type Opts = {
    pacienteOk?: boolean
    appointmentOk?: boolean
    existingPrescriptionId?: string | null
  }

  function client(opts: Opts) {
    const calls: Call[] = []
    function resolve(state: Call) {
      calls.push(state)
      const { table, ops, filters, payload } = state
      if (table === 'patients') {
        return { data: opts.pacienteOk === false ? null : { id: filters.id ?? 'pac-1' }, error: null }
      }
      if (table === 'appointments') {
        // update = flip de status (não retorna linha, só confirma execução)
        if (ops.includes('update')) return { data: null, error: null }
        return { data: opts.appointmentOk === false ? null : { id: filters.id ?? 'appt-1' }, error: null }
      }
      if (table === 'prescriptions') {
        if (ops.includes('insert')) {
          return { data: { id: 'presc-new', ...payload }, error: null }
        }
        if (ops.includes('update')) {
          return { data: { id: opts.existingPrescriptionId, ...payload }, error: null }
        }
        // select — lookup de receita ativa existente para o appointment_id
        return { data: opts.existingPrescriptionId ? { id: opts.existingPrescriptionId } : null, error: null }
      }
      return { data: null, error: null }
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
          state.payload = { ...state.payload, ...p }
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

  function req(body: Record<string, unknown>) {
    return new NextRequest('http://localhost/api/prescriptions/quick', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  const bodyBase = { patient_id: uuid('1'), tipo: 'oculos', dados_prescricao: dadosPrescricaoValidos }

  it('sem appointmentId: comportamento atual intacto (appointment_id null, nenhum status mexido)', async () => {
    const { client: c, calls } = client({ pacienteOk: true })
    hoistedDb.client = c

    const res = await postReceitaRapida(req(bodyBase))
    expect(res.status).toBe(201)

    const insertCall = calls.find((cc) => cc.table === 'prescriptions' && cc.ops.includes('insert'))
    expect(insertCall?.payload?.appointment_id).toBeNull()
    expect(calls.some((cc) => cc.table === 'appointments')).toBe(false)
  })

  it('com appointmentId (1ª emissão): grava appointment_id e flipa o agendamento para concluido', async () => {
    const appointmentId = uuid('2')
    const { client: c, calls } = client({ pacienteOk: true, appointmentOk: true, existingPrescriptionId: null })
    hoistedDb.client = c

    const res = await postReceitaRapida(req({ ...bodyBase, appointmentId }))
    expect(res.status).toBe(201)

    const insertCall = calls.find((cc) => cc.table === 'prescriptions' && cc.ops.includes('insert'))
    expect(insertCall?.payload?.appointment_id).toBe(appointmentId)

    const flipCall = calls.find((cc) => cc.table === 'appointments' && cc.ops.includes('update'))
    expect(flipCall?.payload?.status).toBe('concluido')
    expect(flipCall?.filters.status).toEqual({ in: ['agendado', 'confirmado', 'em_andamento'] })
  })

  it('idempotência: 2ª emissão para o mesmo appointment_id reaproveita a receita (não duplica, não re-flipa)', async () => {
    const appointmentId = uuid('3')
    const { client: c, calls } = client({ pacienteOk: true, appointmentOk: true, existingPrescriptionId: 'presc-old' })
    hoistedDb.client = c

    const res = await postReceitaRapida(req({ ...bodyBase, appointmentId }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe('presc-old')

    expect(calls.some((cc) => cc.table === 'prescriptions' && cc.ops.includes('insert'))).toBe(false)
    expect(calls.some((cc) => cc.table === 'appointments' && cc.ops.includes('update'))).toBe(false)
  })

  it('agendamento não encontrado (cross-tenant/inexistente) retorna 404 e não toca em prescriptions', async () => {
    const { client: c, calls } = client({ pacienteOk: true, appointmentOk: false })
    hoistedDb.client = c

    const res = await postReceitaRapida(req({ ...bodyBase, appointmentId: uuid('4') }))
    expect(res.status).toBe(404)
    expect(calls.some((cc) => cc.table === 'prescriptions')).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────
// atualizarReceitaRapida (CA4b) — edita a MESMA receita quick/standalone
// ─────────────────────────────────────────────────────────────────────────
describe('atualizarReceitaRapida', () => {
  type Call = { table: string; ops: string[]; payload?: Record<string, unknown>; filters: Record<string, unknown> }

  function client(prescricao: { id: string; clinical_record_id: string | null } | null) {
    const calls: Call[] = []
    const from = (table: string) => {
      const state: Call = { table, ops: [], filters: {} }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const b: any = {
        select() {
          state.ops.push('select')
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
        is() {
          return b
        },
        maybeSingle() {
          calls.push(state)
          return Promise.resolve({ data: prescricao, error: null })
        },
        then(onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) {
          calls.push(state)
          return Promise.resolve({ data: null, error: null }).then(onF, onR)
        },
      }
      return b
    }
    return { client: { from }, calls }
  }

  const prescricaoId = uuid('5')

  it('rejeita input inválido sem tocar no banco', async () => {
    const r = await atualizarReceitaRapida({ prescricaoId: 'nao-uuid', dados_prescricao: dadosPrescricaoValidos })
    expect(r).toEqual({ error: 'Dados inválidos' })
  })

  it('sem sessão retorna erro', async () => {
    hoisted.session = null
    const { client: c } = client({ id: prescricaoId, clinical_record_id: null })
    hoistedDb.client = c
    const r = await atualizarReceitaRapida({ prescricaoId, dados_prescricao: dadosPrescricaoValidos })
    expect(r.error).toBeTruthy()
  })

  it('receita não encontrada retorna erro', async () => {
    const { client: c } = client(null)
    hoistedDb.client = c
    const r = await atualizarReceitaRapida({ prescricaoId, dados_prescricao: dadosPrescricaoValidos })
    expect(r).toEqual({ error: 'Receita não encontrada' })
  })

  // B2.1 (CA13–14): receita vinculada a ficha deixou de ser rejeitada aqui —
  // agora edita e reflete na ficha. Cobertura em unificar-ficha-receita-b2.test.ts.

  it('atualiza dados_prescricao da receita quick/standalone (não mexe em appointments)', async () => {
    const { client: c, calls } = client({ id: prescricaoId, clinical_record_id: null })
    hoistedDb.client = c
    const r = await atualizarReceitaRapida({ prescricaoId, dados_prescricao: dadosPrescricaoValidos })
    expect(r).toEqual({ error: null })

    const updateCall = calls.find((cc) => cc.table === 'prescriptions' && cc.ops.includes('update'))
    expect(updateCall).toBeTruthy()
    expect(calls.some((cc) => cc.table === 'appointments')).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────
// Guard de duplo-clique SEQUENCIAL na receita-de-agendamento (STORY edge case 1)
//
// Diferença para o teste de idempotência acima: lá a receita "existente" era
// injetada de fora. Aqui um mock de banco COM ESTADO persiste o insert da 1ª
// chamada, e a 2ª chamada percorre a rota inteira de novo — provando que o
// lookup por appointment_id reaproveita a MESMA linha ponta a ponta (o caminho
// real de um usuário que clica/reenvia duas vezes em sequência).
//
// Cobre também a invariante de status (CA4b): o flip agendamento→concluido só
// pode acontecer na 1ª emissão, nunca na 2ª.
// ─────────────────────────────────────────────────────────────────────────
describe('POST /api/prescriptions/quick — duplo-clique sequencial (guard de corrida)', () => {
  // Mock de banco com estado compartilhado entre as duas chamadas POST.
  // Persiste as prescriptions inseridas e conta os flips de status do
  // agendamento, para verificar comportamento real de reaproveitamento.
  function statefulClient() {
    const state = {
      prescriptions: [] as Array<{
        id: string
        appointment_id: string | null
        deleted_at: string | null
        tipo: unknown
        dados_prescricao: unknown
      }>,
      flips: 0, // quantas vezes appointments.status foi atualizado (flip →concluido)
      seq: 0,
    }

    type St = { table: string; ops: string[]; filters: Record<string, unknown>; payload?: Record<string, unknown> }

    function resolve(st: St) {
      const { table, ops, filters, payload } = st
      if (table === 'patients') {
        return { data: { id: filters.id ?? 'pac-1' }, error: null }
      }
      if (table === 'appointments') {
        if (ops.includes('update')) {
          // Flip de status — conta cada execução (o filtro .in é do lado do banco).
          state.flips += 1
          return { data: null, error: null }
        }
        return { data: { id: filters.id ?? 'appt-1' }, error: null }
      }
      if (table === 'prescriptions') {
        if (ops.includes('insert')) {
          const row = {
            id: `presc-${++state.seq}`,
            appointment_id: (payload?.appointment_id ?? null) as string | null,
            deleted_at: null as string | null,
            tipo: payload?.tipo,
            dados_prescricao: payload?.dados_prescricao,
          }
          state.prescriptions.push(row)
          return { data: row, error: null }
        }
        if (ops.includes('update')) {
          const row = state.prescriptions.find((p) => p.id === filters.id)
          if (row) Object.assign(row, payload)
          return { data: row ?? null, error: null }
        }
        // select — lookup da receita ativa existente para aquele appointment_id
        const found = state.prescriptions.find(
          (p) => p.appointment_id === filters.appointment_id && p.deleted_at === null,
        )
        return { data: found ? { id: found.id } : null, error: null }
      }
      return { data: null, error: null }
    }

    function from(table: string) {
      const st: St = { table, ops: [], filters: {} }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const b: any = {
        select() {
          st.ops.push('select')
          return b
        },
        insert(p: Record<string, unknown>) {
          st.ops.push('insert')
          st.payload = p
          return b
        },
        update(p: Record<string, unknown>) {
          st.ops.push('update')
          st.payload = { ...(st.payload ?? {}), ...p }
          return b
        },
        eq(col: string, val: unknown) {
          st.filters[col] = val
          return b
        },
        is(col: string, val: unknown) {
          st.filters[col] = { is: val }
          return b
        },
        in(col: string, vals: unknown[]) {
          st.filters[col] = { in: vals }
          return b
        },
        maybeSingle() {
          return Promise.resolve(resolve(st))
        },
        single() {
          return Promise.resolve(resolve(st))
        },
        then(onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) {
          return Promise.resolve(resolve(st)).then(onF, onR)
        },
      }
      return b
    }
    return { client: { from }, state }
  }

  function req(body: Record<string, unknown>) {
    return new NextRequest('http://localhost/api/prescriptions/quick', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  const bodyBase = { patient_id: uuid('1'), tipo: 'oculos', dados_prescricao: dadosPrescricaoValidos }

  it('2ª emissão em sequência para o mesmo agendamento reaproveita a receita, não duplica e não re-flipa o status', async () => {
    const appointmentId = uuid('7')
    const { client: c, state } = statefulClient()
    hoistedDb.client = c

    // 1ª emissão: cria a receita e flipa o agendamento para concluido.
    const res1 = await postReceitaRapida(req({ ...bodyBase, appointmentId }))
    expect(res1.status).toBe(201)
    const body1 = await res1.json()

    // 2ª emissão (duplo-clique / reenvio): percorre a rota de novo.
    const res2 = await postReceitaRapida(req({ ...bodyBase, appointmentId }))
    expect(res2.status).toBe(200)
    const body2 = await res2.json()

    // Mesma linha — nenhuma duplicata criada.
    expect(body2.id).toBe(body1.id)
    expect(state.prescriptions.length).toBe(1)
    // Flip de status aconteceu exatamente UMA vez (invariante CA4b).
    expect(state.flips).toBe(1)
  })
})
