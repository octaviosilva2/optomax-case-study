// Tipos da Evolução do Grau — leitura agregada de prescrições do paciente
// ao longo do tempo. Fonte: clinical_records.nova_prescricao (chave compartilhada
// entre os modelos Resumido e Completo).

import type { CampoRefracaoKey, LinhaRefracao } from './clinical'

// Um ponto na linha do tempo = um atendimento finalizado.
// Etapa 6 (#27 + #29): DNP foi removido da grade. Como a UI agora salva os
// valores como string livre, o util `transformarRecordsEmPontos` faz o parsing
// defensivo para number antes de chegar aqui (`num(v)` retorna null em valores
// não-numéricos como "neutro" ou "PL").
export type PontoEvolucao = {
  recordId: string
  // ISO datetime de finalizado_em (usado como eixo X do gráfico)
  finalizadoEm: string
  modelo: 'resumido' | 'completo'
  od: {
    esf: number | null
    cil: number | null
    eixo: number | null
    add: number | null
  }
  oe: {
    esf: number | null
    cil: number | null
    eixo: number | null
    add: number | null
  }
}

// Um item de comparação primeiro vs último para um campo específico
export type ItemDelta = {
  olho: LinhaRefracao
  campo: CampoRefracaoKey
  primeiro: number | null
  ultimo: number | null
  delta: number | null  // ultimo - primeiro (null se algum dos dois for null)
}

export type DeltaEvolucao = {
  totalAtendimentos: number
  primeiroEm: string | null  // ISO datetime do primeiro ponto
  ultimoEm: string | null    // ISO datetime do último ponto
  itens: ItemDelta[]
}

// Campos exibidos no gráfico (6 linhas: ESF/CIL/EIXO × OD/OE).
// DNP/ADD ficam fora do gráfico principal — não são "evolução" típica.
export const CAMPOS_GRAFICO: CampoRefracaoKey[] = ['esf', 'cil', 'eixo']
