// Template do PDF da ficha clínica (resumida e completa).
// Renderizado server-side com @react-pdf/renderer (não usa DOM/React-DOM).
// O componente é PURO — recebe todos os dados já consolidados via props.
//
// Renderização condicional: cada seção só aparece se houver ao menos UM campo
// preenchido (helper `temConteudo`). Ficha 100% vazia mostra apenas cabeçalho +
// identificação + rodapé.
//
// Dois layouts por `modelo`:
//   - resumido  → 1 página, profissional+paciente em 2 colunas, anamnese em 2
//     colunas, dioptria atual + nova prescrição, conduta.
//   - completo  → seções agrupadas por fase (Anamnese · Exames · Refração ·
//     Conclusão) com faixa de título; cabeçalho/rodapé repetem por página.
//
// A refração/nova prescrição AGORA aparece dentro da ficha (decisão 29/05) —
// antes era exclusiva do PDF de receita. A receita continua tendo PDF próprio.

import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { FichaClinica } from '@/types/clinical'
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

export type DadosOrganizacaoFicha = {
  nome_clinica: string
  endereco: string | null
  telefone: string | null
}

export type DadosPacienteFicha = {
  nome: string
  cpf: string | null
  data_nascimento: string | null
  idade: number | null
}

export type DadosProfissionalFicha = {
  nome_completo: string | null
  cro_cboo: string | null
  formacoes: string[] | null
  signature_data_url: string | null
}

export type DadosAtendimentoFicha = {
  data_hora: string | null
  duracao: number | null
  titulo: string | null
} | null

export type DadosPDFFicha = {
  organizacao: DadosOrganizacaoFicha
  paciente: DadosPacienteFicha
  profissional: DadosProfissionalFicha
  ficha: FichaClinica // JSONB completo (todas as chaves opcionais)
  modelo: 'resumido' | 'completo'
  dataAtendimento: string | null // finalizado_em ou created_at
  geradoEm: string // ISO — momento da geração do PDF (rodapé jurídico)
  atendimento?: DadosAtendimentoFicha // tipo/duração/data-hora (bloco do resumido)
}

// ----- Helpers de formatação (puros, auto-contidos) -----

function formatarCPF(cpf: string | null): string {
  if (!cpf) return '—'
  const limpo = cpf.replace(/\D/g, '')
  if (limpo.length !== 11) return cpf
  return limpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

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

// Data + hora do atendimento (bloco "Atendimento" do resumido).
function formatarDataHoraAtend(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
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
  return `${data}, ${hora}`
}

// "—" para vazio, mantém o conteúdo como recebido (texto livre clínico).
function mostrar(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'string') {
    const t = v.trim()
    return t === '' ? '—' : t
  }
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não'
  return '—'
}

// ----- Detector de conteúdo recursivo -----
// string vazia / null / undefined / false → vazio. true / number / array|objeto
// com algum conteúdo → conteúdo.
function temConteudo(secao: unknown): boolean {
  if (secao === null || secao === undefined) return false
  if (typeof secao === 'string') return secao.trim().length > 0
  if (typeof secao === 'number') return Number.isFinite(secao)
  if (typeof secao === 'boolean') return secao === true
  if (Array.isArray(secao)) return secao.some((item) => temConteudo(item))
  if (typeof secao === 'object') {
    for (const v of Object.values(secao as Record<string, unknown>)) {
      if (temConteudo(v)) return true
    }
    return false
  }
  return false
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

  // ---- Bloco genérico ----
  bloco: { marginTop: 14 },
  blocoTitulo: {
    fontFamily: FONTS.sans,
    fontWeight: 700,
    fontSize: 8,
    color: PDF_COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },

  // ---- Faixa de fase (modelo completo) ----
  phaseband: {
    fontFamily: FONTS.serif,
    fontWeight: 600,
    fontSize: 13,
    color: PDF_COLORS.primary,
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLORS.border,
    paddingBottom: 5,
    marginTop: 18,
    marginBottom: 2,
  },

  // ---- 2 colunas ----
  colunas: { flexDirection: 'row', gap: 26 },
  coluna: { flex: 1 },

  // ---- Identificação ----
  nomeDestaque: {
    fontFamily: FONTS.sans,
    fontWeight: 700,
    fontSize: 13,
    color: PDF_COLORS.foreground,
  },
  infoSub: {
    fontFamily: FONTS.sans,
    fontSize: 10,
    color: PDF_COLORS.mutedForegroundDark,
    marginTop: 2,
  },

  // ---- Listas chave/valor ----
  linhaKV: { flexDirection: 'row', marginTop: 3 },
  kvRotulo: {
    fontFamily: FONTS.sans,
    fontSize: 9,
    color: PDF_COLORS.textTertiary,
    width: 140,
  },
  kvValor: { fontFamily: FONTS.sans, fontSize: 10, color: PDF_COLORS.foreground, flex: 1 },

  // Par em 2 colunas (anamnese do resumido): rótulo em cima, valor embaixo.
  par2Box: { marginBottom: 5 },
  par2Valor: {
    fontFamily: FONTS.sans,
    fontSize: 10,
    color: PDF_COLORS.foreground,
    marginTop: 1,
  },

  textoLongo: {
    fontFamily: FONTS.sans,
    fontSize: 10,
    color: PDF_COLORS.foreground,
    lineHeight: 1.4,
    marginTop: 4,
  },

  // ---- Tabela genérica OD/OE (exames não-grau) ----
  tabela: {
    borderWidth: 1,
    borderColor: PDF_COLORS.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 4,
  },
  tabelaHeaderRow: {
    flexDirection: 'row',
    backgroundColor: PDF_COLORS.muted,
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLORS.border,
  },
  tabelaRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLORS.border,
  },
  tabelaRowUltima: { flexDirection: 'row' },
  tabelaCellRotulo: {
    paddingVertical: 5,
    paddingHorizontal: 4,
    backgroundColor: PDF_COLORS.muted,
    borderRightWidth: 1,
    borderRightColor: PDF_COLORS.border,
    fontFamily: FONTS.sans,
    fontWeight: 700,
    fontSize: 8.5,
    color: PDF_COLORS.mutedForegroundDark,
    textAlign: 'center',
  },
  tabelaCellHeader: {
    paddingVertical: 5,
    paddingHorizontal: 4,
    fontFamily: FONTS.sans,
    fontWeight: 700,
    fontSize: 8,
    color: PDF_COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    textAlign: 'center',
    borderRightWidth: 1,
    borderRightColor: PDF_COLORS.border,
  },
  tabelaCellHeaderUltima: {
    paddingVertical: 5,
    paddingHorizontal: 4,
    fontFamily: FONTS.sans,
    fontWeight: 700,
    fontSize: 8,
    color: PDF_COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  tabelaCellValor: {
    paddingVertical: 5,
    paddingHorizontal: 4,
    fontFamily: FONTS.sans,
    fontSize: 9.5,
    color: PDF_COLORS.foreground,
    textAlign: 'center',
    borderRightWidth: 1,
    borderRightColor: PDF_COLORS.border,
  },
  tabelaCellValorUltima: {
    paddingVertical: 5,
    paddingHorizontal: 4,
    fontFamily: FONTS.sans,
    fontSize: 9.5,
    color: PDF_COLORS.foreground,
    textAlign: 'center',
  },

  observacoesBox: {
    marginTop: 6,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: PDF_COLORS.border,
  },
  observacoesRotulo: {
    fontFamily: FONTS.sans,
    fontSize: 8,
    color: PDF_COLORS.textQuaternary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  observacoesTexto: {
    fontFamily: FONTS.sans,
    fontSize: 10,
    color: PDF_COLORS.foreground,
    marginTop: 2,
    lineHeight: 1.4,
  },
})

