// Tipos do conteúdo JSONB armazenado em clinical_records.clinical_data.
// Toda mutação deve mesclar client-side antes de enviar ao servidor.

// ----- Refração / Dioptrias -----

// Um campo de refração para um olho (OD ou OE).
// Etapa 6 (#27 + #29): campos viraram texto livre para aceitar qualquer formato
// clínico (ex: "-2.50", "+0.75", "neutro", "PL"). DNP foi removido. O preprocess
// do schema Zod converte fichas antigas com number/null/dnp em string sem quebrar auto-save.
export type CampoRefracao = {
  esf: string  // Esfera — texto livre (ex: "-2.50", "+0.75", "PL")
  cil: string  // Cilindro — texto livre
  eixo: string // Eixo — texto livre (ex: "90", "180°")
  add: string  // Adição para perto — texto livre
}

// Par de olhos (OD = direito, OE = esquerdo)
export type OlhosDuplos = {
  od: CampoRefracao
  oe: CampoRefracao
}

// ----- Seções compartilhadas (Resumido + Completo) -----

export type Anamnese = {
  queixa_principal: string
  historia_doenca_atual: string
  uso_oculos_atual: 'sim' | 'nao' | 'as_vezes' | null
  tempo_uso_oculos: string  // texto livre, ex: "3 anos"
  ultima_consulta: string   // texto livre, ex: "há 1 ano"
  alergias: string
  medicamentos_uso: string
  cirurgias_oculares: string
  observacoes: string
}

export type AnamneseFamiliar = {
  glaucoma: boolean
  catarata: boolean
  dmri: boolean              // degeneração macular relacionada à idade
  diabetes: boolean
  pressao_alta: boolean
  ceratocone: boolean
  outras: string             // texto livre
}

// Etapa 6 (#27): "progressiva" removida do enum. Fichas antigas com `tipo_lente: 'progressiva'`
// caem em null no preprocess do schema — o valor antigo não é mais carregado para a UI.
export type DioptriaAtual = OlhosDuplos & {
  tipo_lente: 'monofocal' | 'bifocal' | 'multifocal' | null
  observacoes: string
}

// Refração final / nova prescrição — chave compartilhada entre Resumido e Completo.
// No modelo Completo aparece como "Refração Final" (mesma estrutura de dados).
export type NovaPrescricao = OlhosDuplos & {
  tipo_lente: 'monofocal' | 'bifocal' | 'multifocal' | null
  tratamentos: string[]      // ex: ['antirreflexo', 'fotossensivel']
  observacoes: string
  // Validade da receita em meses, preenchida manualmente por atendimento
  // (NÃO puxa padrão de Configurações). null = não informada → a linha
  // "Válida por X meses" some do PDF.
  validade_meses: number | null
}

// Conduta / histórico — chave compartilhada (no Completo aparece como "Conduta")
export type HistoricoObservacoes = {
  conduta: string
  observacoes_clinicas: string
  retorno_recomendado: string  // texto livre, ex: "6 meses"
}

export type Encaminhamento = {
  necessario: boolean
  especialidade: string        // ex: 'oftalmologista', 'neurologista'
  motivo: string
  urgencia: 'rotina' | 'preferencial' | 'urgente' | null
}

// ----- Seções exclusivas do modelo Completo -----

// Helper: avaliação binária com observação livre
export type ItemAvaliacao = {
  resultado: 'normal' | 'alterado' | null
  observacao: string
}

// Acuidade visual — Snellen (ex: "20/20") em texto + decimal numérico opcional
export type MedidaAV = {
  snellen: string  // ex: "20/20", "20/40", "CD/3m" (conta dedos)
  decimal: number | null  // ex: 1.0, 0.5
}

export type AcuidadeVisual = {
  od_longe: MedidaAV
  oe_longe: MedidaAV
  ao_longe: MedidaAV  // ambos olhos
  od_perto: MedidaAV
  oe_perto: MedidaAV
  ao_perto: MedidaAV
  observacoes: string
}

// Reflexos pupilares — preenchimento livre por olho (formato tabela OD/OE × 3 colunas).
// Cada campo é string livre (ex: "Presente", "Hiporreflexivo", "Anisocoria 2mm").
export type ReflexosPupilaresOlho = {
  fotomotor: string
  consensual: string
  acomodativo: string
}

export type ReflexosPupilares = {
  od: ReflexosPupilaresOlho
  oe: ReflexosPupilaresOlho
  observacoes: string
}

