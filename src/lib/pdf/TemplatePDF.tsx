// Template do PDF de prescrição óptica (receita).
// Renderizado server-side com @react-pdf/renderer (não usa DOM/React-DOM).
// O componente é PURO — recebe todos os dados já consolidados via props.
//
// Identidade unificada com a ficha clínica via componentes compartilhados
// (Cabecalho, RodapeJuridico, Carimbo, TabelaRx) + fontes Fraunces/Inter.

import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { NovaPrescricao } from '@/types/clinical'
import { PDF_COLORS } from './pdf-colors'
import { FONTS, registrarFontesPDF } from './fonts'
import { capitalizar, formatarTratamento } from './formatadores'
import { Cabecalho } from './components/Cabecalho'
import { RodapeJuridico } from './components/RodapeJuridico'
import { Carimbo } from './components/Carimbo'
import { TabelaRx } from './components/TabelaRx'

// Registra Fraunces + Inter antes de qualquer renderização.
registrarFontesPDF()

// ----- Tipos das props -----

export type DadosOrganizacao = {
  nome_clinica: string
  endereco: string | null
  telefone: string | null
}

export type DadosPaciente = {
  nome: string
  cpf: string | null // dígitos puros (formatamos no PDF)
  data_nascimento: string | null // ISO string
}

export type DadosProfissional = {
  nome_completo: string | null
  cro_cboo: string | null
  formacoes: string[] | null
  // PNG da assinatura digital em data URL, resolvido server-side antes de
  // renderizar. null cai no fallback (linha vazia + nome).
  signature_data_url: string | null
}

export type DadosPDFPrescricao = {
  organizacao: DadosOrganizacao
  paciente: DadosPaciente
  profissional: DadosProfissional
  prescricao: Partial<NovaPrescricao>
  dataAtendimento: string | null // ISO string (finalizado_em ou created_at)
  geradoEm: string // ISO — momento da geração do PDF (rodapé jurídico)
}

// ----- Helpers de formatação (puros, auto-contidos) -----

function formatarCPF(cpf: string | null): string {
  if (!cpf) return '—'
  const limpo = cpf.replace(/\D/g, '')
  if (limpo.length !== 11) return cpf
  return limpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

// Idade usando "hoje" em horário Brasília; nascimento (YYYY-MM-DD) lido em UTC
// para evitar off-by-one quando o server está em fuso negativo.
function calcularIdade(dataNasc: string | null): number | null {
  if (!dataNasc) return null
  const nasc = new Date(dataNasc)
  if (isNaN(nasc.getTime())) return null

  const fmtBR = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const [hojeY, hojeM, hojeD] = fmtBR.format(new Date()).split('-').map(Number)

  const nascY = nasc.getUTCFullYear()
  const nascM = nasc.getUTCMonth() + 1
  const nascD = nasc.getUTCDate()

  let idade = hojeY - nascY
  if (hojeM < nascM || (hojeM === nascM && hojeD < nascD)) idade--
  return idade
}

// Nascimento — formatado em UTC para preservar o dia "calendário" do banco.
function formatarDataNasc(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR', {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

// Data do atendimento (timestamp) — horário de Brasília.
function formatarDataAtendimento(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

// ----- Estilos -----

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 64,
    paddingHorizontal: 40,
    fontFamily: FONTS.sans,
    fontSize: 10,
    color: PDF_COLORS.foreground,
  },

  bloco: { marginTop: 16 },
  blocoTitulo: {
    fontFamily: FONTS.sans,
    fontWeight: 700,
    fontSize: 8,
    color: PDF_COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 7,
  },

  pacienteNome: {
    fontFamily: FONTS.sans,
    fontWeight: 700,
    fontSize: 15,
    color: PDF_COLORS.foreground,
  },
  pacienteInfo: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    color: PDF_COLORS.mutedForegroundDark,
    marginTop: 2,
  },

  detalheLinha: { flexDirection: 'row', marginTop: 4 },
  detalheRotulo: {
    fontFamily: FONTS.sans,
    fontSize: 10,
    color: PDF_COLORS.mutedForeground,
    width: 92,
  },
  detalheValor: {
    fontFamily: FONTS.sans,
    fontSize: 10,
    color: PDF_COLORS.foreground,
    flex: 1,
  },

  observacoesTexto: {
    fontFamily: FONTS.sans,
    fontSize: 10,
    color: PDF_COLORS.foreground,
    lineHeight: 1.4,
    marginTop: 4,
  },

  // Selo "Válida por X meses"
  selo: {
    marginTop: 16,
    alignSelf: 'flex-start',
    backgroundColor: PDF_COLORS.muted,
    borderWidth: 1,
    borderColor: PDF_COLORS.border,
    borderRadius: 7,
    paddingVertical: 7,
    paddingHorizontal: 13,
  },
  seloTexto: {
    fontFamily: FONTS.sans,
    fontWeight: 600,
    fontSize: 11,
    color: PDF_COLORS.primary,
  },
})

