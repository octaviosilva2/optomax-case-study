import { z } from 'zod'
import { validarCPF, limparCPF } from '@/lib/utils/cpf'
import { calcularIdade } from '@/lib/utils/idade'

// Regex WhatsApp: aceita (XX) XXXXX-XXXX ou apenas dígitos
const whatsappRegex = /^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/

/**
 * Cadastro rápido: nome e whatsapp são obrigatórios (só na validação, não no banco —
 * a coluna `whatsapp` continua nullable pra não quebrar pacientes legados). Os demais
 * campos são opcionais; quando preenchidos, continuam validados (CPF precisa ser válido,
 * data não pode ser futura). Responsável legal só é exigido se a data de nascimento foi
 * informada e resultar em idade < 18 — sem data, não há como calcular a idade.
 */
export const pacienteSchema = z.object({
  nome: z.string().trim().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  whatsapp: z.string().regex(whatsappRegex, 'WhatsApp inválido'),
  cpf: z
    .string()
    .trim()
    .refine((v) => !v || validarCPF(v), 'CPF inválido')
    .transform((v) => (v ? limparCPF(v) : v))
    .optional(),
  data_nascimento: z
    .string()
    .trim()
    .refine((d) => !d || new Date(d) <= new Date(), 'Data de nascimento não pode ser futura')
    .optional(),
  email: z.string().trim().email('Email inválido').optional().or(z.literal('')),
  endereco: z.string().trim().optional().or(z.literal('')),
  sexo_biologico: z.enum(['M', 'F']).optional().nullable(),
  responsavel_legal: z.string().optional().or(z.literal('')),
  observacoes: z.string().optional().or(z.literal('')),
  origem_id: z.string().uuid().optional().nullable(),
}).refine(
  (data) => {
    // Sem data de nascimento não dá pra saber a idade — não exige responsável.
    if (!data.data_nascimento) return true
    const idade = calcularIdade(data.data_nascimento)
    if (idade < 18) return !!data.responsavel_legal && data.responsavel_legal.trim().length >= 3
    return true
  },
  { message: 'Responsável legal é obrigatório para menores de 18 anos', path: ['responsavel_legal'] }
)

export type PacienteInput = z.infer<typeof pacienteSchema>