// ----- Componentes auxiliares de layout -----

// Wrapper de seção: título + bloco. `wrap={false}` evita título órfão.
function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <View style={styles.bloco} wrap={false}>
      <Text style={styles.blocoTitulo}>{titulo}</Text>
      {children}
    </View>
  )
}

// Linha chave/valor — renderiza só se o valor formatado for não-vazio.
function LinhaKV({ rotulo, valor }: { rotulo: string; valor: string }) {
  if (valor === '—' || valor === '') return null
  return (
    <View style={styles.linhaKV}>
      <Text style={styles.kvRotulo}>{rotulo}</Text>
      <Text style={styles.kvValor}>{valor}</Text>
    </View>
  )
}

// Par rótulo/valor empilhado (usado nas 2 colunas da anamnese resumida).
function Par2({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View style={styles.par2Box}>
      <Text style={styles.observacoesRotulo}>{rotulo}</Text>
      <Text style={styles.par2Valor}>{valor}</Text>
    </View>
  )
}

// Bloco de observações da seção — só aparece se preenchido.
function Observacoes({ texto }: { texto: string | undefined | null }) {
  if (!texto || texto.trim() === '') return null
  return (
    <View style={styles.observacoesBox}>
      <Text style={styles.observacoesRotulo}>Observações</Text>
      <Text style={styles.observacoesTexto}>{texto}</Text>
    </View>
  )
}

// Helpers para construir as células da tabela com largura dinâmica.
function celRotulo(width: string) {
  return { ...styles.tabelaCellRotulo, width }
}
function celHeader(width: string, ultima = false) {
  return ultima
    ? { ...styles.tabelaCellHeaderUltima, width }
    : { ...styles.tabelaCellHeader, width }
}
function celValor(width: string, ultima = false) {
  return ultima
    ? { ...styles.tabelaCellValorUltima, width }
    : { ...styles.tabelaCellValor, width }
}

// Tabela OD/OE genérica com N colunas de mesma largura (exames não-grau).
function TabelaOlhos({
  cabecalhos,
  linhas,
  larguraRotulo = '12%',
}: {
  cabecalhos: string[]
  linhas: Array<{ rotulo: string; valores: string[] }>
  larguraRotulo?: string
}) {
  const rotuloNum = parseFloat(larguraRotulo)
  const restoNum = 100 - rotuloNum
  const colNum = cabecalhos.length
  const wCol = `${(restoNum / colNum).toFixed(2)}%`

  return (
    <View style={styles.tabela}>
      <View style={styles.tabelaHeaderRow}>
        <Text style={celRotulo(larguraRotulo)}> </Text>
        {cabecalhos.map((c, i) => (
          <Text key={c} style={celHeader(wCol, i === cabecalhos.length - 1)}>
            {c}
          </Text>
        ))}
      </View>
      {linhas.map((linha, idx) => {
        const ultimaLinha = idx === linhas.length - 1
        return (
          <View
            key={linha.rotulo}
            style={ultimaLinha ? styles.tabelaRowUltima : styles.tabelaRow}
          >
            <Text style={celRotulo(larguraRotulo)}>{linha.rotulo}</Text>
            {linha.valores.map((v, i) => (
              <Text
                key={`${linha.rotulo}-${i}`}
                style={celValor(wCol, i === linha.valores.length - 1)}
              >
                {v || '—'}
              </Text>
            ))}
          </View>
        )
      })}
    </View>
  )
}

// ----- Helpers de mapeamento de enums para rótulos legíveis -----

