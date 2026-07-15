// Rodapé jurídico compartilhado pelos 3 documentos.
// Esquerda: "Documento emitido eletronicamente por OptoMax em DD/MM/AAAA às HH:MM".
// Direita: nome da clínica + paginação — esta SÓ aparece quando há mais de 1 página
// (regra do spec: ficha de 1 página não mostra "pág. 1/1").
//
// `fixed` faz o bloco repetir em todas as páginas; o `render` da direita recalcula
// pageNumber/totalPages por página.

import { StyleSheet, Text, View } from '@react-pdf/renderer'
import { PDF_COLORS } from '../pdf-colors'
import { FONTS } from '../fonts'

// Data + hora de emissão em horário de Brasília (momento da geração do PDF).
function dataHoraBR(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const data = d.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  const hora = d.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${data} às ${hora}`
}

const styles = StyleSheet.create({
  rodape: {
    position: 'absolute',
    left: 36,
    right: 36,
    bottom: 22,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: PDF_COLORS.border,
    paddingTop: 7,
  },
  esq: {
    fontFamily: FONTS.sans,
    fontSize: 8,
    color: PDF_COLORS.textQuaternary,
    flexShrink: 1,
    paddingRight: 12,
  },
  dir: {
    fontFamily: FONTS.sans,
    fontSize: 8,
    color: PDF_COLORS.textQuaternary,
    textAlign: 'right',
  },
})

type Props = {
  geradoEm: string // ISO — momento da geração do PDF
  nomeClinica: string
  // Ficha referenciando que a receita foi emitida à parte (1 linha, sem página em branco).
  notaPrescricaoSeparada?: boolean
}

export function RodapeJuridico({
  geradoEm,
  nomeClinica,
  notaPrescricaoSeparada,
}: Props) {
  const dh = dataHoraBR(geradoEm)
  const nota = notaPrescricaoSeparada
    ? ' Prescrição emitida em documento separado.'
    : ''
  const esqTexto = `Documento emitido eletronicamente por OptoMax${dh ? ` em ${dh}` : ''}.${nota}`

  return (
    <View style={styles.rodape} fixed>
      <Text style={styles.esq}>{esqTexto}</Text>
      <Text
        style={styles.dir}
        render={({ pageNumber, totalPages }) =>
          totalPages > 1
            ? `${nomeClinica} · pág. ${pageNumber}/${totalPages}`
            : nomeClinica
        }
      />
    </View>
  )
}
