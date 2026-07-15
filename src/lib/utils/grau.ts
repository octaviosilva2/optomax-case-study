// Utilitários de formatação de grau (esférico + cilíndrico) para listas e cards.
// Padrão: sinal explícito (−/+), vírgula decimal BR, 2 casas fixas, fonte tabular.
// Adição e eixo são omitidos na lista — aparecem apenas no "Ver" detalhado.

/**
 * Tipo mínimo de entrada para um olho.
 * Aceita string (texto livre clínico) ou number (JSONB legado).
 */
type OlhoInput = {
  esf?: string | number | null
  cil?: string | number | null
} | null | undefined

/**
 * Tipo de entrada para dados de prescrição (OD + OE).
 */
export type DadosPrescricaoGrau = {
  od?: OlhoInput
  oe?: OlhoInput
} | null | undefined

/**
 * Formata um valor dioptrico individual para exibição.
 * - Converte number/string para número
 * - Aplica sinal explícito (+ ou −)
 * - Usa vírgula decimal BR
 * - 2 casas decimais fixas
 *
 * Retorna null se valor inválido/vazio.
 */
export function formatarDioptria(valor: string | number | null | undefined): string | null {
  if (valor === null || valor === undefined || valor === '') return null

  // Converte para número
  const num = typeof valor === 'number' ? valor : parseFloat(String(valor).replace(',', '.'))
  if (!Number.isFinite(num)) return null

  // Sinal explícito: + para positivo, − (Unicode minus) para negativo, nada para zero
  const sinal = num > 0 ? '+' : num < 0 ? '−' : ''
  const abs = Math.abs(num).toFixed(2).replace('.', ',')

  return `${sinal}${abs}`
}

/**
 * Formata o grau de um olho (esf + cil) em string curta.
 * Ex: "−2,00 −1,25" ou "−2,00" (se só esf) ou "—" (se vazio)
 */
function formatarOlho(olho: OlhoInput): string {
  if (!olho) return '—'

  const esf = formatarDioptria(olho.esf)
  const cil = formatarDioptria(olho.cil)

  // Se não tem esférico, retorna traço
  if (!esf) return '—'

  // Se não tem cilíndrico ou é zero, retorna só esférico
  if (!cil) return esf

  // Ambos preenchidos
  return `${esf} ${cil}`
}

/**
 * Formata grau resumido para exibição em listas.
 * Formato: "OD −2,00 −1,25 | OE −2,00 −1,25"
 *
 * Se ambos os olhos estiverem vazios, retorna "—".
 * Se apenas um olho tiver dados, mostra só ele.
 */
export function formatarGrauResumido(dados: DadosPrescricaoGrau): string {
  if (!dados) return '—'

  const od = formatarOlho(dados.od)
  const oe = formatarOlho(dados.oe)

  // Ambos vazios
  if (od === '—' && oe === '—') return '—'

  // Ambos preenchidos
  if (od !== '—' && oe !== '—') {
    return `OD ${od} | OE ${oe}`
  }

  // Só um preenchido
  if (od !== '—') return `OD ${od}`
  return `OE ${oe}`
}

/**
 * Formata grau para exibição inline compacta (sem labels OD/OE).
 * Útil quando o contexto já indica qual olho é qual.
 * Ex: "−2,00 −1,25"
 */
export function formatarGrauOlhoCompacto(olho: OlhoInput): string {
  return formatarOlho(olho)
}

/**
 * Tipo de retorno estruturado para exibicao com rotulo ESF (CIL nao entra na lista).
 */
export type GrauOlhoEstruturado = {
  esf: string // valor formatado ou "—"
  vazio: boolean // true se ambos sao vazios
}

export type GrauEstruturado = {
  od: GrauOlhoEstruturado
  oe: GrauOlhoEstruturado
  ambosVazios: boolean
}

/**
 * Retorna o esferico de forma estruturada por olho.
 * Util para renderizar com rotulos alinhados em colunas.
 */
export function obterGrauEstruturado(dados: DadosPrescricaoGrau): GrauEstruturado {
  function processarOlho(olho: OlhoInput): GrauOlhoEstruturado {
    if (!olho) return { esf: '—', vazio: true }

    const esf = formatarDioptria(olho.esf)

    // Se nao tem esferico, considera vazio
    if (!esf) return { esf: '—', vazio: true }

    return { esf, vazio: false }
  }

  const od = processarOlho(dados?.od)
  const oe = processarOlho(dados?.oe)

  return {
    od,
    oe,
    ambosVazios: od.vazio && oe.vazio,
  }
}