const ROTULOS_USO_OCULOS: Record<string, string> = {
  sim: 'Sim',
  nao: 'Não',
  as_vezes: 'Às vezes',
}

const ROTULOS_METODO_TONO: Record<string, string> = {
  aplanacao: 'Aplanação',
  sopro: 'Sopro',
  identacao: 'Identação',
  rebote: 'Rebote',
}

const ROTULOS_URGENCIA: Record<string, string> = {
  rotina: 'Rotina',
  preferencial: 'Preferencial',
  urgente: 'Urgente',
}

const ROTULOS_FAMILIAR: Record<string, string> = {
  glaucoma: 'Glaucoma',
  catarata: 'Catarata',
  dmri: 'DMRI (degeneração macular)',
  diabetes: 'Diabetes',
  pressao_alta: 'Pressão alta',
  ceratocone: 'Ceratocone',
}

const ROTULOS_OLHO_DOMINANTE: Record<string, string> = {
  od: 'OD',
  oe: 'OE',
}

const ROTULOS_HIRSCHBERG: Record<string, string> = {
  centrado: 'Centrado',
  descentralizado: 'Descentralizado',
}

// ----- Renderizadores de cada seção (todos puros, retornam null se vazia) -----

function SecaoAnamnese({ a }: { a: FichaClinica['anamnese'] }) {
  if (!a || !temConteudo(a)) return null
  const usoLabel = a.uso_oculos_atual
    ? ROTULOS_USO_OCULOS[a.uso_oculos_atual] ?? '—'
    : '—'
  return (
    <Secao titulo="Anamnese">
      {a.queixa_principal && a.queixa_principal.trim() !== '' && (
        <>
          <Text style={styles.observacoesRotulo}>Queixa principal</Text>
          <Text style={styles.textoLongo}>{a.queixa_principal}</Text>
        </>
      )}
      {a.historia_doenca_atual && a.historia_doenca_atual.trim() !== '' && (
        <>
          <Text style={[styles.observacoesRotulo, { marginTop: 6 }]}>
            História da doença atual
          </Text>
          <Text style={styles.textoLongo}>{a.historia_doenca_atual}</Text>
        </>
      )}
      <LinhaKV rotulo="Uso de óculos atual:" valor={usoLabel} />
      <LinhaKV rotulo="Tempo de uso:" valor={mostrar(a.tempo_uso_oculos)} />
      <LinhaKV rotulo="Última consulta:" valor={mostrar(a.ultima_consulta)} />
      <LinhaKV rotulo="Alergias:" valor={mostrar(a.alergias)} />
      <LinhaKV rotulo="Medicamentos em uso:" valor={mostrar(a.medicamentos_uso)} />
      <LinhaKV rotulo="Cirurgias oculares:" valor={mostrar(a.cirurgias_oculares)} />
      <Observacoes texto={a.observacoes} />
    </Secao>
  )
}

// Anamnese em 2 colunas (modelo resumido). Pares vazios são omitidos.
function AnamneseResumida({ a }: { a: FichaClinica['anamnese'] }) {
  if (!a || !temConteudo(a)) return null
  const usoLabel = a.uso_oculos_atual ? ROTULOS_USO_OCULOS[a.uso_oculos_atual] ?? null : null

  const pares: Array<{ rotulo: string; valor: string }> = []
  const push = (rotulo: string, valor: string | null | undefined) => {
    if (valor && valor.trim() !== '') pares.push({ rotulo, valor })
  }
  push('Queixa principal', a.queixa_principal)
  push('História atual', a.historia_doenca_atual)
  push('Usa óculos', usoLabel)
  push('Tempo de uso', a.tempo_uso_oculos)
  push('Última consulta', a.ultima_consulta)
  push('Alergias', a.alergias)
  push('Medicamentos', a.medicamentos_uso)
  push('Cirurgias', a.cirurgias_oculares)

  const temObs = !!a.observacoes && a.observacoes.trim() !== ''
  if (pares.length === 0 && !temObs) return null

  const meio = Math.ceil(pares.length / 2)
  const col1 = pares.slice(0, meio)
  const col2 = pares.slice(meio)

  return (
    <Secao titulo="Anamnese">
      {pares.length > 0 && (
        <View style={styles.colunas}>
          <View style={styles.coluna}>
            {col1.map((p) => (
              <Par2 key={p.rotulo} rotulo={p.rotulo} valor={p.valor} />
            ))}
          </View>
          <View style={styles.coluna}>
            {col2.map((p) => (
              <Par2 key={p.rotulo} rotulo={p.rotulo} valor={p.valor} />
            ))}
          </View>
        </View>
      )}
      <Observacoes texto={a.observacoes} />
    </Secao>
  )
}

function SecaoAnamneseFamiliar({ af }: { af: FichaClinica['anamnese_familiar'] }) {
  if (!af || !temConteudo(af)) return null
  const condicoes: string[] = []
  for (const [key, label] of Object.entries(ROTULOS_FAMILIAR)) {
    const v = (af as Record<string, unknown>)[key]
    if (v === true) condicoes.push(label)
  }
  return (
    <Secao titulo="Anamnese familiar">
      {condicoes.length > 0 ? (
        <Text style={styles.textoLongo}>{condicoes.join(' · ')}</Text>
      ) : (
        <Text style={styles.textoLongo}>Sem condições marcadas.</Text>
      )}
      <LinhaKV rotulo="Outras:" valor={mostrar(af.outras)} />
    </Secao>
  )
}

