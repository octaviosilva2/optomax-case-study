import { z } from 'zod'

// ----- Helpers -----

// Número opcional — preprocess converte string numérica para number antes de validar,
// evitando "Invalid input" do z.union quando o banco devolve strings
const numeroOpcional = z.preprocess(
  (v) => {
    if (v === null || v === undefined || v === '') return null
    if (typeof v === 'number') return v
    const n = Number(v)
    return Number.isNaN(n) ? v : n
  },
  z.number().nullable(),
)

// Helper: range numérico opcional com mensagem customizada
function numeroRange(min: number, max: number, label: string, integer = false) {
  return numeroOpcional.refine(
    (v) =>
      v === null ||
      (typeof v === 'number' &&
        !Number.isNaN(v) &&
        v >= min &&
        v <= max &&
        (!integer || Number.isInteger(v))),
    { message: `${label} deve estar entre ${min} e ${max}${integer ? ' (inteiro)' : ''}` },
  )
}

// ----- Refração / Dioptrias -----

// Helper Etapa 6 (#29): grade ESF/CIL/EIXO/ADD virou texto livre em
// nova_prescricao / lensometria / dioptria_atual. Preprocess aceita number legado
// (fichas antigas no JSONB) e converte para string, preservando o auto-save.
// `null`/`undefined`/objeto inválido viram string vazia.
const dioptriaCampoLivre = z.preprocess(
  (v) => {
    if (v === null || v === undefined) return ''
    if (typeof v === 'string') return v
    if (typeof v === 'number') return String(v)
    return ''
  },
  z.string().max(50).default(''),
)

// Grade dióptrica: 4 campos texto livre (DNP removido na Etapa 6 #27).
// Fichas antigas com `dnp: number` no JSONB ficam órfãs (não renderizam, não quebram).
const campoRefracaoSchema = z.object({
  esf: dioptriaCampoLivre,
  cil: dioptriaCampoLivre,
  eixo: dioptriaCampoLivre,
  add: dioptriaCampoLivre,
})

const olhosDuplosSchema = z.object({
  od: campoRefracaoSchema,
  oe: campoRefracaoSchema,
})

// Enum de tipo de lente — Etapa 6 (#27): "progressiva" removida do enum oficial.
// Preprocess: fichas antigas com 'progressiva' caem em null (valor antigo se perde
// no próximo save). Decisão Octavio em 2026-05-11: remoção definitiva, não só esconder.
const tipoLenteSchema = z.preprocess(
  (v) => (v === 'progressiva' ? null : v),
  z.enum(['monofocal', 'bifocal', 'multifocal']).nullable().default(null),
)

// ----- Item de avaliação normal/alterado -----

const itemAvaliacaoSchema = z.object({
  resultado: z.enum(['normal', 'alterado']).nullable().default(null),
  observacao: z.string().max(2000).default(''),
})

// ----- Medida de acuidade visual -----

const medidaAVSchema = z.object({
  snellen: z.string().max(50).default(''),
  decimal: numeroRange(0, 2, 'Acuidade decimal'),
})

// ----- Schemas das seções compartilhadas -----

export const anamneseSchema = z.object({
  queixa_principal: z.string().max(2000).default(''),
  historia_doenca_atual: z.string().max(2000).default(''),
  uso_oculos_atual: z.enum(['sim', 'nao', 'as_vezes']).nullable().default(null),
  tempo_uso_oculos: z.string().max(200).default(''),
  ultima_consulta: z.string().max(200).default(''),
  alergias: z.string().max(2000).default(''),
  medicamentos_uso: z.string().max(2000).default(''),
  cirurgias_oculares: z.string().max(2000).default(''),
  observacoes: z.string().max(2000).default(''),
})

export const anamneseFamiliarSchema = z.object({
  glaucoma: z.boolean().default(false),
  catarata: z.boolean().default(false),
  dmri: z.boolean().default(false),
  diabetes: z.boolean().default(false),
  pressao_alta: z.boolean().default(false),
  ceratocone: z.boolean().default(false),
  outras: z.string().max(2000).default(''),
})

export const dioptriaAtualSchema = olhosDuplosSchema.extend({
  tipo_lente: tipoLenteSchema,
  observacoes: z.string().max(2000).default(''),
})

