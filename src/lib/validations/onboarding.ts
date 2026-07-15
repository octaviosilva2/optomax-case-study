import { z } from 'zod'

// Regex telefone — opcional, mas se preenchido tem que ser válido
const telefoneRegex = /^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/

// Texto de ajuda padrão do campo de telefone (exibido em cinza abaixo do input).
export const TELEFONE_AJUDA = 'DDD + número. Ex: 47991960107'

/**
 * Normaliza um telefone BR para SÓ dígitos no formato DDD + número (10 = fixo,
 * 11 = celular). É tolerante a como a pessoa escreve:
 *   - remove formatação (parênteses, espaços, hífen, +)
 *   - remove o código do país 55 quando presente (5547991960107 → 47991960107)
 *   - remove o 0 de discagem nacional no DDD (047991960107 → 47991960107)
 * Retorna null se não for um telefone BR reconhecível.
 *
 * Cuidado: o DDD 55 (Santa Maria/RS) existe. Por isso o "55" só é tratado como
 * código de país quando há 12-13 dígitos — um número com DDD 55 tem 10-11 e
 * nunca cai nesse corte.
 */
export function normalizarTelefone(raw: string): string | null {
  let digits = (raw ?? '').replace(/\D/g, '')
  // Código do país: 55 + 10/11 dígitos (total 12/13).
  if (digits.length >= 12 && digits.startsWith('55')) {
    digits = digits.slice(2)
  }
  // Prefixo nacional 0 antes do DDD: 0 + 10/11 dígitos (total 11/12).
  if (digits.length >= 11 && digits.startsWith('0')) {
    digits = digits.slice(1)
  }
  if (digits.length === 10 || digits.length === 11) return digits
  return null
}

/**
 * Mensagem de erro do campo de telefone, ou null se válido. Aceita qualquer
 * formato que `normalizarTelefone` reconheça.
 */
export function mensagemErroTelefone(raw: string): string | null {
  if ((raw ?? '').replace(/\D/g, '').length === 0) return 'Telefone obrigatório.'
  if (normalizarTelefone(raw) === null) {
    return 'Telefone inválido. Use DDD + número. Ex: 47991960107'
  }
  return null
}

// Horário em HH:MM (24h)
const horaRegex = /^([01]\d|2[0-3]):[0-5]\d$/

// Schema de um dia de funcionamento — quando ativo, inicio < fim
const horarioDiaSchema = z.object({
  ativo: z.boolean(),
  inicio: z.string().regex(horaRegex, 'Hora de início inválida'),
  fim: z.string().regex(horaRegex, 'Hora de fim inválida'),
}).refine(
  (h) => !h.ativo || h.inicio < h.fim,
  { message: 'Hora de início deve ser menor que hora de fim', path: ['inicio'] }
)

// Dados da clínica enviados pela primeira etapa do onboarding
// `horario_funcionamento` mantido como opcional para retrocompatibilidade —
// agenda foi liberada para qualquer horário, então o campo não é mais editado pela UI.
export const dadosClinicaSchema = z.object({
  nome_clinica: z.string().trim().min(2, 'Nome da clínica deve ter pelo menos 2 caracteres').max(120),
  endereco: z.string().trim().max(300).nullable().or(z.literal('')),
  telefone: z.string().regex(telefoneRegex, 'Telefone inválido').nullable().or(z.literal('')),
  horario_funcionamento: z.record(z.string(), horarioDiaSchema).optional(),
})

// Dados do profissional enviados pela segunda etapa do onboarding.
// NOTA: intervalo_consulta foi REMOVIDO na refatoracao de produto (tipos de consulta eliminados).
export const dadosProfissionalSchema = z.object({
  nome_completo: z.string().trim().min(3, 'Nome deve ter pelo menos 3 caracteres').max(200),
  cro_cboo: z.string().trim().max(50).nullable().or(z.literal('')),
  formacoes: z.array(z.string().trim().max(200)).max(10),
})