function SecaoAcuidade({
  titulo,
  av,
}: {
  titulo: string
  av: FichaClinica['acuidade_visual_sc']
}) {
  if (!av || !temConteudo(av)) return null
  const linha = (
    rotulo: string,
    longe: { snellen?: string } | undefined,
    perto: { snellen?: string } | undefined,
  ) => ({
    rotulo,
    valores: [mostrar(longe?.snellen), mostrar(perto?.snellen)],
  })
  return (
    <Secao titulo={titulo}>
      <TabelaOlhos
        cabecalhos={['Longe', 'Perto']}
        linhas={[
          linha('OD', av.od_longe, av.od_perto),
          linha('OE', av.oe_longe, av.oe_perto),
          linha('AO', av.ao_longe, av.ao_perto),
        ]}
      />
      <Observacoes texto={av.observacoes} />
    </Secao>
  )
}

function SecaoReflexosPupilares({ rp }: { rp: FichaClinica['reflexos_pupilares'] }) {
  if (!rp || !temConteudo(rp)) return null
  return (
    <Secao titulo="Reflexos pupilares">
      <TabelaOlhos
        cabecalhos={['Fotomotor', 'Consensual', 'Acomodativo']}
        linhas={[
          {
            rotulo: 'OD',
            valores: [
              mostrar(rp.od?.fotomotor),
              mostrar(rp.od?.consensual),
              mostrar(rp.od?.acomodativo),
            ],
          },
          {
            rotulo: 'OE',
            valores: [
              mostrar(rp.oe?.fotomotor),
              mostrar(rp.oe?.consensual),
              mostrar(rp.oe?.acomodativo),
            ],
          },
        ]}
      />
      <Observacoes texto={rp.observacoes} />
    </Secao>
  )
}

function SecaoAvaliacaoMotora({ am }: { am: FichaClinica['avaliacao_motora'] }) {
  if (!am || !temConteudo(am)) return null
  return (
    <Secao titulo="Avaliação motora">
      <LinhaKV rotulo="Ducções:" valor={capitalizar(am.duccoes?.resultado ?? null)} />
      {am.duccoes?.observacao && am.duccoes.observacao.trim() !== '' && (
        <LinhaKV rotulo="  obs. ducções:" valor={am.duccoes.observacao} />
      )}
      <LinhaKV rotulo="Versões:" valor={capitalizar(am.versoes?.resultado ?? null)} />
      {am.versoes?.observacao && am.versoes.observacao.trim() !== '' && (
        <LinhaKV rotulo="  obs. versões:" valor={am.versoes.observacao} />
      )}
      <Observacoes texto={am.observacoes} />
    </Secao>
  )
}

function SecaoBiomicroscopia({ b }: { b: FichaClinica['biomicroscopia'] }) {
  if (!b || !temConteudo(b)) return null
  const campos: Array<keyof NonNullable<typeof b.od>> = [
    'sobrancelha',
    'palpebra',
    'cilios',
    'cornea',
    'iris',
    'conjuntiva',
    'esclera',
    'cristalino',
    'pupilas',
  ]
  const rotulos: Record<string, string> = {
    sobrancelha: 'Sobrancelha',
    palpebra: 'Pálpebra',
    cilios: 'Cílios',
    cornea: 'Córnea',
    iris: 'Íris',
    conjuntiva: 'Conjuntiva',
    esclera: 'Esclera',
    cristalino: 'Cristalino',
    pupilas: 'Pupilas',
  }
  return (
    <Secao titulo="Biomicroscopia">
      <TabelaOlhos
        cabecalhos={['OD', 'OE']}
        larguraRotulo="30%"
        linhas={campos.map((c) => ({
          rotulo: rotulos[c as string],
          valores: [mostrar(b.od?.[c]), mostrar(b.oe?.[c])],
        }))}
      />
      <Observacoes texto={b.observacoes} />
    </Secao>
  )
}

function SecaoOftalmoscopia({ o }: { o: FichaClinica['oftalmoscopia'] }) {
  if (!o || !temConteudo(o)) return null
  const campos: Array<keyof NonNullable<typeof o.od>> = [
    'dioptria_lente',
    'bruckner',
    'pupila',
    'escavacao',
    'relacao_av',
    'macula',
    'fixacao',
  ]
  const rotulos: Record<string, string> = {
    dioptria_lente: 'Dioptria da lente',
    bruckner: 'Brückner',
    pupila: 'Pupila',
    escavacao: 'Escavação',
    relacao_av: 'Relação A/V',
    macula: 'Mácula',
    fixacao: 'Fixação',
  }
  return (
    <Secao titulo="Oftalmoscopia direta">
      <TabelaOlhos
        cabecalhos={['OD', 'OE']}
        larguraRotulo="30%"
        linhas={campos.map((c) => ({
          rotulo: rotulos[c as string],
          valores: [mostrar(o.od?.[c]), mostrar(o.oe?.[c])],
        }))}
      />
      <Observacoes texto={o.observacoes} />
    </Secao>
  )
}

function SecaoTonometria({ t }: { t: FichaClinica['tonometria'] }) {
  if (!t || !temConteudo(t)) return null
  const metodoLabel = t.metodo ? ROTULOS_METODO_TONO[t.metodo] ?? '—' : '—'
  return (
    <Secao titulo="Tonometria">
      <LinhaKV
        rotulo="PIO OD:"
        valor={t.od_pio !== null && t.od_pio !== undefined ? `${t.od_pio} mmHg` : '—'}
      />
      <LinhaKV
        rotulo="PIO OE:"
        valor={t.oe_pio !== null && t.oe_pio !== undefined ? `${t.oe_pio} mmHg` : '—'}
      />
      <LinhaKV rotulo="Método:" valor={metodoLabel} />
      <LinhaKV rotulo="Horário:" valor={mostrar(t.horario)} />
      <Observacoes texto={t.observacoes} />
    </Secao>
  )
}

