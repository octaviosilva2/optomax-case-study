/**
 * resumo-clinico.ts — Monta linha de resumo clínico para o herói do dashboard.
 *
 * Estrutura mapeada do JSONB (dados reais do Supabase):
 *
 * clinical_data (clinical_records):
 *   - anamnese.uso_oculos_atual: "sim" | "nao" | "as_vezes"
 *   - anamnese.tempo_uso_oculos: string (ex: "3 anos")
 *   - anamnese.queixa_principal: string
 *   - anamnese.ultima_consulta: string (ex: "1 ano")
 *   - lensometria.tipo_lente: string (ex: "bifocal", "multifocal")
 *   - nova_prescricao.tipo_lente: string
 *   - nova_prescricao.od/oe.esf/cil/eixo/add: number
 *
 * dados_prescricao (prescriptions):
 *   - od/oe.esf/cil/eixo/add/dnp: number
 *   - tipo_lente: string | null
 *   - material: string | null
 *   - tratamentos: string[]
 *
 * V1 conservadora: foca em "última consulta há X" + uso de óculos.
 * Enriquecimentos futuros: tipo de lente, refração resumida.
 */

import type { Json } from '@/types/database'

type ClinicalData = {
  anamnese?: {
    uso_oculos_atual?: string
    tempo_uso_oculos?: string
    ultima_consulta?: string
    queixa_principal?: string
  }
  lensometria?: {
    tipo_lente?: string
  }
  nova_prescricao?: {
    tipo_lente?: string
  }
}

type DadosPrescricao = {
  tipo_lente?: string | null
  od?: { esf?: number; cil?: number; add?: number }
  oe?: { esf?: number; cil?: number; add?: number }
}

/**
 * Calcula diferença em meses entre duas datas.
 */
function diffMeses(from: Date, to: Date): number {
  const months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
  return Math.max(0, months)
}

/**
 * Formata "Última consulta ..." de forma gramaticalmente correta.
 * Meses = 0 não usa "há" (ex: "Última consulta este mês", não "há este mês").
 */
function formatarUltimaConsulta(meses: number): string {
  if (meses === 0) return 'Última consulta este mês'
  if (meses === 1) return 'Última consulta há 1 mês'
  if (meses < 12) return `Última consulta há ${meses} meses`
  const anos = Math.floor(meses / 12)
  const resto = meses % 12
  if (resto === 0) {
    return anos === 1 ? 'Última consulta há 1 ano' : `Última consulta há ${anos} anos`
  }
  return anos === 1
    ? `Última consulta há 1 ano e ${resto} meses`
    : `Última consulta há ${anos} anos e ${resto} meses`
}

/**
 * Extrai resumo de uso de óculos do clinical_data.
 */
function extrairUsoOculos(anamnese: ClinicalData['anamnese']): string | null {
  if (!anamnese?.uso_oculos_atual) return null
  const uso = anamnese.uso_oculos_atual
  if (uso === 'sim') return 'usa óculos'
  if (uso === 'nao') return 'não usa óculos'
  if (uso === 'as_vezes') return 'usa óculos ocasionalmente'
  return null
}

/**
 * Extrai tipo de lente (multifocal, bifocal, etc).
 */
function extrairTipoLente(clinical: ClinicalData, prescricao: DadosPrescricao | null): string | null {
  // Prioriza prescrição mais recente
  if (prescricao?.tipo_lente) return prescricao.tipo_lente
  if (clinical.nova_prescricao?.tipo_lente) return clinical.nova_prescricao.tipo_lente
  if (clinical.lensometria?.tipo_lente) return clinical.lensometria.tipo_lente
  return null
}

export type ResumoClinicopInput = {
  /** Data do último clinical_record finalizado */
  ultimaConsultaEm: string | null
  /** clinical_data do registro mais recente */
  clinicalData: Json | null
  /** dados_prescricao da prescrição mais recente */
  dadosPrescricao: Json | null
}

/**
 * Monta linha de resumo clínico para exibição no herói do dashboard.
 *
 * @returns Linha de texto (ex: "Última consulta há 3 meses · usa óculos · multifocal")
 *          ou null se não houver histórico.
 */
export function montarResumoClinicio(input: ResumoClinicopInput): string | null {
  const partes: string[] = []

  // 1. Tempo desde última consulta (sempre disponível se houver histórico)
  if (input.ultimaConsultaEm) {
    const meses = diffMeses(new Date(input.ultimaConsultaEm), new Date())
    partes.push(formatarUltimaConsulta(meses))
  }

  // 2. Uso de óculos
  const clinical = (input.clinicalData ?? {}) as ClinicalData
  const usoOculos = extrairUsoOculos(clinical.anamnese)
  if (usoOculos) partes.push(usoOculos)

  // 3. Tipo de lente
  const prescricao = (input.dadosPrescricao ?? null) as DadosPrescricao | null
  const tipoLente = extrairTipoLente(clinical, prescricao)
  if (tipoLente) partes.push(tipoLente)

  if (partes.length === 0) return null
  return partes.join(' · ')
}