export type AvaliacaoMotora = {
  duccoes: ItemAvaliacao
  versoes: ItemAvaliacao
  observacoes: string
}

// Biomicroscopia — preenchimento livre por olho (formato tabela OD/OE × 9 campos).
// "Câmara anterior" foi removida do escopo clínico do OptoMax.
export type BiomicroscopiaOlho = {
  sobrancelha: string
  palpebra: string
  cilios: string
  cornea: string
  iris: string
  conjuntiva: string
  esclera: string
  cristalino: string
  pupilas: string
}

export type Biomicroscopia = {
  od: BiomicroscopiaOlho
  oe: BiomicroscopiaOlho
  observacoes: string
}

// Oftalmoscopia Direta — preenchimento livre por olho (7 campos).
// "Escavação" virou string para aceitar formatos clínicos livres (ex: "0.3", "0.3/0.4 ovalada").
export type OftalmoscopiaOlho = {
  dioptria_lente: string
  bruckner: string
  pupila: string
  escavacao: string
  relacao_av: string
  macula: string
  fixacao: string
}

export type Oftalmoscopia = {
  od: OftalmoscopiaOlho
  oe: OftalmoscopiaOlho
  observacoes: string
}

export type Tonometria = {
  od_pio: number | null  // pressão intraocular em mmHg (range 5-50)
  oe_pio: number | null
  metodo: 'aplanacao' | 'sopro' | 'identacao' | 'rebote' | null
  horario: string  // ex: "14:30"
  observacoes: string
}

// Ceratometria — k1/k2 em dioptrias + eixo
export type CeratometriaOlho = {
  k1: number | null   // ex: 43.50
  k2: number | null
  eixo: number | null // 0-180
}

export type Ceratometria = {
  od: CeratometriaOlho
  oe: CeratometriaOlho
  observacoes: string
}

// Lensometria — leitura do óculos atual no lensômetro
export type Lensometria = OlhosDuplos & {
  tipo_lente: 'monofocal' | 'bifocal' | 'multifocal' | null
  observacoes: string
}

// Autorrefrator — medição automática (esf/cil/eixo, sem dnp/add).
// Etapa 7 (#30): campos viraram texto livre para aceitar formatos clínicos diversos
// (ex: "-2.50", "+0.75", "90°"). Preprocess `dioptriaCampoLivre` do schema preserva
// fichas antigas com `number` no JSONB (convertendo para string sem quebrar auto-save).
export type AutorrefratorOlho = {
  esf: string
  cil: string
  eixo: string
}

export type Autorrefrator = {
  od: AutorrefratorOlho
  oe: AutorrefratorOlho
  observacoes: string
}

// Retinoscopia estática — preenchimento livre por olho (decisão Etapa 4).
// Antes era OlhosDuplos (esf/cil/eixo/dnp/add). Dados antigos no JSONB ficam órfãos.
export type RetinoscopiaEstatica = {
  od: string
  oe: string
  observacoes: string
}

export type RetinoscopiaDinamica = {
  od_valor: number | null  // ex: +1.50 (lag acomodativo)
  oe_valor: number | null
  observacoes: string
}

// Subjetivo — refração subjetiva final (Etapa 4).
// Preenchimento livre por olho × 3 colunas (Refração / AV Longe / AV Perto).
export type SubjetivoOlho = {
  campo_livre: string  // texto livre da refração subjetiva (ex: "-2.00 -0.50 x 90°")
  av_longe: string     // ex: "20/20", "0.8"
  av_perto: string     // ex: "J1", "0.50"
}

export type Subjetivo = {
  od: SubjetivoOlho
  oe: SubjetivoOlho
  observacoes: string
}

// Cover Test — 3 distâncias (6 metros, 40 cm, 20 cm) com magnitude livre em texto.
// Magnitude string para aceitar formatos clínicos diversos (ex: "4 Δ Exo", "Orto", "8 Δ Eso").
export type CoverTestMedida = {
  magnitude: string
}

export type CoverTest = {
  seis_metros: CoverTestMedida
  quarenta_cm: CoverTestMedida
  vinte_cm: CoverTestMedida
  observacoes: string
}

// Ponto Próximo de Convergência — 3 medidas livres (Etapa 5).
// Antes era { rompimento, recuperacao } numérico. Dados antigos ficam órfãos no JSONB.
export type PPC = {
  objeto_real: string   // ex: "6 cm"
  luz: string           // ex: "8 cm"
  luz_filtro: string    // ex: "9 cm"
  observacoes: string
}