function SecaoCeratometria({ c }: { c: FichaClinica['ceratometria'] }) {
  if (!c || !temConteudo(c)) return null
  const fmt = (v: number | null | undefined) =>
    v !== null && v !== undefined && Number.isFinite(v) ? String(v) : '—'
  return (
    <Secao titulo="Ceratometria">
      <TabelaOlhos
        cabecalhos={['K1', 'K2', 'Eixo']}
        linhas={[
          { rotulo: 'OD', valores: [fmt(c.od?.k1), fmt(c.od?.k2), fmt(c.od?.eixo)] },
          { rotulo: 'OE', valores: [fmt(c.oe?.k1), fmt(c.oe?.k2), fmt(c.oe?.eixo)] },
        ]}
      />
      <Observacoes texto={c.observacoes} />
    </Secao>
  )
}

// Lensometria — leitura do óculos atual. Grau formatado via TabelaRx.
function SecaoLensometria({ l }: { l: FichaClinica['lensometria'] }) {
  if (!l || !temConteudo(l)) return null
  return (
    <Secao titulo="Lensometria">
      <TabelaRx od={l.od} oe={l.oe} compacto />
      {l.tipo_lente && <LinhaKV rotulo="Tipo de lente:" valor={capitalizar(l.tipo_lente)} />}
      <Observacoes texto={l.observacoes} />
    </Secao>
  )
}

// Dioptria atual — grade dióptrica do paciente. Grau formatado via TabelaRx.
function SecaoDioptriaAtual({ d }: { d: FichaClinica['dioptria_atual'] }) {
  if (!d || !temConteudo(d)) return null
  return (
    <Secao titulo="Dioptria atual">
      <TabelaRx od={d.od} oe={d.oe} compacto />
      {d.tipo_lente && <LinhaKV rotulo="Tipo de lente:" valor={capitalizar(d.tipo_lente)} />}
      <Observacoes texto={d.observacoes} />
    </Secao>
  )
}

function SecaoAutorrefrator({ a }: { a: FichaClinica['autorrefrator'] }) {
  if (!a || !temConteudo(a)) return null
  return (
    <Secao titulo="Autorrefrator">
      <TabelaOlhos
        cabecalhos={['ESF', 'CIL', 'EIXO']}
        linhas={[
          { rotulo: 'OD', valores: [mostrar(a.od?.esf), mostrar(a.od?.cil), mostrar(a.od?.eixo)] },
          { rotulo: 'OE', valores: [mostrar(a.oe?.esf), mostrar(a.oe?.cil), mostrar(a.oe?.eixo)] },
        ]}
      />
      <Observacoes texto={a.observacoes} />
    </Secao>
  )
}

function SecaoRetinoscopiaEstatica({ r }: { r: FichaClinica['retinoscopia_estatica'] }) {
  if (!r || !temConteudo(r)) return null
  return (
    <Secao titulo="Retinoscopia estática">
      <LinhaKV rotulo="OD:" valor={mostrar(r.od)} />
      <LinhaKV rotulo="OE:" valor={mostrar(r.oe)} />
      <Observacoes texto={r.observacoes} />
    </Secao>
  )
}

function SecaoRetinoscopiaDinamica({ r }: { r: FichaClinica['retinoscopia_dinamica'] }) {
  if (!r || !temConteudo(r)) return null
  const fmt = (v: number | null | undefined) =>
    v !== null && v !== undefined && Number.isFinite(v) ? String(v) : '—'
  return (
    <Secao titulo="Retinoscopia dinâmica">
      <LinhaKV rotulo="OD:" valor={fmt(r.od_valor)} />
      <LinhaKV rotulo="OE:" valor={fmt(r.oe_valor)} />
      <Observacoes texto={r.observacoes} />
    </Secao>
  )
}

function SecaoSubjetivo({ s }: { s: FichaClinica['subjetivo'] }) {
  if (!s || !temConteudo(s)) return null
  return (
    <Secao titulo="Subjetivo">
      <TabelaOlhos
        cabecalhos={['Refração', 'AV Longe', 'AV Perto']}
        linhas={[
          {
            rotulo: 'OD',
            valores: [
              mostrar(s.od?.campo_livre),
              mostrar(s.od?.av_longe),
              mostrar(s.od?.av_perto),
            ],
          },
          {
            rotulo: 'OE',
            valores: [
              mostrar(s.oe?.campo_livre),
              mostrar(s.oe?.av_longe),
              mostrar(s.oe?.av_perto),
            ],
          },
        ]}
      />
      <Observacoes texto={s.observacoes} />
    </Secao>
  )
}

// Refração final / nova prescrição — agora exibida na ficha (decisão 29/05).
// Reaproveita TabelaRx (grau formatado) + tipo de lente, tratamentos e validade.
function SecaoRefracaoFinal({
  p,
  titulo,
}: {
  p: FichaClinica['nova_prescricao']
  titulo: string
}) {
  if (!p || !temConteudo(p)) return null
  const tratamentos = (p.tratamentos ?? []).map(formatarTratamento).join(', ')
  const validade =
    typeof p.validade_meses === 'number' && p.validade_meses > 0
      ? `${p.validade_meses} ${p.validade_meses === 1 ? 'mês' : 'meses'}`
      : null
  return (
    <Secao titulo={titulo}>
      <TabelaRx od={p.od} oe={p.oe} compacto />
      {p.tipo_lente && <LinhaKV rotulo="Tipo de lente:" valor={capitalizar(p.tipo_lente)} />}
      {tratamentos !== '' && <LinhaKV rotulo="Tratamentos:" valor={tratamentos} />}
      {validade && <LinhaKV rotulo="Validade:" valor={validade} />}
      <Observacoes texto={p.observacoes} />
    </Secao>
  )
}

