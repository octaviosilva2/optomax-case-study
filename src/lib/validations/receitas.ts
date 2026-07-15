import { z } from 'zod'
import { novaPrescricaoSchema } from './clinical'

export const receitaRapidaSchema = z.object({
  patient_id: z.string().min(1, 'Paciente é obrigatório').uuid('ID de paciente inválido'),
  tipo: z.enum(['oculos', 'lente_contato']),
  dados_prescricao: novaPrescricaoSchema,
  // Reorganização "Novo Atendimento": quando a receita nasce de um agendamento,
  // liga appointment_id e permite o flip de status (ver /api/prescriptions/quick).
  // Ausente = receita standalone pura (comportamento atual intacto).
  appointmentId: z.string().uuid().optional(),
})

export type ReceitaRapidaInput = z.infer<typeof receitaRapidaSchema>

// Input de `atualizarReceitaRapida` (CA4b) — edita a MESMA receita
// quick/standalone já emitida (não cria linha nova, não mexe em agendamento).
export const atualizarReceitaRapidaSchema = z.object({
  prescricaoId: z.string().uuid(),
  dados_prescricao: novaPrescricaoSchema,
})

export type AtualizarReceitaRapidaInput = z.infer<typeof atualizarReceitaRapidaSchema>

// ── B3 (CA19–CA24): ciclo de vida da receita AVULSA (rascunho → finalizada) ──

// `criarRascunhoReceita`: só precisa do paciente — a receita nasce vazia em
// rascunho (o grau é preenchido depois, na página de edição).
export const criarRascunhoReceitaSchema = z.object({
  patientId: z.string().uuid('ID de paciente inválido'),
})

// id de uma prescrição em rascunho — reusado por `salvarRascunhoReceita`
// (que valida o `dados` à parte, de forma leniente) e `finalizarReceita`.
export const rascunhoReceitaIdSchema = z.string().uuid()


