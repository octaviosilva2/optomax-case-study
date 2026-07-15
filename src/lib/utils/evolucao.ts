// Utilitários puros (sem I/O) para transformar records clínicos em pontos
// de evolução e calcular deltas. Mantidos separados do hook para facilitar
// testes unitários e reuso.

import type { FichaClinica, LinhaRefracao } from '@/types/clinical'
import { CAMPOS_REFRACAO } from '@/types/clinical'
import type {
  DeltaEvolucao,
  ItemDelta,
  PontoEvolucao,
} from '@/types/evolucao'

// Estrutura mínima esperada de um clinical_record para transformação.
// Mantemos o tipo local (não importamos do Supabase) para não acoplar.
export type RecordEvolucao = {
  id: string
  finalizado_em: string | null
  modelo: 'resumido' | 'completo'
  clinical_data: FichaClinica | null
}

// Normaliza um campo numérico vindo do JSONB para number | null.
// Ignora valores inválidos (string vazia, NaN, texto livre) — JSONB pode conter
// qualquer coisa, e desde a Etapa 6 a grade salva como string livre. Strings
// numéricas ("-2.50") são convertidas; strings clínicas ("neutro", "PL") viram null.
function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

// Constrói um olho do PontoEvolucao a partir do JSONB (pode ser string livre,
// number legado ou misto). Usa `unknown` para aceitar qualquer forma do banco.
function olhoSeguro(p: Record<string, unknown> | undefined): PontoEvolucao['od'] {
  return {
    esf: num(p?.esf),
    cil: num(p?.cil),
    eixo: num(p?.eixo),
    add: num(p?.add),
  }
}

// Verifica se um ponto tem pelo menos um valor preenchido em qualquer olho/campo.
// Pontos totalmente vazios são descartados (não são "evolução" útil).
function pontoTemDados(p: PontoEvolucao): boolean {
  for (const olho of ['od', 'oe'] as const) {
    for (const campo of CAMPOS_REFRACAO) {
      if (p[olho][campo] !== null) return true
    }
  }
  return false
}

/**
 * Transforma uma lista de clinical_records (ordenada por finalizado_em ASC)
 * em pontos de evolução prontos para o gráfico.
 *
 * Filtra:
 * - Records sem finalizado_em (ainda em andamento)
 * - Records sem nenhum dado de prescrição (todos os campos null)
 *
 * Não ordena — assume que a query já veio ordenada do servidor (mais barato).
 */
export function transformarRecordsEmPontos(
  records: RecordEvolucao[],
): PontoEvolucao[] {
  const pontos: PontoEvolucao[] = []
  for (const r of records) {
    if (!r.finalizado_em) continue
    const presc = r.clinical_data?.nova_prescricao
    const ponto: PontoEvolucao = {
      recordId: r.id,
      finalizadoEm: r.finalizado_em,
      modelo: r.modelo,
      od: olhoSeguro(presc?.od as Record<string, unknown> | undefined),
      oe: olhoSeguro(presc?.oe as Record<string, unknown> | undefined),
    }
    if (pontoTemDados(ponto)) pontos.push(ponto)
  }
  return pontos
}

// Prescrição avulsa (sem clinical_record vinculado) — ex.: receita rápida.
// Tem o grau direto em `dados_prescricao.{od,oe}`, sem o wrapper `nova_prescricao`.
export type PrescricaoEvolucao = {
  id: string
  created_at: string
  dados_prescricao: { od?: unknown; oe?: unknown } | null
}

/**
 * Transforma prescrições avulsas (sem atendimento finalizado) em pontos de
 * evolução, usando `created_at` como eixo X. Mantém a UI de evolução coerente
 * para pacientes que só receberam receita rápida (que não gera clinical_record).
 *
 * IMPORTANTE: passar apenas prescrições SEM `clinical_record_id`, senão o mesmo
 * atendimento apareceria duas vezes (uma pelo record, outra pela prescrição).
 */
export function transformarPrescricoesEmPontos(
  prescricoes: PrescricaoEvolucao[],
): PontoEvolucao[] {
  const pontos: PontoEvolucao[] = []
  for (const p of prescricoes) {
    const dp = p.dados_prescricao
    const ponto: PontoEvolucao = {
      recordId: p.id,
      finalizadoEm: p.created_at,
      modelo: 'resumido',
      od: olhoSeguro(dp?.od as Record<string, unknown> | undefined),
      oe: olhoSeguro(dp?.oe as Record<string, unknown> | undefined),
    }
    if (pontoTemDados(ponto)) pontos.push(ponto)
  }
  return pontos
}

/**
 * Delta angular para o EIXO (campo circular módulo 180°).
 *
 * Em optometria, eixo 0° ≡ 180°. Diferença numérica linear engana:
 * primeiro=170°, último=10° → linear seria −160°, mas o caminho angular real
 * é apenas +20°. Esta função retorna o caminho angular mais curto em [-90, 90].
 *
 * Sinal positivo = rotação no sentido crescente; negativo = decrescente.
 */
export function deltaEixo(primeiro: number, ultimo: number): number {
  const raw = ultimo - primeiro
  // Normaliza para [0, 180)
  const mod = ((raw % 180) + 180) % 180
  // Se > 90, o caminho mais curto é pelo lado oposto (negativo)
  return mod > 90 ? mod - 180 : mod
}

/**
 * Calcula o delta (último − primeiro) para cada combinação olho × campo.
 *
 * - 0 pontos: itens vazios.
 * - 1 ponto: delta `null` para todos (UI mostra "aguardando próximo atendimento").
 * - Algum dos extremos null para um campo: delta `null` para esse campo.
 * - Para EIXO usa `deltaEixo` (módulo 180); para ESF/CIL usa diferença linear.
 */
export function calcularDelta(pontos: PontoEvolucao[]): DeltaEvolucao {
  if (pontos.length === 0) {
    return {
      totalAtendimentos: 0,
      primeiroEm: null,
      ultimoEm: null,
      itens: [],
    }
  }

  const primeiro = pontos[0]
  const ultimo = pontos[pontos.length - 1]
  const semComparacao = pontos.length < 2

  const itens: ItemDelta[] = []
  const olhos: LinhaRefracao[] = ['od', 'oe']
  for (const olho of olhos) {
    for (const campo of CAMPOS_REFRACAO) {
      const a = primeiro[olho][campo]
      const b = ultimo[olho][campo]
      let delta: number | null = null
      if (!semComparacao && a !== null && b !== null) {
        const bruto = campo === 'eixo' ? deltaEixo(a, b) : b - a
        delta = Number(bruto.toFixed(2))
      }
      itens.push({ olho, campo, primeiro: a, ultimo: b, delta })
    }
  }

  return {
    totalAtendimentos: pontos.length,
    primeiroEm: primeiro.finalizadoEm,
    ultimoEm: ultimo.finalizadoEm,
    itens,
  }
}
