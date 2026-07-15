import { z } from 'zod'
import {
  dadosClinicaSchema,
  dadosProfissionalSchema,
} from './onboarding'

// Reaproveita schemas do onboarding — mesmas regras (nome, telefone, etc).
// Manter alinhado: se uma das duas mudar, ajustar a outra.

export const salvarClinicaSchema = dadosClinicaSchema
export type SalvarClinicaInput = z.infer<typeof salvarClinicaSchema>

export const salvarProfissionalSchema = dadosProfissionalSchema
export type SalvarProfissionalInput = z.infer<typeof salvarProfissionalSchema>

// REMOVIDO: salvarTipoSchema (tipos de consulta nao existem mais)

// Origem de paciente — so nome
export const salvarOrigemSchema = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100),
})
export type SalvarOrigemInput = z.infer<typeof salvarOrigemSchema>

// Toggle compartilhado — id + ativo (boolean) — usado apenas para origens agora
export const toggleSchema = z.object({
  id: z.string().uuid('ID inválido'),
  ativo: z.boolean(),
})
export type ToggleInput = z.infer<typeof toggleSchema>