export const novaPrescricaoSchema = olhosDuplosSchema.extend({
  tipo_lente: tipoLenteSchema,
  tratamentos: z.array(z.string()).default([]),
  observacoes: z.string().max(2000).default(''),
  // Validade da receita em meses (1-60), inteiro. null = não informada.
  // Fichas antigas sem a chave caem em null pelo preprocess de numeroOpcional.
  validade_meses: numeroRange(1, 60, 'Validade (meses)', true),
})

export const historicoObservacoesSchema = z.object({
  conduta: z.string().max(4000).default(''),
  observacoes_clinicas: z.string().max(4000).default(''),
  retorno_recomendado: z.string().max(200).default(''),
})

export const encaminhamentoSchema = z.object({
  necessario: z.boolean().default(false),
  especialidade: z.string().max(200).default(''),
  motivo: z.string().max(2000).default(''),
  urgencia: z
    .enum(['rotina', 'preferencial', 'urgente'])
    .nullable()
    .default(null),
})

// ----- Schemas das seções exclusivas do Completo -----

export const acuidadeVisualSchema = z.object({
  od_longe: medidaAVSchema,
  oe_longe: medidaAVSchema,
  ao_longe: medidaAVSchema,
  od_perto: medidaAVSchema,
  oe_perto: medidaAVSchema,
  ao_perto: medidaAVSchema,
  observacoes: z.string().max(2000).default(''),
})

// Reflexos pupilares — tabela OD/OE × Fotomotor/Consensual/Acomodativo (preenchimento livre)
const reflexosPupilaresOlhoSchema = z.object({
  fotomotor: z.string().max(500).default(''),
  consensual: z.string().max(500).default(''),
  acomodativo: z.string().max(500).default(''),
})

export const reflexosPupilaresSchema = z.object({
  od: reflexosPupilaresOlhoSchema,
  oe: reflexosPupilaresOlhoSchema,
  observacoes: z.string().max(2000).default(''),
})

export const avaliacaoMotoraSchema = z.object({
  duccoes: itemAvaliacaoSchema,
  versoes: itemAvaliacaoSchema,
  observacoes: z.string().max(2000).default(''),
})

// Biomicroscopia — tabela OD/OE × 9 campos livres (sem "câmara anterior")
const biomicroscopiaOlhoSchema = z.object({
  sobrancelha: z.string().max(500).default(''),
  palpebra: z.string().max(500).default(''),
  cilios: z.string().max(500).default(''),
  cornea: z.string().max(500).default(''),
  iris: z.string().max(500).default(''),
  conjuntiva: z.string().max(500).default(''),
  esclera: z.string().max(500).default(''),
  cristalino: z.string().max(500).default(''),
  pupilas: z.string().max(500).default(''),
})

export const biomicroscopiaSchema = z.object({
  od: biomicroscopiaOlhoSchema,
  oe: biomicroscopiaOlhoSchema,
  observacoes: z.string().max(2000).default(''),
})

// Oftalmoscopia Direta — 7 campos livres por olho.
// `escavacao` agora é string. Preprocess converte fichas antigas (number) para string,
// preservando o dado em vez de quebrar o auto-save.
const stringLivreCompat = z.preprocess(
  (v) => {
    if (v === null || v === undefined) return ''
    if (typeof v === 'string') return v
    if (typeof v === 'number') return String(v)
    return ''
  },
  z.string().max(500).default(''),
)

const oftalmoscopiaOlhoSchema = z.object({
  dioptria_lente: z.string().max(500).default(''),
  bruckner: z.string().max(500).default(''),
  pupila: z.string().max(500).default(''),
  escavacao: stringLivreCompat,
  relacao_av: z.string().max(500).default(''),
  macula: z.string().max(500).default(''),
  fixacao: z.string().max(500).default(''),
})

export const oftalmoscopiaSchema = z.object({
  od: oftalmoscopiaOlhoSchema,
  oe: oftalmoscopiaOlhoSchema,
  observacoes: z.string().max(2000).default(''),
})

export const tonometriaSchema = z.object({
  od_pio: numeroRange(5, 50, 'PIO'),
  oe_pio: numeroRange(5, 50, 'PIO'),
  metodo: z
    .enum(['aplanacao', 'sopro', 'identacao', 'rebote'])
    .nullable()
    .default(null),
  horario: z.string().max(20).default(''),
  observacoes: z.string().max(2000).default(''),
})