function SecaoCoverTest({ ct }: { ct: FichaClinica['cover_test'] }) {
  if (!ct || !temConteudo(ct)) return null
  return (
    <Secao titulo="Cover test">
      <LinhaKV rotulo="6 metros:" valor={mostrar(ct.seis_metros?.magnitude)} />
      <LinhaKV rotulo="40 cm:" valor={mostrar(ct.quarenta_cm?.magnitude)} />
      <LinhaKV rotulo="20 cm:" valor={mostrar(ct.vinte_cm?.magnitude)} />
      <Observacoes texto={ct.observacoes} />
    </Secao>
  )
}

function SecaoTestesMotoresComp({
  tmc,
}: {
  tmc: FichaClinica['testes_motores_complementares']
}) {
  if (!tmc || !temConteudo(tmc)) return null
  const olhoLabel = tmc.olho_dominante
    ? ROTULOS_OLHO_DOMINANTE[tmc.olho_dominante] ?? '—'
    : '—'
  const hirschLabel = tmc.hirschberg
    ? ROTULOS_HIRSCHBERG[tmc.hirschberg] ?? '—'
    : '—'
  return (
    <Secao titulo="Testes motores complementares">
      <LinhaKV rotulo="Olho dominante:" valor={olhoLabel} />
      <LinhaKV rotulo="Hirschberg:" valor={hirschLabel} />
      <LinhaKV rotulo="Krimsky:" valor={mostrar(tmc.krimsky)} />
      <Observacoes texto={tmc.observacoes} />
    </Secao>
  )
}

function SecaoPPCePPA({
  ppc,
  ppa,
}: {
  ppc: FichaClinica['ppc']
  ppa: FichaClinica['ppa']
}) {
  if (!temConteudo(ppc) && !temConteudo(ppa)) return null
  return (
    <Secao titulo="PPC / PPA">
      {temConteudo(ppc) && (
        <>
          <LinhaKV rotulo="PPC objeto real:" valor={mostrar(ppc?.objeto_real)} />
          <LinhaKV rotulo="PPC luz:" valor={mostrar(ppc?.luz)} />
          <LinhaKV rotulo="PPC luz + filtro:" valor={mostrar(ppc?.luz_filtro)} />
        </>
      )}
      {temConteudo(ppa) && <LinhaKV rotulo="PPA:" valor={mostrar(ppa?.valor)} />}
      <Observacoes texto={ppc?.observacoes} />
    </Secao>
  )
}

function SecaoReservasFusionais({ rf }: { rf: FichaClinica['reservas_fusionais'] }) {
  if (!rf || !temConteudo(rf)) return null
  return (
    <Secao titulo="Reservas fusionais">
      <LinhaKV rotulo="RFPL (positivas longe):" valor={mostrar(rf.rfpl)} />
      <LinhaKV rotulo="RFPP (positivas perto):" valor={mostrar(rf.rfpp)} />
      <LinhaKV rotulo="RFNL (negativas longe):" valor={mostrar(rf.rfnl)} />
      <LinhaKV rotulo="RFNP (negativas perto):" valor={mostrar(rf.rfnp)} />
      <Observacoes texto={rf.observacoes} />
    </Secao>
  )
}

function SecaoTestesAcomodativos({ ta }: { ta: FichaClinica['testes_acomodativos'] }) {
  if (!ta || !temConteudo(ta)) return null
  const fmt = (v: number | null | undefined) =>
    v !== null && v !== undefined && Number.isFinite(v) ? String(v) : '—'
  return (
    <Secao titulo="Testes acomodativos">
      <LinhaKV rotulo="AA OD:" valor={fmt(ta.aa_od)} />
      <LinhaKV rotulo="AA OE:" valor={fmt(ta.aa_oe)} />
      <LinhaKV rotulo="AA AO:" valor={fmt(ta.aa_ao)} />
      <LinhaKV rotulo="Facilidade acomodativa:" valor={mostrar(ta.facilidade_acomodativa)} />
      <Observacoes texto={ta.observacoes} />
    </Secao>
  )
}

function SecaoVisaoCores({ v }: { v: FichaClinica['visao_cores'] }) {
  if (!v || !temConteudo(v)) return null
  return (
    <Secao titulo="Visão de cores">
      <LinhaKV rotulo="Teste:" valor={mostrar(v.teste_usado)} />
      <LinhaKV rotulo="Resultado OD:" valor={mostrar(v.resultado_od)} />
      <LinhaKV rotulo="Resultado OE:" valor={mostrar(v.resultado_oe)} />
      <Observacoes texto={v.observacoes} />
    </Secao>
  )
}

function SecaoCamposVisuais({ cv }: { cv: FichaClinica['campos_visuais'] }) {
  if (!cv || !temConteudo(cv)) return null
  return (
    <Secao titulo="Campos visuais (confrontação)">
      <LinhaKV rotulo="OD:" valor={capitalizar(cv.od?.resultado ?? null)} />
      {cv.od?.observacao && cv.od.observacao.trim() !== '' && (
        <LinhaKV rotulo="  obs. OD:" valor={cv.od.observacao} />
      )}
      <LinhaKV rotulo="OE:" valor={capitalizar(cv.oe?.resultado ?? null)} />
      {cv.oe?.observacao && cv.oe.observacao.trim() !== '' && (
        <LinhaKV rotulo="  obs. OE:" valor={cv.oe.observacao} />
      )}
      <Observacoes texto={cv.observacoes} />
    </Secao>
  )
}

