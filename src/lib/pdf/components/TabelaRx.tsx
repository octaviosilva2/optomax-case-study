// Tabela de refração OD/OE — o "herói" da receita e das seções de grau da ficha.
// Colunas: Esférico · Cilíndrico · Eixo · Adição. Valores SEMPRE formatados pelo
// helper compartilhado (formatarCampoRx), garantindo formato idêntico ao do app.
//
// `compacto` encolhe rótulos e padding (usado nas tabelas densas da ficha completa).

import { StyleSheet, Text, View } from '@react-pdf/renderer'
import { PDF_COLORS } from '../pdf-colors'
import { FONTS } from '../fonts'
import { formatarCampoRx } from '../formatar-grau-pdf'
import type { CampoRefracao } from '@/types/clinical'

type Olho = Partial<CampoRefracao> | null | undefined

const styles = StyleSheet.create({
  tabela: {
    borderWidth: 1,
    borderColor: PDF_COLORS.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 4,
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: PDF_COLORS.muted,
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLORS.border,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLORS.border,
  },
  rowUltima: { flexDirection: 'row' },

  cellRotulo: {
    width: '12%',
    backgroundColor: PDF_COLORS.muted,
    borderRightWidth: 1,
    borderRightColor: PDF_COLORS.border,
    fontFamily: FONTS.sans,
    fontWeight: 700,
    color: PDF_COLORS.mutedForegroundDark,
    textAlign: 'center',
  },
  cellHeader: {
    width: '22%',
    fontFamily: FONTS.sans,
    fontWeight: 700,
    color: PDF_COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    textAlign: 'center',
    borderRightWidth: 1,
    borderRightColor: PDF_COLORS.border,
  },
  cellValor: {
    width: '22%',
    fontFamily: FONTS.sans,
    color: PDF_COLORS.foreground,
    textAlign: 'center',
    borderRightWidth: 1,
    borderRightColor: PDF_COLORS.border,
  },
  semBordaDir: { borderRightWidth: 0 },
})

const COLS = [
  { key: 'esf', label: 'Esférico', labelCurto: 'Esf.' },
  { key: 'cil', label: 'Cilíndrico', labelCurto: 'Cil.' },
  { key: 'eixo', label: 'Eixo', labelCurto: 'Eixo' },
  { key: 'add', label: 'Adição', labelCurto: 'Adição' },
] as const

function valoresDoOlho(olho: Olho): string[] {
  return [
    formatarCampoRx(olho?.esf, 'esf'),
    formatarCampoRx(olho?.cil, 'cil'),
    formatarCampoRx(olho?.eixo, 'eixo'),
    formatarCampoRx(olho?.add, 'add'),
  ]
}

type Props = {
  od: Olho
  oe: Olho
  compacto?: boolean
}

export function TabelaRx({ od, oe, compacto }: Props) {
  // Padding/fonte conforme densidade.
  const padV = compacto ? 5 : 8
  const padVValor = compacto ? 6 : 9
  const fsHeader = compacto ? 7.5 : 9
  const fsValor = compacto ? 9.5 : 12
  const fsRotulo = compacto ? 9 : 11

  const linhas: Array<{ rotulo: string; valores: string[]; ultima: boolean }> = [
    { rotulo: 'OD', valores: valoresDoOlho(od), ultima: false },
    { rotulo: 'OE', valores: valoresDoOlho(oe), ultima: true },
  ]

  return (
    <View style={styles.tabela}>
      {/* Cabeçalho */}
      <View style={styles.headerRow}>
        <Text
          style={[
            styles.cellRotulo,
            { paddingVertical: padV, paddingHorizontal: 4, fontSize: fsRotulo },
          ]}
        >
          {' '}
        </Text>
        {COLS.map((c, i) => (
          <Text
            key={c.key}
            style={[
              styles.cellHeader,
              { paddingVertical: padV, paddingHorizontal: 4, fontSize: fsHeader },
              i === COLS.length - 1 ? styles.semBordaDir : {},
            ]}
          >
            {compacto ? c.labelCurto : c.label}
          </Text>
        ))}
      </View>

      {/* Linhas OD / OE */}
      {linhas.map((linha) => (
        <View key={linha.rotulo} style={linha.ultima ? styles.rowUltima : styles.row}>
          <Text
            style={[
              styles.cellRotulo,
              { paddingVertical: padVValor, paddingHorizontal: 4, fontSize: fsRotulo },
            ]}
          >
            {linha.rotulo}
          </Text>
          {linha.valores.map((v, i) => (
            <Text
              key={`${linha.rotulo}-${COLS[i].key}`}
              style={[
                styles.cellValor,
                { paddingVertical: padVValor, paddingHorizontal: 4, fontSize: fsValor },
                i === linha.valores.length - 1 ? styles.semBordaDir : {},
              ]}
            >
              {v}
            </Text>
          ))}
        </View>
      ))}
    </View>
  )
}
