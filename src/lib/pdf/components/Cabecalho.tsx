// Cabeçalho compartilhado pelos 3 documentos (receita, ficha resumida, completa).
// Duas faixas:
//   1. Marca do PRODUTO — wordmark "OptoMax." (ponto dourado) + slogan. Aparece
//      no topo de todo documento (branding da plataforma).
//   2. Marca da CLÍNICA — monograma navy com a inicial + nome/endereço/telefone à
//      esquerda; tipo de documento + data à direita; borda navy embaixo.

import { StyleSheet, Text, View } from '@react-pdf/renderer'
import { PDF_COLORS } from '../pdf-colors'
import { FONTS } from '../fonts'

const styles = StyleSheet.create({
  // ---- Eyebrow: marca do produto (OptoMax. + slogan) ----
  marca: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  marcaNome: {
    fontFamily: FONTS.serif,
    fontWeight: 600,
    fontSize: 12.5,
    color: PDF_COLORS.primary,
  },
  marcaPonto: { color: PDF_COLORS.accent }, // ponto final dourado do wordmark
  marcaSep: {
    fontFamily: FONTS.sans,
    fontSize: 8,
    color: PDF_COLORS.textQuaternary,
  },
  marcaSlogan: {
    fontFamily: FONTS.sans,
    fontSize: 8,
    color: PDF_COLORS.mutedForeground,
    letterSpacing: 0.2,
  },

  // ---- Cabeçalho da clínica ----
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 11,
    borderBottomWidth: 2,
    borderBottomColor: PDF_COLORS.primary,
  },
  esq: { flexDirection: 'row', alignItems: 'center', gap: 11, flexShrink: 1 },
  monograma: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: PDF_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramaTexto: {
    fontFamily: FONTS.serif,
    fontWeight: 600,
    fontSize: 20,
    color: PDF_COLORS.card, // branco
    // Pequeno ajuste óptico: a serif tende a "subir" dentro do quadrado.
    marginTop: -1,
  },
  nomeClinica: {
    fontFamily: FONTS.serif,
    fontWeight: 600,
    fontSize: 17,
    color: PDF_COLORS.primary,
    lineHeight: 1,
  },
  info: {
    fontFamily: FONTS.sans,
    fontSize: 9,
    color: PDF_COLORS.mutedForeground,
    marginTop: 3,
  },
  dir: { alignItems: 'flex-end' },
  tipoDoc: {
    fontFamily: FONTS.sans,
    fontSize: 8,
    color: PDF_COLORS.textQuaternary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  data: {
    fontFamily: FONTS.sans,
    fontWeight: 700,
    fontSize: 11,
    color: PDF_COLORS.foreground,
    marginTop: 2,
  },
})

type Props = {
  nomeClinica: string
  endereco?: string | null
  telefone?: string | null
  tipoDocumento: string // ex: "Receita / Prescrição", "Ficha clínica · resumida"
  data: string // já formatada, ex: "29/05/2026" ou "Emitida em 29/05/2026"
  // Ficha completa (multipágina) repete o cabeçalho inteiro em toda página.
  fixed?: boolean
}

export function Cabecalho({
  nomeClinica,
  endereco,
  telefone,
  tipoDocumento,
  data,
  fixed,
}: Props) {
  const inicial = (nomeClinica?.trim()?.charAt(0) || 'O').toUpperCase()
  const infoLinha = [endereco, telefone].filter(Boolean).join(' · ')

  return (
    <View fixed={fixed ?? false}>
      {/* Faixa de marca do produto */}
      <View style={styles.marca}>
        <Text style={styles.marcaNome}>
          OptoMax<Text style={styles.marcaPonto}>.</Text>
        </Text>
        <Text style={styles.marcaSep}>·</Text>
        <Text style={styles.marcaSlogan}>
          Software de Gestão para Optometristas
        </Text>
      </View>

      {/* Cabeçalho da clínica */}
      <View style={styles.header}>
        <View style={styles.esq}>
          <View style={styles.monograma}>
            <Text style={styles.monogramaTexto}>{inicial}</Text>
          </View>
          <View>
            <Text style={styles.nomeClinica}>{nomeClinica}</Text>
            {infoLinha !== '' && <Text style={styles.info}>{infoLinha}</Text>}
          </View>
        </View>

        <View style={styles.dir}>
          <Text style={styles.tipoDoc}>{tipoDocumento}</Text>
          <Text style={styles.data}>{data}</Text>
        </View>
      </View>
    </View>
  )
}
