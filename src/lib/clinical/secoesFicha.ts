// Registry único das seções da Ficha de Atendimento.
// Fonte de verdade compartilhada entre o índice lateral (IndiceFicha) e o
// AtendimentoView. O `id` deve casar exatamente com o id do <div> wrapper
// (SecaoWrapper) renderizado no AtendimentoView — é o alvo do scroll/scroll-spy.
//
// REGRA DE OURO: este arquivo é andaime. Não altera nenhum campo clínico —
// apenas descreve quais seções existem, em que fase entram e qual chave de
// FichaClinica usar para detectar preenchimento.

import type { FichaClinica } from '@/types/clinical'

// As 4 fases do atendimento (mesma divisão do HTML de referência).
export const FASES_ORDEM = ['Anamnese', 'Exames', 'Refração', 'Conclusão'] as const
export type FaseFicha = (typeof FASES_ORDEM)[number]

export type Modelo = 'resumido' | 'completo'

export type SecaoFicha = {
  /** id do <div> wrapper no AtendimentoView (sem o "#") */
  id: string
  /** Rótulo exibido no índice e no header do acordeão mobile */
  label: string
  /** Fase a que pertence (agrupamento do índice) */
  fase: FaseFicha
  /**
   * Chaves de FichaClinica usadas para detectar "seção preenchida".
   * Vazio = seção que não conta progresso (ex.: Identificação, Evolução).
   */
  chaves: (keyof FichaClinica)[]
}

// Lista mestra na ORDEM EXATA de render do AtendimentoView (modo Completo).
// `resumido` marca quais também aparecem no modo Resumido.
const SECOES: Array<SecaoFicha & { resumido: boolean }> = [
  // ── Anamnese ──────────────────────────────────────────────────────────
  { id: 'sec-ident', label: 'Identificação', fase: 'Anamnese', chaves: [], resumido: true },
  { id: 'sec-anamnese', label: 'Anamnese', fase: 'Anamnese', chaves: ['anamnese'], resumido: true },
  { id: 'sec-anamnese-familiar', label: 'Anamnese familiar', fase: 'Anamnese', chaves: ['anamnese_familiar'], resumido: true },

  // ── Exames (só Completo) ──────────────────────────────────────────────
  { id: 'sec-av-sc', label: 'AV sem correção', fase: 'Exames', chaves: ['acuidade_visual_sc'], resumido: false },
  { id: 'sec-av-cc', label: 'AV com correção', fase: 'Exames', chaves: ['acuidade_visual_cc'], resumido: false },
  { id: 'sec-reflexos', label: 'Reflexos pupilares', fase: 'Exames', chaves: ['reflexos_pupilares'], resumido: false },
  { id: 'sec-motora', label: 'Avaliação motora', fase: 'Exames', chaves: ['avaliacao_motora'], resumido: false },
  { id: 'sec-biomicroscopia', label: 'Biomicroscopia', fase: 'Exames', chaves: ['biomicroscopia'], resumido: false },
  { id: 'sec-oftalmoscopia', label: 'Oftalmoscopia', fase: 'Exames', chaves: ['oftalmoscopia'], resumido: false },
  { id: 'sec-tonometria', label: 'Tonometria', fase: 'Exames', chaves: ['tonometria'], resumido: false },
  { id: 'sec-ceratometria', label: 'Ceratometria', fase: 'Exames', chaves: ['ceratometria'], resumido: false },

  // ── Refração ──────────────────────────────────────────────────────────
  { id: 'sec-lensometria', label: 'Lensometria / Dioptria atual', fase: 'Refração', chaves: ['lensometria'], resumido: true },
  { id: 'sec-autorrefrator', label: 'Autorrefrator', fase: 'Refração', chaves: ['autorrefrator'], resumido: false },
  { id: 'sec-retino-est', label: 'Retinoscopia estática', fase: 'Refração', chaves: ['retinoscopia_estatica'], resumido: false },
  { id: 'sec-retino-din', label: 'Retinoscopia dinâmica', fase: 'Refração', chaves: ['retinoscopia_dinamica'], resumido: false },
  { id: 'sec-subjetivo', label: 'Subjetivo', fase: 'Refração', chaves: ['subjetivo'], resumido: false },
  { id: 'sec-cover', label: 'Cover test', fase: 'Refração', chaves: ['cover_test'], resumido: false },
  { id: 'sec-testes-motores-comp', label: 'Testes motores compl.', fase: 'Refração', chaves: ['testes_motores_complementares'], resumido: false },
  { id: 'sec-ppc', label: 'PPC / PPA', fase: 'Refração', chaves: ['ppc', 'ppa'], resumido: false },
  { id: 'sec-reservas', label: 'Reservas fusionais', fase: 'Refração', chaves: ['reservas_fusionais'], resumido: false },
  { id: 'sec-acomodativos', label: 'Testes acomodativos', fase: 'Refração', chaves: ['testes_acomodativos'], resumido: false },
  { id: 'sec-cores', label: 'Visão de cores', fase: 'Refração', chaves: ['visao_cores'], resumido: false },
  { id: 'sec-campos', label: 'Campos visuais', fase: 'Refração', chaves: ['campos_visuais'], resumido: false },
  { id: 'sec-evolucao', label: 'Evolução da dioptria', fase: 'Refração', chaves: [], resumido: true },
  // Refração final (Completo) / Nova prescrição (Resumido) — label ajustado por modo.
  { id: 'sec-prescricao', label: 'Nova prescrição', fase: 'Refração', chaves: ['nova_prescricao'], resumido: true },

  // ── Conclusão ─────────────────────────────────────────────────────────
  { id: 'sec-diagnostico', label: 'Diagnóstico', fase: 'Conclusão', chaves: ['diagnostico'], resumido: false },
  { id: 'sec-conduta', label: 'Conduta', fase: 'Conclusão', chaves: ['historico_observacoes'], resumido: true },
  { id: 'sec-encaminhamento', label: 'Encaminhamento', fase: 'Conclusão', chaves: ['encaminhamento'], resumido: true },
]

/**
 * Retorna as seções do modo ativo, na ordem de render, com o label de
 * "Nova prescrição" / "Refração final" ajustado conforme o modelo.
 */
export function secoesDoModo(modo: Modelo): SecaoFicha[] {
  const lista = modo === 'completo' ? SECOES : SECOES.filter((s) => s.resumido)
  return lista.map((s) =>
    s.id === 'sec-prescricao'
      ? { ...s, label: modo === 'completo' ? 'Refração final' : 'Nova prescrição' }
      : s,
  )
}

// Considera "com valor" qualquer leaf não-vazio (string não-vazia, número,
// boolean true, array/objeto com algum valor). Usado para a bolinha de
// preenchida e o contador X/N do índice.
function temValor(v: unknown): boolean {
  if (v === null || v === undefined) return false
  if (typeof v === 'string') return v.trim() !== ''
  if (typeof v === 'number') return Number.isFinite(v)
  if (typeof v === 'boolean') return v === true
  if (Array.isArray(v)) return v.some(temValor)
  if (typeof v === 'object') return Object.values(v as Record<string, unknown>).some(temValor)
  return false
}

/**
 * True se qualquer uma das chaves da seção tem algum dado preenchido.
 * Seção sem chaves (Identificação, Evolução) sempre retorna false aqui —
 * o índice trata essas como "não conta progresso".
 */
export function secaoPreenchida(
  ficha: FichaClinica,
  chaves: (keyof FichaClinica)[],
): boolean {
  return chaves.some((k) => temValor(ficha[k]))
}