const ceratometriaOlhoSchema = z.object({
  k1: numeroRange(30, 60, 'K1'),
  k2: numeroRange(30, 60, 'K2'),
  eixo: numeroRange(0, 180, 'Eixo', true),
})

export const ceratometriaSchema = z.object({
  od: ceratometriaOlhoSchema,
  oe: ceratometriaOlhoSchema,
  observacoes: z.string().max(2000).default(''),
})

export const lensometriaSchema = olhosDuplosSchema.extend({
  tipo_lente: tipoLenteSchema,
  observacoes: z.string().max(2000).default(''),
})

// Etapa 7 (#30): autorrefrator virou texto livre. Reaproveita o helper
// `dioptriaCampoLivre` (preprocess number→string, null→'') definido acima — preserva
// fichas antigas com `number` no JSONB sem quebrar auto-save.
const autorrefratorOlhoSchema = z.object({
  esf: dioptriaCampoLivre,
  cil: dioptriaCampoLivre,
  eixo: dioptriaCampoLivre,
})

export const autorrefratorSchema = z.object({
  od: autorrefratorOlhoSchema,
  oe: autorrefratorOlhoSchema,
  observacoes: z.string().max(2000).default(''),
})

// Retinoscopia estática — preenchimento livre por olho (Etapa 4).
// Preprocess: fichas antigas têm `{od: {esf, cil, eixo, dnp, add}}` (objeto). Convertemos para string vazia,
// preservando o auto-save sem injetar JSON inválido no campo de texto.
const retinoscopiaCampoLivre = z.preprocess(
  (v) => {
    if (v === null || v === undefined) return ''
    if (typeof v === 'string') return v
    return ''
  },
  z.string().max(500).default(''),
)

export const retinoscopiaEstaticaSchema = z.object({
  od: retinoscopiaCampoLivre,
  oe: retinoscopiaCampoLivre,
  observacoes: z.string().max(2000).default(''),
})

export const retinoscopiaDinamicaSchema = z.object({
  od_valor: numeroRange(-5, 5, 'Retinoscopia dinâmica OD'),
  oe_valor: numeroRange(-5, 5, 'Retinoscopia dinâmica OE'),
  observacoes: z.string().max(2000).default(''),
})

// Subjetivo — refração subjetiva final, preenchimento livre por olho
const subjetivoOlhoSchema = z.object({
  campo_livre: z.string().max(500).default(''),
  av_longe: z.string().max(100).default(''),
  av_perto: z.string().max(100).default(''),
})

export const subjetivoSchema = z.object({
  od: subjetivoOlhoSchema,
  oe: subjetivoOlhoSchema,
  observacoes: z.string().max(2000).default(''),
})

// Cover Test — 3 distâncias com magnitude livre em texto (Etapa 4)
const coverTestMedidaSchema = z.object({
  magnitude: z.string().max(200).default(''),
})

export const coverTestSchema = z.object({
  seis_metros: coverTestMedidaSchema,
  quarenta_cm: coverTestMedidaSchema,
  vinte_cm: coverTestMedidaSchema,
  observacoes: z.string().max(2000).default(''),
})

// PPC (Etapa 5) — 3 medidas livres com sufixo "cm" na UI.
// Preprocess `stringLivreCompat` (definido acima) tolera number legado se algum dia
// uma ficha vier com os nomes antigos `rompimento`/`recuperacao` mapeados aqui — porém,
// como as chaves mudaram (`objeto_real`/`luz`/`luz_filtro`), o caminho normal é
// simplesmente ficar com defaults vazios em fichas antigas.
export const ppcSchema = z.object({
  objeto_real: stringLivreCompat,
  luz: stringLivreCompat,
  luz_filtro: stringLivreCompat,
  observacoes: z.string().max(2000).default(''),
})

// PPA (Etapa 5) — medida única livre, chave separada de PPC no JSONB
export const ppaSchema = z.object({
  valor: stringLivreCompat,
})

// Reservas fusionais simplificadas (Etapa 5) — 4 strings livres.
// Helper específico para descartar objetos legados (`{rompimento, recuperacao}` antigos).
const rfCampoLivre = z.preprocess(
  (v) => {
    if (v === null || v === undefined) return ''
    if (typeof v === 'string') return v
    if (typeof v === 'number') return String(v)
    return ''  // objeto legado vira string vazia — dado clínico antigo se perde no save
  },
  z.string().max(200).default(''),
)