function SecaoDiagnostico({ d }: { d: FichaClinica['diagnostico'] }) {
  if (!d || !temConteudo(d)) return null
  return (
    <Secao titulo="Diagnóstico">
      {d.hipoteses && d.hipoteses.trim() !== '' && (
        <>
          <Text style={styles.observacoesRotulo}>Hipóteses diagnósticas</Text>
          <Text style={styles.textoLongo}>{d.hipoteses}</Text>
        </>
      )}
      <LinhaKV rotulo="CID-10:" valor={mostrar(d.cid)} />
      <Observacoes texto={d.observacoes} />
    </Secao>
  )
}

function SecaoConduta({ h }: { h: FichaClinica['historico_observacoes'] }) {
  if (!h || !temConteudo(h)) return null
  return (
    <Secao titulo="Conduta">
      {h.conduta && h.conduta.trim() !== '' && (
        <>
          <Text style={styles.observacoesRotulo}>Conduta</Text>
          <Text style={styles.textoLongo}>{h.conduta}</Text>
        </>
      )}
      {h.observacoes_clinicas && h.observacoes_clinicas.trim() !== '' && (
        <>
          <Text style={[styles.observacoesRotulo, { marginTop: 6 }]}>
            Observações clínicas
          </Text>
          <Text style={styles.textoLongo}>{h.observacoes_clinicas}</Text>
        </>
      )}
      <LinhaKV rotulo="Retorno recomendado:" valor={mostrar(h.retorno_recomendado)} />
    </Secao>
  )
}

function SecaoEncaminhamento({ e }: { e: FichaClinica['encaminhamento'] }) {
  // Por decisão, encaminhamento só aparece se `necessario === true`.
  if (!e || e.necessario !== true) return null
  const urgLabel = e.urgencia ? ROTULOS_URGENCIA[e.urgencia] ?? '—' : '—'
  return (
    <Secao titulo="Encaminhamento">
      <LinhaKV rotulo="Especialidade:" valor={mostrar(e.especialidade)} />
      <LinhaKV rotulo="Urgência:" valor={urgLabel} />
      {e.motivo && e.motivo.trim() !== '' && (
        <>
          <Text style={[styles.observacoesRotulo, { marginTop: 6 }]}>Motivo</Text>
          <Text style={styles.textoLongo}>{e.motivo}</Text>
        </>
      )}
    </Secao>
  )
}

// ----- Bloco "Atendimento" (modelo resumido) -----
function BlocoAtendimento({ atendimento }: { atendimento?: DadosAtendimentoFicha }) {
  if (!atendimento) return null
  const tipo = atendimento.titulo
  const dataHora = formatarDataHoraAtend(atendimento.data_hora)
  const duracao =
    typeof atendimento.duracao === 'number' ? `${atendimento.duracao} min` : null
  if (!tipo && !dataHora && !duracao) return null
  return (
    <Secao titulo="Atendimento">
      <LinhaKV rotulo="Tipo:" valor={mostrar(tipo)} />
      <LinhaKV rotulo="Data / hora:" valor={dataHora ?? '—'} />
      <LinhaKV rotulo="Duração:" valor={duracao ?? '—'} />
    </Secao>
  )
}

// ----- Mapeamento de fases (modelo completo) -----
const CHAVES_ANAMNESE = ['anamnese', 'anamnese_familiar']
const CHAVES_EXAMES = [
  'acuidade_visual_sc',
  'acuidade_visual_cc',
  'reflexos_pupilares',
  'avaliacao_motora',
  'biomicroscopia',
  'oftalmoscopia',
  'tonometria',
  'ceratometria',
  'cover_test',
  'testes_motores_complementares',
  'ppc',
  'ppa',
  'reservas_fusionais',
  'testes_acomodativos',
  'visao_cores',
  'campos_visuais',
]
const CHAVES_REFRACAO = [
  'dioptria_atual',
  'lensometria',
  'autorrefrator',
  'retinoscopia_estatica',
  'retinoscopia_dinamica',
  'subjetivo',
  'nova_prescricao',
]
const CHAVES_CONCLUSAO = ['diagnostico', 'historico_observacoes', 'encaminhamento']

function faseAtiva(ficha: FichaClinica, chaves: string[]): boolean {
  return chaves.some((k) => temConteudo((ficha as Record<string, unknown>)[k]))
}

function Phaseband({ children }: { children: string }) {
  return (
    <Text style={styles.phaseband} wrap={false}>
      {children}
    </Text>
  )
}

// ----- Corpos por modelo -----

function CorpoResumido({
  ficha,
  atendimento,
}: {
  ficha: FichaClinica
  atendimento?: DadosAtendimentoFicha
}) {
  return (
    <>
      <BlocoAtendimento atendimento={atendimento} />
      <AnamneseResumida a={ficha.anamnese} />
      <SecaoAnamneseFamiliar af={ficha.anamnese_familiar} />
      <SecaoDioptriaAtual d={ficha.dioptria_atual} />
      <SecaoLensometria l={ficha.lensometria} />
      <SecaoRefracaoFinal p={ficha.nova_prescricao} titulo="Nova prescrição" />
      <SecaoConduta h={ficha.historico_observacoes} />
      <SecaoEncaminhamento e={ficha.encaminhamento} />
    </>
  )
}