// ----- Componente principal -----

export function TemplatePDF({ dados }: { dados: DadosPDFPrescricao }) {
  const { organizacao, paciente, profissional, prescricao, dataAtendimento, geradoEm } =
    dados

  const idade = calcularIdade(paciente.data_nascimento)
  const cpfFmt = formatarCPF(paciente.cpf)
  const nascFmt = formatarDataNasc(paciente.data_nascimento)
  const dataAtendFmt = formatarDataAtendimento(dataAtendimento)

  const tratamentosTxt = (prescricao.tratamentos ?? [])
    .map(formatarTratamento)
    .join(', ')
  const temObservacoes =
    !!prescricao.observacoes && prescricao.observacoes.trim().length > 0
  const validadeMeses =
    typeof prescricao.validade_meses === 'number' && prescricao.validade_meses > 0
      ? prescricao.validade_meses
      : null

  return (
    <Document
      title={`Prescrição - ${paciente.nome}`}
      author={profissional.nome_completo ?? organizacao.nome_clinica}
      subject="Prescrição óptica"
      creator="OptoMax"
      producer="OptoMax"
    >
      <Page size="A4" style={styles.page}>
        {/* ===== Cabeçalho ===== */}
        <Cabecalho
          nomeClinica={organizacao.nome_clinica}
          endereco={organizacao.endereco}
          telefone={organizacao.telefone}
          tipoDocumento="Receita / Prescrição"
          data={`Emitida em ${dataAtendFmt}`}
        />

        {/* ===== Paciente ===== */}
        <View style={styles.bloco}>
          <Text style={styles.blocoTitulo}>Paciente</Text>
          <Text style={styles.pacienteNome}>{paciente.nome}</Text>
          <Text style={styles.pacienteInfo}>
            {[
              idade !== null ? `${idade} anos` : null,
              paciente.data_nascimento ? `nasc. ${nascFmt}` : null,
              cpfFmt !== '—' ? `CPF ${cpfFmt}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>

        {/* ===== Prescrição ===== */}
        <View style={styles.bloco}>
          <Text style={styles.blocoTitulo}>Prescrição</Text>

          <TabelaRx od={prescricao.od} oe={prescricao.oe} />

          {/* Detalhes da lente — omitidos quando vazios */}
          <View style={{ marginTop: 12 }}>
            {prescricao.tipo_lente && (
              <View style={styles.detalheLinha}>
                <Text style={styles.detalheRotulo}>Tipo de lente</Text>
                <Text style={styles.detalheValor}>
                  {capitalizar(prescricao.tipo_lente)}
                </Text>
              </View>
            )}
            {tratamentosTxt !== '' && (
              <View style={styles.detalheLinha}>
                <Text style={styles.detalheRotulo}>Tratamentos</Text>
                <Text style={styles.detalheValor}>{tratamentosTxt}</Text>
              </View>
            )}
          </View>
        </View>

        {/* ===== Observações (só se preenchidas) ===== */}
        {temObservacoes && (
          <View style={styles.bloco}>
            <Text style={styles.blocoTitulo}>Observações</Text>
            <Text style={styles.observacoesTexto}>{prescricao.observacoes}</Text>
          </View>
        )}

        {/* ===== Validade (só se preenchida) ===== */}
        {validadeMeses !== null && (
          <View style={styles.selo}>
            <Text style={styles.seloTexto}>
              Válida por {validadeMeses} {validadeMeses === 1 ? 'mês' : 'meses'}
            </Text>
          </View>
        )}

        {/* ===== Carimbo ===== */}
        <Carimbo
          nomeCompleto={profissional.nome_completo}
          croCboo={profissional.cro_cboo}
          formacoes={profissional.formacoes}
          assinaturaDataUrl={profissional.signature_data_url}
        />

        {/* ===== Rodapé jurídico ===== */}
        <RodapeJuridico geradoEm={geradoEm} nomeClinica={organizacao.nome_clinica} />
      </Page>
    </Document>
  )
}
