// Testes do BLOCO 2 — "Unificar Ficha e Receita": sincronização bidirecional
// (edição + cascata de arquivamento), sem schema. Cobre SPEC §B2.1 (CA13–14) e
// §B2.2 (CA15–18).
//
// SESSÃO 1 (backend): merge da edição, cascata de arquivar/restaurar, corrida.
// SESSÃO 3 (testes+validação): complementa com (a) ida-e-volta ficha↔receita
// que não diverge (CA13 + edge case 1 + risco "divergência" do SPEC §2, com
// dados de grau realistas) e (b) isolamento cross-tenant (org_id sempre da
// sessão) — editar/arquivar/restaurar receita de outro org é barrado.
//
// Estratégia (mocking-estrategico): mockamos as bordas externas — getSessionData,
// createClient e o módulo agenda/actions (arquivarAtendimento/restaurarAtendimento
// são testados no seu próprio arquivo de origem; aqui só verificamos que
// arquivarReceita/restaurarReceita DELEGAM pra eles corretamente). Nenhuma rede/banco real.

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

const hoistedAgenda = vi.hoisted(() => ({
  arquivarAtendimento: vi.fn(async () => ({ error: null }) as { error: string | null }),
  restaurarAtendimento: vi.fn(async () => ({ error: null }) as { error: string | null }),
}))
vi.mock('@/app/(app)/agenda/actions', () => ({
  arquivarAtendimento: hoistedAgenda.arquivarAtendimento,
  restaurarAtendimento: hoistedAgenda.restaurarAtendimento,
}))

import {
  atualizarReceitaRapida,
  arquivarReceita,
  restaurarReceita,
} from '@/app/(app)/receitas/actions'
// Schema real compartilhado por prescriptions.dados_prescricao e
// clinical_records.clinical_data.nova_prescricao — usado no teste de não-divergência.
import { novaPrescricaoSchema } from '@/lib/validations/clinical'

// zod 4 valida UUID conforme RFC 4122 — gera um UUID v4-like válido a partir
// de um sufixo hex curto, para os campos validados por z.string().uuid().
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

// Payload válido de dados_prescricao (novaPrescricaoSchema).
const dadosPrescricaoValidos = {
  od: { esf: '', cil: '', eixo: '', add: '' },
  oe: { esf: '', cil: '', eixo: '', add: '' },
  tipo_lente: null,
  tratamentos: [] as string[],
  observacoes: '',
  validade_meses: null,
}

// Payload realista, já em forma canônica do novaPrescricaoSchema (strings nos
// campos de dioptria, enum válido, validade inteira) — parse é idempotente.
// Reutilizado pelo teste de não-divergência (payload) e pelo de round-trip
// real (relê do "banco" mockado após o UPDATE).
const grauPreenchido = {
  od: { esf: '-1.50', cil: '-0.75', eixo: '180', add: '+1.00' },
  oe: { esf: '-1.25', cil: '-0.50', eixo: '170', add: '+1.00' },
  tipo_lente: 'multifocal',
  tratamentos: ['antirreflexo', 'filtro_azul'],
  observacoes: 'usar em tempo integral',
  validade_meses: 12,
}

beforeEach(() => {
  hoisted.session = sessionAtiva()
  hoistedDb.client = null
  hoistedAgenda.arquivarAtendimento.mockClear()
  hoistedAgenda.restaurarAtendimento.mockClear()
  hoistedAgenda.arquivarAtendimento.mockResolvedValue({ error: null })
  hoistedAgenda.restaurarAtendimento.mockResolvedValue({ error: null })
})

// ─────────────────────────────────────────────────────────────────────────
// Mock de banco genérico por tabela — devolve fixtures fixas para
// 'prescriptions' e 'clinical_records', registrando cada chamada para
// inspeção (payload de update, tabela tocada).
// ─────────────────────────────────────────────────────────────────────────
type Call = { table: string; ops: string[]; payload?: Record<string, unknown>; filters: Record<string, unknown> }

