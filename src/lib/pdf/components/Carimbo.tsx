// Carimbo do profissional — compartilhado pelos 3 documentos.
// Assinatura digital (PNG base64) acima da linha quando cadastrada; senão linha
// vazia + nome. Nome + CRO/CBOO + formações abaixo. `wrap={false}` impede que o
// bloco quebre entre páginas.

import { Image, StyleSheet, Text, View } from '@react-pdf/renderer'
import { PDF_COLORS } from '../pdf-colors'
import { FONTS } from '../fonts'

const styles = StyleSheet.create({
  carimbo: {
    marginTop: 36,
    alignSelf: 'flex-end',
    width: 230,
    alignItems: 'center',
  },
  assinatura: {
    // Altura fixa + objectFit contain centraliza assinaturas de aspect ratio variável.
    height: 46,
    marginBottom: 2,
    objectFit: 'contain',
  },
  linha: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: PDF_COLORS.foreground,
    marginBottom: 4,
  },
  nome: {
    fontFamily: FONTS.sans,
    fontWeight: 700,
    fontSize: 11,
    color: PDF_COLORS.foreground,
    textAlign: 'center',
  },
  cro: {
    fontFamily: FONTS.sans,
    fontSize: 9.5,
    color: PDF_COLORS.mutedForegroundDark,
    marginTop: 1,
    textAlign: 'center',
  },
  formacao: {
    fontFamily: FONTS.sans,
    fontSize: 8,
    color: PDF_COLORS.textTertiary,
    marginTop: 1,
    textAlign: 'center',
  },
})

type Props = {
  nomeCompleto: string | null
  croCboo: string | null
  formacoes: string[] | null
  assinaturaDataUrl: string | null
}

export function Carimbo({
  nomeCompleto,
  croCboo,
  formacoes,
  assinaturaDataUrl,
}: Props) {
  return (
    <View style={styles.carimbo} wrap={false}>
      {assinaturaDataUrl && (
        // eslint-disable-next-line jsx-a11y/alt-text
        <Image src={assinaturaDataUrl} style={styles.assinatura} />
      )}
      <View style={styles.linha} />
      <Text style={styles.nome}>{nomeCompleto ?? '—'}</Text>
      {croCboo && <Text style={styles.cro}>{croCboo}</Text>}
      {formacoes && formacoes.length > 0 && (
        <Text style={styles.formacao}>{formacoes.join(' · ')}</Text>
      )}
    </View>
  )
}