function CorpoCompleto({ ficha }: { ficha: FichaClinica }) {
  return (
    <>
      {faseAtiva(ficha, CHAVES_ANAMNESE) && <Phaseband>Anamnese</Phaseband>}
      <SecaoAnamnese a={ficha.anamnese} />
      <SecaoAnamneseFamiliar af={ficha.anamnese_familiar} />

      {faseAtiva(ficha, CHAVES_EXAMES) && <Phaseband>Exames</Phaseband>}
      <SecaoAcuidade titulo="Acuidade visual sem correção" av={ficha.acuidade_visual_sc} />
      <SecaoAcuidade titulo="Acuidade visual com correção" av={ficha.acuidade_visual_cc} />
      <SecaoReflexosPupilares rp={ficha.reflexos_pupilares} />
      <SecaoAvaliacaoMotora am={ficha.avaliacao_motora} />
      <SecaoBiomicroscopia b={ficha.biomicroscopia} />
      <SecaoOftalmoscopia o={ficha.oftalmoscopia} />
      <SecaoTonometria t={ficha.tonometria} />
      <SecaoCeratometria c={ficha.ceratometria} />
      <SecaoCoverTest ct={ficha.cover_test} />
      <SecaoTestesMotoresComp tmc={ficha.testes_motores_complementares} />
      <SecaoPPCePPA ppc={ficha.ppc} ppa={ficha.ppa} />
      <SecaoReservasFusionais rf={ficha.reservas_fusionais} />
      <SecaoTestesAcomodativos ta={ficha.testes_acomodativos} />
      <SecaoVisaoCores v={ficha.visao_cores} />
      <SecaoCamposVisuais cv={ficha.campos_visuais} />

      {faseAtiva(ficha, CHAVES_REFRACAO) && <Phaseband>Refração</Phaseband>}
      <SecaoDioptriaAtual d={ficha.dioptria_atual} />
      <SecaoLensometria l={ficha.lensometria} />
      <SecaoAutorrefrator a={ficha.autorrefrator} />
      <SecaoRetinoscopiaEstatica r={ficha.retinoscopia_estatica} />
      <SecaoRetinoscopiaDinamica r={ficha.retinoscopia_dinamica} />
      <SecaoSubjetivo s={ficha.subjetivo} />
      <SecaoRefracaoFinal p={ficha.nova_prescricao} titulo="Refração final" />

      {faseAtiva(ficha, CHAVES_CONCLUSAO) && <Phaseband>Conclusão</Phaseband>}
      <SecaoDiagnostico d={ficha.diagnostico} />
      <SecaoConduta h={ficha.historico_observacoes} />
      <SecaoEncaminhamento e={ficha.encaminhamento} />
    </>
  )
}

// ----- Componente principal -----

export function TemplateFichaPDF({ dados }: { dados: DadosPDFFicha }) {
  const { organizacao, paciente, profissional, ficha, modelo, dataAtendimento, geradoEm, atendimento } =
    dados

  const resumido = modelo === 'resumido'
  const cpfFmt = formatarCPF(paciente.cpf)
  const nascFmt = formatarDataNasc(paciente.data_nascimento)
  const dataAtendFmt = formatarDataAtendimento(dataAtendimento)

  const infoPaciente = [
    cpfFmt !== '—' ? `CPF ${cpfFmt}` : null,
    paciente.idade !== null ? `${paciente.idade} anos` : null,
    paciente.data_nascimento ? `nasc. ${nascFmt}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const infoProfissional = [
    profissional.cro_cboo,
    profissional.formacoes && profissional.formacoes.length > 0
      ? profissional.formacoes.join(' · ')
      : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Document
      title={`Ficha clínica - ${paciente.nome}`}
      author={profissional.nome_completo ?? organizacao.nome_clinica}
      subject="Ficha clínica de atendimento"
      creator="OptoMax"
      producer="OptoMax"
    >
      <Page size="A4" style={styles.page}>
        {/* ===== Cabeçalho (fixo nas páginas do modelo completo) ===== */}
        <Cabecalho
          nomeClinica={organizacao.nome_clinica}
          endereco={organizacao.endereco}
          telefone={organizacao.telefone}
          tipoDocumento={`Ficha clínica · ${resumido ? 'resumida' : 'completa'}`}
          data={dataAtendFmt}
          fixed={!resumido}
        />

        {/* ===== Identificação ===== */}
        {resumido ? (
          <View style={[styles.colunas, styles.bloco]}>
            {profissional.nome_completo && (
              <View style={styles.coluna}>
                <Text style={styles.blocoTitulo}>Profissional</Text>
                <Text style={styles.nomeDestaque}>{profissional.nome_completo}</Text>
                {infoProfissional !== '' && (
                  <Text style={styles.infoSub}>{infoProfissional}</Text>
                )}
              </View>
            )}
            <View style={styles.coluna}>
              <Text style={styles.blocoTitulo}>Paciente</Text>
              <Text style={styles.nomeDestaque}>{paciente.nome}</Text>
              {infoPaciente !== '' && <Text style={styles.infoSub}>{infoPaciente}</Text>}
            </View>
          </View>
        ) : (
          <>
            {profissional.nome_completo && (
              <View style={styles.bloco}>
                <Text style={styles.blocoTitulo}>Profissional</Text>
                <Text style={styles.nomeDestaque}>{profissional.nome_completo}</Text>
                {infoProfissional !== '' && (
                  <Text style={styles.infoSub}>{infoProfissional}</Text>
                )}
              </View>
            )}
            <View style={styles.bloco}>
              <Text style={styles.blocoTitulo}>Paciente</Text>
              <Text style={styles.nomeDestaque}>{paciente.nome}</Text>
              {infoPaciente !== '' && <Text style={styles.infoSub}>{infoPaciente}</Text>}
            </View>
          </>
        )}

        {/* ===== Corpo por modelo ===== */}
        {resumido ? (
          <CorpoResumido ficha={ficha} atendimento={atendimento} />
        ) : (
          <CorpoCompleto ficha={ficha} />
        )}

        {/* ===== Carimbo do profissional ===== */}
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