type Fixtures = {
  prescricao?: { id: string; clinical_record_id: string | null } | null
  clinicalRecord?: { clinical_data?: unknown; deleted_at?: string | null } | null
}

// Builder genérico do client Supabase mockado. `rowFor(state)` decide o que a
// query devolve (data/error) a partir da tabela + filtros acumulados. Cada
// chamada terminal (maybeSingle/await) é registrada em `calls` para inspeção.
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
      not(col: string, _op: string, val: unknown) {
        state.filters[col] = { not: val }
        return b
      },
      maybeSingle() {
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

// Client com fixtures fixas por tabela (ignora org) — usado pela maioria dos
// testes, onde o isolamento cross-tenant não é o foco.
function client(fixtures: Fixtures) {
  return buildClient((state) => {
    if (state.table === 'prescriptions') {
      return { data: fixtures.prescricao ?? null, error: null }
    }
    if (state.table === 'clinical_records') {
      return { data: fixtures.clinicalRecord ?? null, error: null }
    }
    return { data: null, error: null }
  })
}

// Fixtures com dono (org) por linha — reproduz o isolamento cross-tenant: a
// linha só é "vista" quando o filtro .eq('org_id', X) casa com o org dono.
// Simula o efeito do filtro org_id + RLS no banco real (sessão de org-1 não
// enxerga linha de org-2 → a query volta vazia).
type FixturesOrg = {
  prescricao?: { id: string; clinical_record_id: string | null; org: string } | null
  clinicalRecord?: { clinical_data?: unknown; deleted_at?: string | null; org: string } | null
}

function clientOrgAware(fixtures: FixturesOrg) {
  return buildClient((state) => {
    const filtroOrg = state.filters['org_id']
    if (state.table === 'prescriptions') {
      const row = fixtures.prescricao
      if (!row || row.org !== filtroOrg) return { data: null, error: null }
      return { data: { id: row.id, clinical_record_id: row.clinical_record_id }, error: null }
    }
    if (state.table === 'clinical_records') {
      const row = fixtures.clinicalRecord
      if (!row || row.org !== filtroOrg) return { data: null, error: null }
      return {
        data: { clinical_data: row.clinical_data ?? {}, deleted_at: row.deleted_at ?? null },
        error: null,
      }
    }
    return { data: null, error: null }
  })
}

// Mock de banco "com estado real" — UPDATE grava de fato num objeto
// persistente (por tabela) e um SELECT subsequente relê ESSE estado, não o
// payload capturado no ato do envio. Fecha o achado do validator (B2-S3): a
// ação não relê a linha após o UPDATE nos outros testes (que só comparam o
// payload enviado); aqui a asserção só passa se o "banco" foi de fato
// alterado pelo UPDATE anterior.
function statefulClient(seed: {
  prescricao: { id: string; clinical_record_id: string | null }
  clinicalRecord: { clinical_data: Record<string, unknown> }
}) {
  const db = {
    prescricao: { ...seed.prescricao } as Record<string, unknown>,
    clinicalRecord: { ...seed.clinicalRecord } as Record<string, unknown>,
  }

  function from(table: string) {
    let pendingUpdate: Record<string, unknown> | undefined
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: any = {
      select() { return b },
      update(p: Record<string, unknown>) { pendingUpdate = p; return b },
      eq() { return b },
      is() { return b },
      not() { return b },
      maybeSingle() { return Promise.resolve(exec()) },
      then(onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) {
        return Promise.resolve(exec()).then(onF, onR)
      },
    }
    function exec() {
      const row =
        table === 'prescriptions' ? db.prescricao
          : table === 'clinical_records' ? db.clinicalRecord
            : null
      if (!row) return { data: null, error: null }
      if (pendingUpdate) {
        // Grava DE VERDADE no "banco" mockado — só por isso a releitura
        // abaixo (fora desta função, num novo .from()) enxerga o valor novo.
        Object.assign(row, pendingUpdate)
        return { data: null, error: null }
      }
      return { data: { ...row }, error: null }
    }
    return b
  }
  return { client: { from }, db }
}

// ─────────────────────────────────────────────────────────────────────────
// atualizarReceitaRapida — receita VINCULADA (CA13–14)
// ─────────────────────────────────────────────────────────────────────────
describe('atualizarReceitaRapida — receita vinculada (B2.1, CA13–14)', () => {
  const prescricaoId = uuid('1')
  const recordId = 'record-1'

  it('atualiza prescriptions e faz merge de nova_prescricao no clinical_data da ficha, marcando editado', async () => {
    const { client: c, calls } = client({
      prescricao: { id: prescricaoId, clinical_record_id: recordId },
      clinicalRecord: {
        clinical_data: { anamnese: { queixa_principal: 'dor de cabeça' }, nova_prescricao: { antigo: true } },
      },
    })
    hoistedDb.client = c

    const r = await atualizarReceitaRapida({ prescricaoId, dados_prescricao: dadosPrescricaoValidos })
    expect(r).toEqual({ error: null })

    const updatePrescription = calls.find((cc) => cc.table === 'prescriptions' && cc.ops.includes('update'))
    expect(updatePrescription?.payload?.dados_prescricao).toEqual(dadosPrescricaoValidos)

    const updateRecord = calls.find((cc) => cc.table === 'clinical_records' && cc.ops.includes('update'))
    expect(updateRecord).toBeTruthy()
    const payload = updateRecord!.payload as {
      clinical_data: { anamnese?: unknown; nova_prescricao?: unknown }
      editado: boolean
      editado_em: string
      last_edited_by: string
    }
    // Merge preserva o resto do JSON (anamnese) e substitui só nova_prescricao.
    expect(payload.clinical_data.anamnese).toEqual({ queixa_principal: 'dor de cabeça' })
    expect(payload.clinical_data.nova_prescricao).toEqual(dadosPrescricaoValidos)
    expect(payload.editado).toBe(true)
    expect(typeof payload.editado_em).toBe('string')
    expect(payload.last_edited_by).toBe('user-1')
  })

  it('não mexe em status da ficha nem em appointments (CA14)', async () => {
    const { client: c, calls } = client({
      prescricao: { id: prescricaoId, clinical_record_id: recordId },
      clinicalRecord: { clinical_data: {} },
    })
    hoistedDb.client = c

    await atualizarReceitaRapida({ prescricaoId, dados_prescricao: dadosPrescricaoValidos })

    const updateRecord = calls.find((cc) => cc.table === 'clinical_records' && cc.ops.includes('update'))
    expect(updateRecord?.payload).not.toHaveProperty('status')
    expect(calls.some((cc) => cc.table === 'appointments')).toBe(false)
  })

  it('ficha vinculada não encontrada (defensivo) — segue sem erro, sem update em clinical_records', async () => {
    const { client: c, calls } = client({
      prescricao: { id: prescricaoId, clinical_record_id: recordId },
      clinicalRecord: null,
    })
    hoistedDb.client = c

    const r = await atualizarReceitaRapida({ prescricaoId, dados_prescricao: dadosPrescricaoValidos })
    expect(r).toEqual({ error: null })
    expect(calls.some((cc) => cc.table === 'clinical_records' && cc.ops.includes('update'))).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────
// arquivarReceita — cascata (B2.2, CA16/CA18)
// ─────────────────────────────────────────────────────────────────────────
describe('arquivarReceita', () => {
  const prescricaoId = uuid('2')

  it('avulsa (sem clinical_record_id) → arquiva só a receita, sem cascata (CA18)', async () => {
    const { client: c, calls } = client({
      prescricao: { id: prescricaoId, clinical_record_id: null },
    })
    hoistedDb.client = c

    const r = await arquivarReceita(prescricaoId)
    expect(r).toEqual({ error: null })

    expect(hoistedAgenda.arquivarAtendimento).not.toHaveBeenCalled()
    const updatePrescription = calls.find((cc) => cc.table === 'prescriptions' && cc.ops.includes('update'))
    expect(updatePrescription?.payload).toHaveProperty('deleted_at')
  })

  it('vinculada com ficha ativa → delega para arquivarAtendimento (cascata ficha+receita, CA16)', async () => {
    const recordId = 'record-2'
    const { client: c } = client({
      prescricao: { id: prescricaoId, clinical_record_id: recordId },
      clinicalRecord: { deleted_at: null },
    })
    hoistedDb.client = c

    const r = await arquivarReceita(prescricaoId)
    expect(r).toEqual({ error: null })
    expect(hoistedAgenda.arquivarAtendimento).toHaveBeenCalledWith(recordId)
  })

  it('vinculada com ficha já arquivada (corrida) → idempotente, não chama arquivarAtendimento (edge case 2)', async () => {
    const recordId = 'record-3'
    const { client: c } = client({
      prescricao: { id: prescricaoId, clinical_record_id: recordId },
      clinicalRecord: { deleted_at: '2026-01-01T00:00:00.000Z' },
    })
    hoistedDb.client = c

    const r = await arquivarReceita(prescricaoId)
    expect(r).toEqual({ error: null })
    expect(hoistedAgenda.arquivarAtendimento).not.toHaveBeenCalled()
  })

  it('receita não encontrada → erro, sem chamar nada', async () => {
    const { client: c } = client({ prescricao: null })
    hoistedDb.client = c

    const r = await arquivarReceita(prescricaoId)
    expect(r).toEqual({ error: 'Receita não encontrada' })
    expect(hoistedAgenda.arquivarAtendimento).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────────
// restaurarReceita — cascata (B2.2, CA17/CA18)
// ─────────────────────────────────────────────────────────────────────────
describe('restaurarReceita', () => {
  const prescricaoId = uuid('3')

  it('avulsa (sem clinical_record_id) → restaura só a receita, sem cascata (CA18)', async () => {
    const { client: c, calls } = client({
      prescricao: { id: prescricaoId, clinical_record_id: null },
    })
    hoistedDb.client = c

    const r = await restaurarReceita(prescricaoId)
    expect(r).toEqual({ error: null })

    expect(hoistedAgenda.restaurarAtendimento).not.toHaveBeenCalled()
    const updatePrescription = calls.find((cc) => cc.table === 'prescriptions' && cc.ops.includes('update'))
    expect(updatePrescription?.payload).toEqual({ deleted_at: null })
  })

  it('vinculada com ficha arquivada → delega para restaurarAtendimento (traz ficha+receita, CA17)', async () => {
    const recordId = 'record-4'
    const { client: c } = client({
      prescricao: { id: prescricaoId, clinical_record_id: recordId },
      clinicalRecord: { deleted_at: '2026-01-01T00:00:00.000Z' },
    })
    hoistedDb.client = c

    const r = await restaurarReceita(prescricaoId)
    expect(r).toEqual({ error: null })
    expect(hoistedAgenda.restaurarAtendimento).toHaveBeenCalledWith(recordId)
  })

  it('vinculada com ficha já ativa (corrida) → idempotente, não chama restaurarAtendimento', async () => {
    const recordId = 'record-5'
    const { client: c } = client({
      prescricao: { id: prescricaoId, clinical_record_id: recordId },
      clinicalRecord: { deleted_at: null },
    })
    hoistedDb.client = c

    const r = await restaurarReceita(prescricaoId)
    expect(r).toEqual({ error: null })
    expect(hoistedAgenda.restaurarAtendimento).not.toHaveBeenCalled()
  })

  it('receita não encontrada → erro, sem chamar nada', async () => {
    const { client: c } = client({ prescricao: null })
    hoistedDb.client = c

    const r = await restaurarReceita(prescricaoId)
    expect(r).toEqual({ error: 'Receita não encontrada' })
    expect(hoistedAgenda.restaurarAtendimento).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────────
// Ida-e-volta ficha↔receita: editar PELA receita não diverge do que a ficha
// mantém (CA13 + edge case 1 da STORY + risco "divergência" do SPEC §2).
// Usa dados de grau REALISTAS (não vazios) para provar que nenhum campo se
// perde/converte de forma diferente entre os dois lados.
// ─────────────────────────────────────────────────────────────────────────
describe('atualizarReceitaRapida — ida-e-volta ficha↔receita não diverge (CA13)', () => {
  const prescricaoId = uuid('a')
  const recordId = 'record-rt'

  it('escreve o MESMO objeto nos dois lados (prescriptions.dados_prescricao == clinical_data.nova_prescricao), sem perda de schema', async () => {
    // Estado inicial: a ficha já sincronizou uma prescrição anterior (V0) nas
    // duas pontas (via ficha→receita/upsertPrescricaoSnapshot). Agora o usuário
    // edita PELA receita para V1 (grauPreenchido).
    const v0 = { ...dadosPrescricaoValidos, observacoes: 'versão anterior' }
    const { client: c, calls } = client({
      prescricao: { id: prescricaoId, clinical_record_id: recordId },
      clinicalRecord: {
        clinical_data: { anamnese: { queixa_principal: 'cansaço visual' }, nova_prescricao: v0 },
      },
    })
    hoistedDb.client = c

    const r = await atualizarReceitaRapida({ prescricaoId, dados_prescricao: grauPreenchido })
    expect(r).toEqual({ error: null })

    const ladoReceita = calls.find(
      (cc) => cc.table === 'prescriptions' && cc.ops.includes('update'),
    )!.payload!.dados_prescricao
    const updateRecord = calls.find((cc) => cc.table === 'clinical_records' && cc.ops.includes('update'))!
    const ladoFicha = (updateRecord.payload!.clinical_data as { nova_prescricao: unknown })
      .nova_prescricao

    // Núcleo do critério: os dois lados recebem objetos IDÊNTICOS — não podem divergir.
    expect(ladoReceita).toEqual(ladoFicha)
    // E ambos batem com a forma canônica do schema (sem conversão/perda silenciosa).
    expect(ladoReceita).toEqual(novaPrescricaoSchema.parse(grauPreenchido))
    // A escrita na ficha (o lado novo/arriscado) é escopada por org_id da sessão.
    expect(updateRecord.filters['org_id']).toBe('org-1')
  })

  it('merge preserva o resto do clinical_data (anamnese + diagnóstico) e substitui só nova_prescricao', async () => {
    const { client: c, calls } = client({
      prescricao: { id: prescricaoId, clinical_record_id: recordId },
      clinicalRecord: {
        clinical_data: {
          anamnese: { queixa_principal: 'cansaço visual' },
          diagnostico: { cid: 'H52.1' },
          nova_prescricao: { antigo: true },
        },
      },
    })
    hoistedDb.client = c

    await atualizarReceitaRapida({ prescricaoId, dados_prescricao: grauPreenchido })

    const merged = calls.find((cc) => cc.table === 'clinical_records' && cc.ops.includes('update'))!
      .payload!.clinical_data as Record<string, unknown>
    expect(merged.anamnese).toEqual({ queixa_principal: 'cansaço visual' })
    expect(merged.diagnostico).toEqual({ cid: 'H52.1' })
    expect(merged.nova_prescricao).toEqual(novaPrescricaoSchema.parse(grauPreenchido))
  })
})

// ─────────────────────────────────────────────────────────────────────────
// Round-trip real contra o "banco" (statefulClient) — fecha o achado do
// validator de que os testes acima só verificam o payload ENVIADO, não uma
// releitura pós-UPDATE. Aqui a asserção só passa se o UPDATE anterior de
// fato persistiu no estado mockado.
// ─────────────────────────────────────────────────────────────────────────
describe('atualizarReceitaRapida — round-trip real (relê o "banco" após o UPDATE)', () => {
  const prescricaoId = uuid('c')
  const recordId = 'record-rt2'

  it('prescriptions.dados_prescricao e clinical_data.nova_prescricao batem quando relidos de volta, e o resto do clinical_data se preserva', async () => {
    const { client: c, db } = statefulClient({
      prescricao: { id: prescricaoId, clinical_record_id: recordId },
      clinicalRecord: { clinical_data: { anamnese: { queixa_principal: 'cansaço visual' } } },
    })
    hoistedDb.client = c

    const r = await atualizarReceitaRapida({ prescricaoId, dados_prescricao: grauPreenchido })
    expect(r).toEqual({ error: null })

    // Releitura independente do estado pós-UPDATE (não o payload enviado) —
    // simula reabrir a ficha e a receita depois de a edição já ter sido salva.
    const prescricaoDepois = db.prescricao as { dados_prescricao: unknown }
    const clinicalDataDepois = db.clinicalRecord as {
      clinical_data: { nova_prescricao: unknown; anamnese: unknown }
    }

    expect(prescricaoDepois.dados_prescricao).toEqual(novaPrescricaoSchema.parse(grauPreenchido))
    expect(clinicalDataDepois.clinical_data.nova_prescricao).toEqual(
      novaPrescricaoSchema.parse(grauPreenchido),
    )
    // Os dois lados, relidos do "banco", continuam idênticos entre si.
    expect(clinicalDataDepois.clinical_data.nova_prescricao).toEqual(prescricaoDepois.dados_prescricao)
    // O resto do clinical_data (anamnese) sobrevive ao merge.
    expect(clinicalDataDepois.clinical_data.anamnese).toEqual({ queixa_principal: 'cansaço visual' })
  })
})

// ─────────────────────────────────────────────────────────────────────────
// Isolamento cross-tenant (org_id SEMPRE da sessão): sessão de org-1 não
// consegue editar/arquivar/restaurar receita de outro org (CA13/CA16/CA17;
// regra do projeto "org_id da sessão, nunca do body"). A linha de org-2 fica
// invisível → as actions devolvem "não encontrada" sem efeito colateral.
// ─────────────────────────────────────────────────────────────────────────
describe('cross-tenant — receita de outro org é barrada', () => {
  const prescricaoId = uuid('b')

  it('atualizarReceitaRapida: prescrição de outro org → "não encontrada", sem update em nenhum tenant', async () => {
    const { client: c, calls } = clientOrgAware({
      // A linha existe, mas pertence a org-2; a sessão (getSessionData) é org-1.
      prescricao: { id: prescricaoId, clinical_record_id: 'record-x', org: 'org-2' },
      clinicalRecord: { clinical_data: {}, org: 'org-2' },
    })
    hoistedDb.client = c

    const r = await atualizarReceitaRapida({ prescricaoId, dados_prescricao: dadosPrescricaoValidos })
    expect(r).toEqual({ error: 'Receita não encontrada' })
    // Nenhuma escrita — nem na receita, nem na ficha de outro tenant.
    expect(calls.some((cc) => cc.ops.includes('update'))).toBe(false)
  })

  it('arquivarReceita: prescrição de outro org → "não encontrada", não cascateia', async () => {
    const { client: c } = clientOrgAware({
      prescricao: { id: prescricaoId, clinical_record_id: 'record-x', org: 'org-2' },
    })
    hoistedDb.client = c

    const r = await arquivarReceita(prescricaoId)
    expect(r).toEqual({ error: 'Receita não encontrada' })
    expect(hoistedAgenda.arquivarAtendimento).not.toHaveBeenCalled()
  })

  it('restaurarReceita: prescrição de outro org → "não encontrada", não cascateia', async () => {
    const { client: c } = clientOrgAware({
      prescricao: { id: prescricaoId, clinical_record_id: 'record-x', org: 'org-2' },
    })
    hoistedDb.client = c

    const r = await restaurarReceita(prescricaoId)
    expect(r).toEqual({ error: 'Receita não encontrada' })
    expect(hoistedAgenda.restaurarAtendimento).not.toHaveBeenCalled()
  })
})