// Ponto Próximo de Acomodação — medida única livre (Etapa 5).
// Renderizado dentro da mesma seção de PPC mas armazenado como chave separada.
export type PPA = {
  valor: string  // ex: "10 cm"
}

// Reservas Fusionais simplificadas — 4 medidas livres (Etapa 5).
// Antes era OD/OE × Rompimento/Recuperação numéricos. Chaves antigas (longe_bo/longe_bi/perto_bo/perto_bi)
// ficam órfãs no JSONB — preprocess Zod descarta objeto legado para não quebrar auto-save.
export type ReservasFusionais = {
  rfpl: string  // reservas fusionais positivas longe (RFPL)
  rfpp: string  // reservas fusionais positivas perto (RFPP)
  rfnl: string  // reservas fusionais negativas longe (RFNL)
  rfnp: string  // reservas fusionais negativas perto (RFNP)
  observacoes: string
}

// Testes motores complementares (Etapa 5) — seção nova, antes do PPC.
// olho_dominante e hirschberg usam '' para "não respondido" (radio sem seleção).
export type TestesMotoresComplementares = {
  olho_dominante: 'od' | 'oe' | ''
  hirschberg: 'centrado' | 'descentralizado' | ''
  krimsky: string  // texto livre, ex: "5 Δ"
  observacoes: string
}

// Testes Acomodativos — Amplitude de Acomodação (AA) + facilidade
export type TestesAcomodativos = {
  aa_od: number | null  // em dioptrias
  aa_oe: number | null
  aa_ao: number | null
  facilidade_acomodativa: string  // texto livre (ex: "8 cpm OD, 10 cpm OE")
  observacoes: string
}

export type VisaoCores = {
  teste_usado: string  // ex: "Ishihara"
  resultado_od: string // ex: "12/14"
  resultado_oe: string
  observacoes: string
}

export type CamposVisuais = {
  od: ItemAvaliacao  // confrontação
  oe: ItemAvaliacao
  observacoes: string
}

export type Diagnostico = {
  hipoteses: string         // hipóteses diagnósticas
  cid: string               // código(s) CID-10 opcional
  observacoes: string
}

// ----- Documentos completos armazenados em clinical_data -----

export type FichaClinicaResumida = {
  anamnese?: Partial<Anamnese>
  anamnese_familiar?: Partial<AnamneseFamiliar>
  dioptria_atual?: Partial<DioptriaAtual>
  nova_prescricao?: Partial<NovaPrescricao>
  historico_observacoes?: Partial<HistoricoObservacoes>
  encaminhamento?: Partial<Encaminhamento>
}

export type FichaClinicaCompleta = FichaClinicaResumida & {
  acuidade_visual_sc?: Partial<AcuidadeVisual>
  acuidade_visual_cc?: Partial<AcuidadeVisual>
  reflexos_pupilares?: Partial<ReflexosPupilares>
  avaliacao_motora?: Partial<AvaliacaoMotora>
  biomicroscopia?: Partial<Biomicroscopia>
  oftalmoscopia?: Partial<Oftalmoscopia>
  tonometria?: Partial<Tonometria>
  ceratometria?: Partial<Ceratometria>
  lensometria?: Partial<Lensometria>
  autorrefrator?: Partial<Autorrefrator>
  retinoscopia_estatica?: Partial<RetinoscopiaEstatica>
  retinoscopia_dinamica?: Partial<RetinoscopiaDinamica>
  subjetivo?: Partial<Subjetivo>
  cover_test?: Partial<CoverTest>
  testes_motores_complementares?: Partial<TestesMotoresComplementares>
  ppc?: Partial<PPC>
  ppa?: Partial<PPA>
  reservas_fusionais?: Partial<ReservasFusionais>
  testes_acomodativos?: Partial<TestesAcomodativos>
  visao_cores?: Partial<VisaoCores>
  campos_visuais?: Partial<CamposVisuais>
  diagnostico?: Partial<Diagnostico>
}

// União usada em hooks/actions — aceita ambos os modelos
export type FichaClinica = FichaClinicaCompleta

// ----- Constantes auxiliares -----

export const LINHAS_REFRACAO = ['od', 'oe'] as const
export type LinhaRefracao = typeof LINHAS_REFRACAO[number]

// Etapa 6 (#27): DNP removido. Restam 4 campos da grade ESF/CIL/EIXO/ADD.
export const CAMPOS_REFRACAO = ['esf', 'cil', 'eixo', 'add'] as const
export type CampoRefracaoKey = typeof CAMPOS_REFRACAO[number]