export const reservasFusionaisSchema = z.object({
  rfpl: rfCampoLivre,
  rfpp: rfCampoLivre,
  rfnl: rfCampoLivre,
  rfnp: rfCampoLivre,
  observacoes: z.string().max(2000).default(''),
})

// Testes motores complementares (Etapa 5) — seção nova, antes do PPC.
// Enums permissivos: '' representa "não respondido" no UI (radio sem seleção).
export const testesMotoresComplementaresSchema = z.object({
  olho_dominante: z.enum(['od', 'oe', '']).default(''),
  hirschberg: z.enum(['centrado', 'descentralizado', '']).default(''),
  krimsky: z.string().max(200).default(''),
  observacoes: z.string().max(2000).default(''),
})

export const testesAcomodativosSchema = z.object({
  aa_od: numeroRange(0, 30, 'AA OD'),
  aa_oe: numeroRange(0, 30, 'AA OE'),
  aa_ao: numeroRange(0, 30, 'AA AO'),
  facilidade_acomodativa: z.string().max(500).default(''),
  observacoes: z.string().max(2000).default(''),
})

export const visaoCoresSchema = z.object({
  teste_usado: z.string().max(200).default(''),
  resultado_od: z.string().max(200).default(''),
  resultado_oe: z.string().max(200).default(''),
  observacoes: z.string().max(2000).default(''),
})

export const camposVisuaisSchema = z.object({
  od: itemAvaliacaoSchema,
  oe: itemAvaliacaoSchema,
  observacoes: z.string().max(2000).default(''),
})

export const diagnosticoSchema = z.object({
  hipoteses: z.string().max(4000).default(''),
  cid: z.string().max(200).default(''),
  observacoes: z.string().max(2000).default(''),
})

// ----- Documento completo (todos os campos opcionais — auto-save preserva parcial) -----

// Schema unificado: aceita seções do Resumido + todas do Completo.
// Campos exclusivos do Completo são preservados se o usuário voltar para Resumido.
export const fichaClinicaSchema = z.object({
  // Compartilhadas
  anamnese: anamneseSchema.partial().optional(),
  anamnese_familiar: anamneseFamiliarSchema.partial().optional(),
  dioptria_atual: dioptriaAtualSchema.partial().optional(),
  nova_prescricao: novaPrescricaoSchema.partial().optional(),
  historico_observacoes: historicoObservacoesSchema.partial().optional(),
  encaminhamento: encaminhamentoSchema.partial().optional(),

  // Exclusivas do Completo
  acuidade_visual_sc: acuidadeVisualSchema.partial().optional(),
  acuidade_visual_cc: acuidadeVisualSchema.partial().optional(),
  reflexos_pupilares: reflexosPupilaresSchema.partial().optional(),
  avaliacao_motora: avaliacaoMotoraSchema.partial().optional(),
  biomicroscopia: biomicroscopiaSchema.partial().optional(),
  oftalmoscopia: oftalmoscopiaSchema.partial().optional(),
  tonometria: tonometriaSchema.partial().optional(),
  ceratometria: ceratometriaSchema.partial().optional(),
  lensometria: lensometriaSchema.partial().optional(),
  autorrefrator: autorrefratorSchema.partial().optional(),
  retinoscopia_estatica: retinoscopiaEstaticaSchema.partial().optional(),
  retinoscopia_dinamica: retinoscopiaDinamicaSchema.partial().optional(),
  subjetivo: subjetivoSchema.partial().optional(),
  cover_test: coverTestSchema.partial().optional(),
  testes_motores_complementares: testesMotoresComplementaresSchema.partial().optional(),
  ppc: ppcSchema.partial().optional(),
  ppa: ppaSchema.partial().optional(),
  reservas_fusionais: reservasFusionaisSchema.partial().optional(),
  testes_acomodativos: testesAcomodativosSchema.partial().optional(),
  visao_cores: visaoCoresSchema.partial().optional(),
  campos_visuais: camposVisuaisSchema.partial().optional(),
  diagnostico: diagnosticoSchema.partial().optional(),
})

export type FichaClinicaInput = z.infer<typeof fichaClinicaSchema>
